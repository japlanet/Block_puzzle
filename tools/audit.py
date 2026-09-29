#!/usr/bin/env python3
"""Audit data/levels.json: validate structure, check each block has a
walls-only path to its gate, and run an exhaustive BFS (blocks may stop on any
cell, mirroring player drags) to prove solvability.

Same rules as js/geometry.js: `holes` are cells cut out of the board (its
shape); a gate sits on the outermost board cell of its rows/cols, which on a
shaped board can be an inner edge. `ice: N` freezes a block until N animals
have gone home; `lock` (block or gate) stays shut until every `key` carrier
has gone home.  Usage:
  python3 tools/audit.py [levels.json] [--show N,M] [--budget 3000000]
"""
import json, sys
from collections import deque

DIRS = {'free': [(-1,0),(1,0),(0,-1),(0,1)], 'h': [(-1,0),(1,0)], 'v': [(0,-1),(0,1)]}

def norm(lv):
    lv = json.loads(json.dumps(lv))
    for b in lv['blocks']:
        b['shape'] = [tuple(p) if isinstance(p, list) else (p['dc'], p['dr']) for p in b['shape']]
        b.setdefault('dir', 'free')
    lv.setdefault('walls', [])
    lv.setdefault('holes', [])
    lv['_holes'] = {(h['col'], h['row']) for h in lv['holes']}
    lv['_blocked'] = lv['_holes'] | {(w['col'], w['row']) for w in lv['walls']}
    for g in lv['gates']:
        g['_line'] = gate_line(g, lv)
    return lv

def on_board(lv, c, r):
    return 0 <= c < lv['cols'] and 0 <= r < lv['rows'] and (c, r) not in lv['_holes']

def gate_line(g, lv):
    """Outermost board column (left/right) or row (top/bottom) across the
    gate's span, or None if the span's cells don't share one edge line."""
    sz = g.get('size', 1); vertical = g['side'] in ('left', 'right')
    start = g.get('exit_row' if vertical else 'exit_col')
    if start is None: return None
    n = lv['cols'] if vertical else lv['rows']
    line = None
    for i in range(start, start + sz):
        js = [j for j in range(n) if (on_board(lv, j, i) if vertical else on_board(lv, i, j))]
        if not js: return None
        edge = js[0] if g['side'] in ('left', 'top') else js[-1]
        if line is not None and edge != line: return None
        line = edge
    return line

def cells(shape, c, r):
    return [(c+dc, r+dr) for dc, dr in shape]

def at_gate(shape, c, r, g, lv):
    line = g.get('_line')
    if line is None: return False
    cs = cells(shape, c, r); sz = g.get('size', 1); side = g['side']
    if side in ('left', 'right'):
        if any((cc > line) if side == 'right' else (cc < line) for cc, _ in cs): return False
        e = [rr for cc, rr in cs if cc == line]
        return bool(e) and all(g['exit_row'] <= rr < g['exit_row']+sz for rr in e)
    if side in ('top', 'bottom'):
        if any((rr > line) if side == 'bottom' else (rr < line) for _, rr in cs): return False
        e = [cc for cc, rr in cs if rr == line]
        return bool(e) and all(g['exit_col'] <= cc < g['exit_col']+sz for cc in e)
    return False

def fits(shape, c, r, occupied, lv):
    for cc, rr in cells(shape, c, r):
        if cc < 0 or cc >= lv['cols'] or rr < 0 or rr >= lv['rows']: return False
        if (cc, rr) in occupied: return False
    return True

def solo_reachable(lv, b, walls):
    """Can block b reach any matching gate with all other blocks removed?
    (`walls` should be lv['_blocked']: rocks and holes.)"""
    gates = [g for g in lv['gates'] if g['color'] == b['color']]
    start = (b['col'], b['row']); seen = {start}; q = deque([start])
    while q:
        c, r = q.popleft()
        if any(at_gate(b['shape'], c, r, g, lv) for g in gates): return True
        for dc, dr in DIRS[b['dir']]:
            nc, nr = c+dc, r+dr
            if (nc, nr) not in seen and fits(b['shape'], nc, nr, walls, lv):
                seen.add((nc, nr)); q.append((nc, nr))
    return False

