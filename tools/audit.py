#!/usr/bin/env python3
"""Audit data/levels.json: validate structure, check each block has a
walls-only path to its gate, and run an exhaustive BFS (blocks may stop on any
cell, mirroring player drags) to prove solvability.  Usage:
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
    return lv

def cells(shape, c, r):
    return [(c+dc, r+dr) for dc, dr in shape]

def at_gate(shape, c, r, g, lv):
    cs = cells(shape, c, r); sz = g.get('size', 1)
    if g['side'] == 'right':
        e = [rr for cc, rr in cs if cc == lv['cols']-1]
        return bool(e) and all(g['exit_row'] <= rr < g['exit_row']+sz for rr in e)
    if g['side'] == 'left':
        e = [rr for cc, rr in cs if cc == 0]
        return bool(e) and all(g['exit_row'] <= rr < g['exit_row']+sz for rr in e)
    if g['side'] == 'bottom':
        e = [cc for cc, rr in cs if rr == lv['rows']-1]
        return bool(e) and all(g['exit_col'] <= cc < g['exit_col']+sz for cc in e)
    if g['side'] == 'top':
        e = [cc for cc, rr in cs if rr == 0]
        return bool(e) and all(g['exit_col'] <= cc < g['exit_col']+sz for cc in e)
    return False

def fits(shape, c, r, occupied, lv):
    for cc, rr in cells(shape, c, r):
        if cc < 0 or cc >= lv['cols'] or rr < 0 or rr >= lv['rows']: return False
        if (cc, rr) in occupied: return False
    return True

def solo_reachable(lv, b, walls):
    """Can block b reach any matching gate with all other blocks removed?"""
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

def solve(lv, budget=400_000, time_cap=45.0):
    """Best-first search (fewest remaining blocks first, then shallowest).
    Blocks may stop on any cell, mirroring player drags.
    Returns (status, info). status: solved (info=move count) | unsolvable
    (state space exhausted) | budget (gave up; review by hand)."""
    import heapq, time
    blocks = lv['blocks']
    walls = {(w['col'], w['row']) for w in lv['walls']}
    gates = {i: [g for g in lv['gates'] if g['color'] == b['color']] for i, b in enumerate(blocks)}
    start = tuple((b['col'], b['row']) for b in blocks)   # None = exited
    parent = {start: None}
    heap = [(len(blocks), 0, 0, start)]; tick = 1
    expanded = 0; t0 = time.time()
    while heap:
        _, depth, _, st = heapq.heappop(heap); expanded += 1
        if expanded > budget or time.time() - t0 > time_cap: return 'budget', expanded
        if all(p is None for p in st): return 'solved', depth
        occ = set(walls)
        for i, p in enumerate(st):
            if p is not None: occ.update(cells(blocks[i]['shape'], *p))
        for i, p in enumerate(st):
            if p is None: continue
            b = blocks[i]; shape = b['shape']
            occ_i = occ - set(cells(shape, *p))
            for dc, dr in DIRS[b['dir']]:
                c, r = p
                while True:
                    c += dc; r += dr
                    if not fits(shape, c, r, occ_i, lv): break
                    exited = any(at_gate(shape, c, r, g, lv) for g in gates[i])
                    nst = list(st); nst[i] = None if exited else (c, r); nst = tuple(nst)
                    if nst not in parent:
                        parent[nst] = st
                        remaining = sum(1 for x in nst if x is not None)
                        heapq.heappush(heap, (remaining, depth + 1, tick, nst)); tick += 1
    return 'unsolvable', expanded

def audit_one(args):
    idx, lv, budget = args
    walls = {(w['col'], w['row']) for w in lv['walls']}
    stuck = [b['id']+'('+b['color']+'/'+b['dir']+')' for b in lv['blocks'] if not solo_reachable(lv, b, walls)]
    if stuck: return idx, 'stuck', 'no path even on an empty board: ' + ', '.join(stuck)
    status, info = solve(lv, budget)
    return idx, status, info

COL = {'red':'R','blue':'B','green':'G','yellow':'Y','purple':'P','orange':'O','pink':'K','teal':'T'}
def show(lv):
    W, H = lv['cols'], lv['rows']
    grid = [['.']*W for _ in range(H)]
    for w in lv['walls']: grid[w['row']][w['col']] = '#'
    for b in lv['blocks']:
        ch = COL[b['color']]; ch = ch if b['dir']=='free' else (ch.lower() if b['dir']=='h' else ch.lower())
        tag = ch + ({'free':'','h':'-','v':'|'}[b['dir']])
        for c, r in cells(b['shape'], b['col'], b['row']): grid[r][c] = tag.ljust(2)[:2]
    top = ['  ']*W; bot = ['  ']*W; left = ['  ']*H; right = ['  ']*H
    for g in lv['gates']:
        sz = g.get('size',1); t = COL[g['color']]*2
        if g['side']=='top':    [top.__setitem__(x, t) for x in range(g['exit_col'], g['exit_col']+sz) if 0<=x<W]
        if g['side']=='bottom': [bot.__setitem__(x, t) for x in range(g['exit_col'], g['exit_col']+sz) if 0<=x<W]
        if g['side']=='left':   [left.__setitem__(y, t) for y in range(g['exit_row'], g['exit_row']+sz) if 0<=y<H]
        if g['side']=='right':  [right.__setitem__(y, t) for y in range(g['exit_row'], g['exit_row']+sz) if 0<=y<H]
    out = [f"--- {lv['label']} ({W}x{H}) ---", '   ' + ''.join(top)]
    for y in range(H):
        out.append(left[y] + ' ' + ''.join(x.ljust(2) for x in grid[y]) + ' ' + right[y])
    out.append('   ' + ''.join(bot))
    for b in lv['blocks']:
        out.append(f"  {b['id']:>4} {b['color']:<7} dir={b['dir']:<4} at ({b['col']},{b['row']}) shape={list(b['shape'])}")
    for g in lv['gates']:
        out.append(f"  gate {g['color']:<7} {g['side']:<6} size={g.get('size',1)} exit_row={g.get('exit_row')} exit_col={g.get('exit_col')}")
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