def solve(lv, budget=400_000, time_cap=45.0, path=False):
    """Best-first search (fewest remaining blocks first, then shallowest).
    Blocks may stop on any cell, mirroring player drags.
    Returns (status, info). status: solved (info=move count) | unsolvable
    (state space exhausted) | budget (gave up; review by hand).
    path=True: for a solved level, info is the list of moves instead,
    each (block id, col, row) where the block was slid to."""
    import heapq, time
    blocks = lv['blocks']
    walls = lv['_blocked']
    gates = {i: [g for g in lv['gates'] if g['color'] == b['color']] for i, b in enumerate(blocks)}
    n = len(blocks)
    ice = [b.get('ice', 0) for b in blocks]
    keys = [i for i, b in enumerate(blocks) if b.get('key')]
    blk_lock = [bool(b.get('lock')) for b in blocks]
    # None = exited. Anyone already at an open door of theirs goes home on the
    # first release in the game, so settle the start the same way.
    start = tuple(settle(lv, blocks, gates, [(b['col'], b['row']) for b in blocks], ice, keys, blk_lock))
    parent = {start: None}
    heap = [(len(blocks), 0, 0, start)]; tick = 1
    expanded = 0; t0 = time.time()
    while heap:
        _, depth, _, st = heapq.heappop(heap); expanded += 1
        if expanded > budget or time.time() - t0 > time_cap: return 'budget', expanded
        if all(p is None for p in st):
            if not path: return 'solved', depth
            moves = []
            while parent[st] is not None:
                st, mv = parent[st]; moves.append(mv)
            return 'solved', moves[::-1]
        occ = set(walls)
        for i, p in enumerate(st):
            if p is not None: occ.update(cells(blocks[i]['shape'], *p))
        home = sum(1 for x in st if x is None)
        shut = any(st[k] is not None for k in keys)
        for i, p in enumerate(st):
            if p is None: continue
            if ice[i] > home or (blk_lock[i] and shut): continue
            b = blocks[i]; shape = b['shape']
            occ_i = occ - set(cells(shape, *p))
            for dc, dr in DIRS[b['dir']]:
                c, r = p
                while True:
                    c += dc; r += dr
                    if not fits(shape, c, r, occ_i, lv): break
                    exited = any(at_gate(shape, c, r, g, lv) for g in gates[i]
                                 if not (g.get('lock') and shut))
                    nst = list(st); nst[i] = None if exited else (c, r)
                    if exited: nst = settle(lv, blocks, gates, nst, ice, keys, blk_lock)
                    nst = tuple(nst)
                    if nst not in parent:
                        parent[nst] = (st, (b['id'], c, r))
                        remaining = sum(1 for x in nst if x is not None)
                        heapq.heappush(heap, (remaining, depth + 1, tick, nst)); tick += 1
    return 'unsolvable', expanded

def settle(lv, blocks, gates, st, ice, keys, blk_lock):
    """After an exit, send home every free block already sitting at an open
    gate of its colour (ice melted / padlock opened), like the game does."""
    while True:
        home = sum(1 for x in st if x is None)
        shut = any(st[k] is not None for k in keys)
        leaving = [i for i, p in enumerate(st) if p is not None
                   and not (ice[i] > home or (blk_lock[i] and shut))
                   and any(at_gate(blocks[i]['shape'], p[0], p[1], g, lv) for g in gates[i]
                           if not (g.get('lock') and shut))]
        if not leaving: return st
        for i in leaving: st[i] = None

def validate(lv):
    """Structural problems (mirrors validateLevel in js/levels.js)."""
    issues = []
    W, H = lv['cols'], lv['rows']
    for g in lv['gates']:
        if g.get('_line') is None: issues.append(f"{g['color']} {g['side']} gate not on one straight board edge")
    seen = {}
    for g in lv['gates']:
        if g.get('_line') is None: continue
        sz = g.get('size', 1); ln = g['_line']
        if g['side'] in ('left', 'right'):
            out = [((ln + 1) if g['side'] == 'right' else (ln - 1), r) for r in range(g['exit_row'], g['exit_row'] + sz)]
        else:
            out = [(c, (ln + 1) if g['side'] == 'bottom' else (ln - 1)) for c in range(g['exit_col'], g['exit_col'] + sz)]
        for cell in out:
            if cell in seen: issues.append(f"{seen[cell]} and {g['color']} gates overlap at {cell}")
            seen[cell] = g['color']
    bc = {b['color'] for b in lv['blocks']}; gc = {g['color'] for g in lv['gates']}
    issues += [f'block colour {c} has no gate' for c in bc - gc] + [f'gate colour {c} has no block' for c in gc - bc]
    occ = {}
    for b in lv['blocks']:
        for c, r in cells(b['shape'], b['col'], b['row']):
            if not (0 <= c < W and 0 <= r < H): issues.append(f"{b['id']} off board at {(c, r)}")
            elif (c, r) in lv['_blocked']: issues.append(f"{b['id']} on a wall/hole at {(c, r)}")
            if (c, r) in occ: issues.append(f"{b['id']} overlaps {occ[(c, r)]} at {(c, r)}")
            occ[(c, r)] = b['id']
        if b.get('ice') and not (0 < b['ice'] < len(lv['blocks'])): issues.append(f"{b['id']} ice {b['ice']} out of range")
        if b.get('key') and b.get('lock'): issues.append(f"{b['id']} has both key and lock")
    has_key = any(b.get('key') for b in lv['blocks'])
    has_lock = any(b.get('lock') for b in lv['blocks']) or any(g.get('lock') for g in lv['gates'])
    if has_lock != has_key: issues.append('padlocks without a key' if has_lock else 'a key without padlocks')
    if len({b['id'] for b in lv['blocks']}) != len(lv['blocks']): issues.append('duplicate block ids')
    return issues

def audit_one(args):
    idx, lv, budget = args
    issues = validate(lv)
    if issues: return idx, 'invalid', '; '.join(issues)
    stuck = [b['id']+'('+b['color']+'/'+b['dir']+')' for b in lv['blocks'] if not solo_reachable(lv, b, lv['_blocked'])]
    if stuck: return idx, 'stuck', 'no path even on an empty board: ' + ', '.join(stuck)
    status, info = solve(lv, budget)
    return idx, status, info

COL = {'red':'R','blue':'B','green':'G','yellow':'Y','purple':'P','orange':'O','pink':'K','teal':'T'}
def show(lv):
    W, H = lv['cols'], lv['rows']
    grid = [['.']*W for _ in range(H)]
    for w in lv['walls']: grid[w['row']][w['col']] = '#'
    for h in lv.get('holes', []): grid[h['row']][h['col']] = ' '
    for b in lv['blocks']:
        ch = COL[b['color']]; ch = ch if b['dir']=='free' else ch.lower()
        mark = '*' if b.get('ice') else '$' if b.get('key') else '@' if b.get('lock') else ''
        tag = ch + (mark or {'free':'','h':'-','v':'|'}[b['dir']])
        for c, r in cells(b['shape'], b['col'], b['row']): grid[r][c] = tag.ljust(2)[:2]
    top = ['  ']*W; bot = ['  ']*W; left = ['  ']*H; right = ['  ']*H
    for g in lv['gates']:
        sz = g.get('size',1); t = COL[g['color']] + ('@' if g.get('lock') else COL[g['color']])
        if g['side']=='top':    [top.__setitem__(x, t) for x in range(g['exit_col'], g['exit_col']+sz) if 0<=x<W]
        if g['side']=='bottom': [bot.__setitem__(x, t) for x in range(g['exit_col'], g['exit_col']+sz) if 0<=x<W]
        if g['side']=='left':   [left.__setitem__(y, t) for y in range(g['exit_row'], g['exit_row']+sz) if 0<=y<H]
        if g['side']=='right':  [right.__setitem__(y, t) for y in range(g['exit_row'], g['exit_row']+sz) if 0<=y<H]
    out = [f"--- {lv['label']} ({W}x{H}) ---", '   ' + ''.join(top)]
    for y in range(H):
        out.append(left[y] + ' ' + ''.join(x.ljust(2) for x in grid[y]) + ' ' + right[y])
    out.append('   ' + ''.join(bot))
    for b in lv['blocks']:
        extra = ''.join(f' {k}={b[k]}' for k in ('ice', 'key', 'lock') if b.get(k))
        out.append(f"  {b['id']:>4} {b['color']:<7} dir={b['dir']:<4} at ({b['col']},{b['row']}) shape={list(b['shape'])}{extra}")
    for g in lv['gates']:
        out.append(f"  gate {g['color']:<7} {g['side']:<6} size={g.get('size',1)} exit_row={g.get('exit_row')} exit_col={g.get('exit_col')}"
                   + (' lock' if g.get('lock') else ''))
    return '\n'.join(out)

def main():
    args = sys.argv[1:]
    path = 'data/levels.json'; show_ids = set(); budget = 400_000
    i = 0
    while i < len(args):
        if args[i] == '--show': show_ids = {int(x) for x in args[i+1].split(',')}; i += 2
        elif args[i] == '--budget': budget = int(args[i+1]); i += 2
        else: path = args[i]; i += 1
    levels = [norm(lv) for lv in json.load(open(path))]
    from multiprocessing import Pool
    jobs = [(idx, lv, budget) for idx, lv in enumerate(levels, 1)]
    results = {}
    with Pool() as pool:
        for idx, status, info in pool.imap_unordered(audit_one, jobs):
            results[idx] = (status, info)
            flag = '' if status == 'solved' else '  <-- PROBLEM'
            lbl = levels[idx-1]['label']
            print(f"{idx:2d} {lbl:<10} {status:<10} {info}{flag}", flush=True)
    bad = [i for i in sorted(results) if results[i][0] != 'solved']
    print(f"\n{len(levels)} levels; problems in: {bad or 'none'}", flush=True)
    for idx in sorted(show_ids): print(show(levels[idx-1]), flush=True)
    sys.exit(1 if bad else 0)

if __name__ == '__main__': main()
