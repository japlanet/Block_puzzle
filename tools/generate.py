#!/usr/bin/env python3
"""Generate levels 11-60 from the plan below: a hand-drawn board shape per level
(tools/shapes.py), randomly placed pieces from a wide set of shapes, doors on
every side (including the inner edges of a shape), and frozen animals / keys
and padlocks brought in gradually. Every candidate is proven solvable by the
audit's exhaustive search and kept only if its solution length sits in the
same band as the original levels (about 15-25 moves, 8-10 animals).

  python3 tools/generate.py                 # generate all planned levels, print maps
  python3 tools/generate.py --only 20,28    # just these levels
  python3 tools/generate.py --apply         # also write them into data/levels.json
  python3 tools/generate.py --seed 7        # different random draw

Levels are deterministic for a given --seed, so a level can be regenerated
by changing its entry in PLAN (or its per-level seed) without touching the rest.
"""
import json, random, sys, time
from collections import deque
from multiprocessing import Pool

sys.path.insert(0, 'tools')
import audit, levelfmt
from shapes import BOARDS, PIECES, parse_piece, orientations, transform_board

COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal']
ID = {'red': 'r', 'blue': 'b', 'green': 'g', 'yellow': 'y', 'purple': 'p', 'orange': 'o', 'pink': 'k', 'teal': 't'}
ORIENTS = {name: orientations(parse_piece(rows)) for name, rows in PIECES.items()}
STRAIGHT = {'I2', 'I3', 'I4', 'R6'}

# ── The plan ─────────────────────────────────────────────────────
# level: (board, transform, mechanics)
#   transform: dict for shapes.transform_board (mirror/flip/rotate)
#   mechanics: 'ice' (1 frozen animal), 'ice2' (2 frozen), 'ice3' (up to 3
#   snowflakes), 'gate' (key + padlocked door), 'block' (key + padlocked animal)
PLAN = {
    11: ('heart', {}, []),
    12: ('house', {}, []),
    13: ('fish', {}, []),
    14: ('plus', {}, []),
    15: ('ell', {'mirror': True}, []),
    16: ('tee', {}, []),
    17: ('horseshoe', {}, []),
    18: ('donut', {}, []),
    19: ('octagon', {}, []),
    20: ('cat', {}, ['ice1']),                    # first frozen animal (1 snowflake)
    21: ('mushroom', {}, ['ice1']),
    22: ('rooms', {}, []),
    23: ('boat', {}, ['ice']),
    24: ('hourglass', {}, []),
    25: ('stairs', {}, ['ice']),
    26: ('butterfly', {}, ['ice']),
    27: ('tree', {}, []),
    28: ('crown', {}, ['gate']),                  # first key + padlocked door
    29: ('hook', {}, ['gate']),
    30: ('diamond', {}, ['ice']),
    31: ('tall', {}, ['gate']),
    32: ('castle', {}, ['block']),                # first padlocked animal
    33: ('heart', {'flip': True}, ['block']),
    34: ('pond', {}, ['ice']),
    35: ('aitch', {}, ['gate']),
    36: ('zigzag', {}, []),
    37: ('fish', {'mirror': True}, ['block']),
    38: ('wide', {}, ['ice2']),
    39: ('plus', {}, ['gate', 'ice']),
    40: ('house', {'rotate': 1}, ['block']),
    41: ('donut', {}, ['ice3']),
    42: ('cat', {'flip': True}, ['gate']),
    43: ('ell', {'rotate': 2}, ['ice', 'block']),
    44: ('rocks', {}, []),
    45: ('butterfly', {'rotate': 1}, ['gate', 'ice']),
    46: ('horseshoe', {'flip': True}, ['block', 'ice']),
    47: ('tee', {'rotate': 1}, ['ice2']),
    48: ('octagon', {}, ['gate', 'block']),
    49: ('boat', {'mirror': True}, ['ice3']),
    50: ('stairs', {'mirror': True}, ['block']),
    51: ('rooms', {'rotate': 1}, ['ice', 'gate']),
    52: ('mushroom', {'flip': True}, ['block', 'ice']),
    53: ('crown', {'flip': True}, ['ice2']),
    54: ('hourglass', {'rotate': 1}, ['gate', 'ice']),
    55: ('tree', {'mirror': True}, ['block', 'ice']),
    56: ('hook', {'rotate': 1}, ['ice2']),
    57: ('pond', {'flip': True}, ['gate', 'block']),
    58: ('zigzag', {'mirror': True}, ['ice', 'gate']),
    59: ('diamond', {}, ['ice2', 'gate']),
    60: ('heart', {}, ['ice', 'gate', 'block']),
}


def target(n):
    """Solution-length band (audit best-first moves) and the move count to aim
    for inside it, rising gently from about 17 (level 11) to 22 (level 60).
    The original levels 11-60 had 13-25 moves (about 19 on average)."""
    aim = 17 + 5 * (n - 11) / 49
    if n <= 20: return (15, 22), aim
    if n <= 40: return (16, 24), aim
    return (17, 25), aim


def animal_range(n, area):
    """About one animal per 7 board cells (as in the original levels), one
    more allowed after level 40, 6-10 in all."""
    base = round(area / 6.8)
    return max(6, base - 1), max(6, min(10, base + (1 if n > 40 else 0)))


def piece_weights(n):
    small = {'I1': 0.2, 'I2': 2.2, 'I3': 2.4, 'L3': 2.4}
    four = {'I4': 1.3, 'O4': 1.5, 'L4': 2.0, 'T4': 1.5, 'S4': 1.1}
    five = {'P5': 1.0, 'U5': 0.7, 'L5': 0.7, 'T5': 0.5, 'X5': 0.35, 'V5': 0.6, 'N5': 0.5}
    big = {'R6': 0.35, 'C6': 0.3}
    if n <= 19:
        scale = {'small': 1.2, 'four': 1.0, 'five': 0.5, 'big': 0.4}
    elif n <= 39:
        scale = {'small': 1.0, 'four': 1.0, 'five': 0.9, 'big': 0.8}
    else:
        scale = {'small': 0.9, 'four': 1.0, 'five': 1.1, 'big': 1.0}
    w = {}
    for grp, d in (('small', small), ('four', four), ('five', five), ('big', big)):
        for k, v in d.items(): w[k] = v * scale[grp]
    return w


# ── Board helpers ────────────────────────────────────────────────
def make_board(name, tf):
    rows = transform_board(BOARDS[name], **tf)
    H, W = len(rows), len(rows[0])
    holes = [(c, r) for r in range(H) for c in range(W) if rows[r][c] == '.']
    rocks = [(c, r) for r in range(H) for c in range(W) if rows[r][c] == '#']
    return W, H, holes, rocks


def base_level(n, W, H, holes, rocks):
    lv = {"cols": W, "rows": H, "label": f"Level {n}", "blocks": [], "gates": []}
    if rocks: lv["walls"] = [{"col": c, "row": r} for c, r in rocks]
    if holes: lv["holes"] = [{"col": c, "row": r} for c, r in holes]
    return lv


def candidate_gates(lvn):
    out = []
    for side in ('left', 'right', 'top', 'bottom'):
        vertical = side in ('left', 'right')
        n = lvn['rows'] if vertical else lvn['cols']
        for size in (1, 2, 3):
            for start in range(0, n - size + 1):
                g = {'side': side, 'size': size, ('exit_row' if vertical else 'exit_col'): start}
                g['_line'] = audit.gate_line(g, lvn)
                if g['_line'] is not None: out.append(g)
    return out


def gate_cells(g):
    sz = g['size']; ln = g['_line']; s = g['side']
    if s in ('left', 'right'):
        x = ln + 1 if s == 'right' else ln - 1
        return {(x, r) for r in range(g['exit_row'], g['exit_row'] + sz)}
    y = ln + 1 if s == 'bottom' else ln - 1
    return {(c, y) for c in range(g['exit_col'], g['exit_col'] + sz)}


def reachable(shape, start, dirs, blocked, W, H):
    """Anchor positions a piece can reach alone (single-cell steps)."""
    def fits(c, r):
        return all(0 <= c + dc < W and 0 <= r + dr < H and (c + dc, r + dr) not in blocked for dc, dr in shape)
    seen = {start}; q = deque([start])
    while q:
        c, r = q.popleft()
        for dc, dr in dirs:
            p = (c + dc, r + dr)
            if p not in seen and fits(*p):
                seen.add(p); q.append(p)
    return seen


def path_cells(shape, start, goal_ok, dirs, blocked, W, H):
    """Cells swept by a shortest single-step path to any position with goal_ok."""
    def fits(c, r):
        return all(0 <= c + dc < W and 0 <= r + dr < H and (c + dc, r + dr) not in blocked for dc, dr in shape)
    prev = {start: None}; q = deque([start]); end = None
    while q:
        p = q.popleft()
        if goal_ok(p): end = p; break
        for dc, dr in dirs:
            n = (p[0] + dc, p[1] + dr)
            if n not in prev and fits(*n):
                prev[n] = p; q.append(n)
    cells = set()
    while end is not None:
        cells.update((end[0] + dc, end[1] + dr) for dc, dr in shape)
        end = prev[end]
    return cells


# ── One candidate ────────────────────────────────────────────────
def build(n, rng):
    name, tf, mech = PLAN[n]
    W, H, holes, rocks = make_board(name, tf)
    lv = base_level(n, W, H, holes, rocks)
    lvn = audit.norm(lv)
    blocked = set(lvn['_blocked'])
    area = W * H - len(blocked)
    nlo, nhi = animal_range(n, area)
    want = rng.randint(nlo, nhi)
    fill_max = 0.5 * area
    weights = piece_weights(n)
    names = list(weights); wts = [weights[k] for k in names]

    occ = set(blocked)
    pieces = []
    tries = 0
    while len(pieces) < want and tries < 400:
        tries += 1
        filled = sum(len(p['shape']) for p in pieces)
        pname = rng.choices(names, wts)[0]
        if filled + len(ORIENTS[pname][0]) > fill_max: continue
        shape = rng.choice(ORIENTS[pname])
        spots = [(c, r) for c in range(W) for r in range(H)
                 if all(0 <= c + dc < W and 0 <= r + dr < H and (c + dc, r + dr) not in occ for dc, dr in shape)]
        if not spots: continue
        c, r = rng.choice(spots)
        occ.update((c + dc, r + dr) for dc, dr in shape)
        d = 'free'
        if pname in STRAIGHT and rng.random() < 0.22:
            w = max(x for x, _ in shape) + 1; h = max(y for _, y in shape) + 1
            along = 'h' if w > h else 'v'
            d = along if rng.random() < 0.75 else ('v' if along == 'h' else 'h')
        pieces.append({'name': pname, 'shape': list(shape), 'col': c, 'row': r, 'dir': d})
    if len(pieces) < want: return None

    # Colours: all different where possible, sometimes a pair shares a colour.
    cols = COLORS[:]; rng.shuffle(cols)
    k = len(pieces)
    distinct = min(8, k) - (1 if rng.random() < 0.3 and k >= 6 else 0)
    palette = cols[:distinct]
    colours = palette + [rng.choice(palette) for _ in range(k - distinct)]
    rng.shuffle(colours)
    for p, c in zip(pieces, colours): p['color'] = c

    # Doors. For each piece, which candidate doors can it reach alone?
    cands = candidate_gates(lvn)
    per_piece = []
    for p in pieces:
        dirs = audit.DIRS[p['dir']]
        pos = reachable(p['shape'], (p['col'], p['row']), dirs, blocked, W, H)
        ok = []
        for gi, g in enumerate(cands):
            if any(audit.at_gate(p['shape'], c, r, g, lvn) for c, r in pos): ok.append(gi)
        if not ok: return None
        per_piece.append(set(ok))

    used_cells = set(); side_use = {s: 0 for s in ('left', 'right', 'top', 'bottom')}
    gates = []
    by_colour = {}
    for i, p in enumerate(pieces): by_colour.setdefault(p['color'], []).append(i)
    order = list(by_colour); rng.shuffle(order)
    for colour in order:
        idxs = by_colour[colour]
        shared = set.intersection(*(per_piece[i] for i in idxs))
        groups = [idxs] if shared and rng.random() < 0.75 else [[i] for i in idxs]
        for grp in groups:
            opts = set.intersection(*(per_piece[i] for i in grp))
            best = None
            for gi in opts:
                g = cands[gi]
                cells = gate_cells(g)
                # Keep doors apart: no shared or touching outside cells.
                near = {(x + dx, y + dy) for x, y in cells for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
                if near & used_cells: continue
                minsize = min(cands[j]['size'] for j in opts if cands[j]['side'] == g['side'])
                score = side_use[g['side']] * 1.5 + (g['size'] - minsize) * (0.6 if rng.random() < 0.7 else -0.3) + rng.random() * 1.2
                # Discourage a door the piece can already slide straight into.
                if any(direct_exit(pieces[i], g, pieces, lvn) for i in grp): score += 2.5
                if best is None or score < best[0]: best = (score, gi)
            if best is None: return None
            g = dict(cands[best[1]]); g['color'] = colour
            gates.append(g); used_cells |= gate_cells(g); side_use[g['side']] += 1

    # Special animals.
    rng_mech = list(mech)
    ice_n = {'ice1': (1, 1, 1), 'ice': (1, 1, 2), 'ice2': (2, 1, 2), 'ice3': (1, 2, 3)}
    frozen = set()
    for m in rng_mech:
        if m in ice_n:
            count, lo, hi = ice_n[m]
            ranked = rank_blockers(pieces, gates, lvn, blocked, W, H)
            for _ in range(count):
                choices = [i for i in ranked[:4] if i not in frozen]
                if not choices: return None
                i = rng.choice(choices); frozen.add(i)
                pieces[i]['ice'] = rng.randint(lo, min(hi, len(pieces) - 1))
    if 'gate' in rng_mech or 'block' in rng_mech:
        others = [i for i in range(len(pieces)) if i not in frozen]
        key = rng.choice(others)
        pieces[key]['key'] = True
        if 'gate' in rng_mech:
            opts = [g for g in gates if g['color'] != pieces[key]['color']]
            if not opts: return None
            rng.choice(opts)['lock'] = True
        if 'block' in rng_mech:
            opts = [i for i in others if i != key]
            if not opts: return None
            pieces[rng.choice(opts)]['lock'] = True

    # Assemble.
    counters = {}
    for p in pieces:
        counters[p['color']] = counters.get(p['color'], 0) + 1
        b = {"id": f"{ID[p['color']]}{counters[p['color']]}", "col": p['col'], "row": p['row'],
             "shape": [list(x) for x in sorted(p['shape'], key=lambda t: (t[1], t[0]))],
             "color": p['color'], "dir": p['dir']}
        for k2 in ('ice', 'key', 'lock'):
            if p.get(k2): b[k2] = p[k2]
        lv['blocks'].append(b)
    for g in gates:
        out = {"side": g['side'], "color": g['color'], "size": g['size']}
        pos = 'exit_row' if g['side'] in ('left', 'right') else 'exit_col'
        out[pos] = g[pos]
        if g.get('lock'): out['lock'] = True
        lv['gates'].append(out)
    order = ['cols', 'rows', 'label', 'blocks', 'gates', 'walls', 'holes']
    return {k2: lv[k2] for k2 in order if k2 in lv}


def direct_exit(p, g, pieces, lvn):
    """Can piece p slide straight into gate g from its start, with everyone else in place?"""
    W, H = lvn['cols'], lvn['rows']
    occ = set(lvn['_blocked'])
    for q in pieces:
        if q is not p: occ.update((q['col'] + dc, q['row'] + dr) for dc, dr in q['shape'])
    for dc, dr in audit.DIRS[p['dir']]:
        c, r = p['col'], p['row']
        while True:
            c += dc; r += dr
            if not all(0 <= c + x < W and 0 <= r + y < H and (c + x, r + y) not in occ for x, y in p['shape']): break
            if audit.at_gate(p['shape'], c, r, g, lvn): return True
    return False


def rank_blockers(pieces, gates, lvn, blocked, W, H):
    """Pieces ordered by how many other pieces' shortest way home they sit on."""
    hits = [0] * len(pieces)
    for j, p in enumerate(pieces):
        gs = [g for g in gates if g['color'] == p['color']]
        ok = lambda pos: any(audit.at_gate(p['shape'], pos[0], pos[1], g, lvn) for g in gs)
        cells = path_cells(p['shape'], (p['col'], p['row']), ok, audit.DIRS[p['dir']], blocked, W, H)
        for i, q in enumerate(pieces):
            if i != j and any((q['col'] + dc, q['row'] + dr) in cells for dc, dr in q['shape']): hits[i] += 1
    order = list(range(len(pieces)))
    order.sort(key=lambda i: -hits[i])
    return order


def starts_home(lv):
    """Number of animals that can slide straight home at the very start."""
    lvn = audit.norm(lv)
    pieces = [{'shape': b['shape'], 'col': b['col'], 'row': b['row'], 'dir': b['dir'], 'color': b['color'],
               'ice': b.get('ice'), 'lock': b.get('lock')} for b in lvn['blocks']]
    n = 0
    for p in pieces:
        if p['ice'] or p['lock']: continue
        if any(direct_exit(p, g, pieces, lvn) for g in lvn['gates'] if g['color'] == p['color'] and not g.get('lock')):
            n += 1
    return n


def starts_at_door(lvn):
    """Does any animal start already sitting at an open door of its colour?"""
    return any(not b.get('ice') and not b.get('lock') and
               any(audit.at_gate(b['shape'], b['col'], b['row'], g, lvn) for g in lvn['gates']
                   if g['color'] == b['color'] and not g.get('lock'))
               for b in lvn['blocks'])


def generate(args):
    n, seed, max_time = args
    rng = random.Random(seed * 1000 + n)
    jitter = rng.uniform(-2, 2)
    t0 = time.time(); best = None; accepted = 0; tried = 0
    while time.time() - t0 < max_time and accepted < 8:
        tried += 1
        lv = build(n, rng)
        if lv is None: continue
        lvn = audit.norm(lv)
        if audit.validate(lvn): continue
        if any(not audit.solo_reachable(lvn, b, lvn['_blocked']) for b in lvn['blocks']): continue
        free0 = starts_home(lv)
        if free0 > 1 or starts_at_door(lvn): continue
        (lo, hi), aim = target(n)
        aim += jitter
        status, depth = audit.solve(lvn, budget=120_000, time_cap=10)
        if status != 'solved' or not (lo <= depth <= hi): continue
        accepted += 1
        score = abs(depth - aim) + free0 * 1.5 + rng.random()
        if best is None or score < best[0]: best = (score, depth, lv)
    return n, (best[1] if best else None), (best[2] if best else None), tried, round(time.time() - t0)


def main():
    argv = sys.argv[1:]
    only = None; seed = 1; apply = '--apply' in argv; max_time = 150
    for i, a in enumerate(argv):
        if a == '--only': only = [int(x) for x in argv[i + 1].split(',')]
        if a == '--seed': seed = int(argv[i + 1])
        if a == '--time': max_time = int(argv[i + 1])
    todo = only or sorted(PLAN)
    results = {}
    with Pool() as pool:
        for n, depth, lv, tried, secs in pool.imap_unordered(generate, [(n, seed, max_time) for n in todo]):
            if lv is None:
                print(f"{n:2d} FAILED after {tried} tries ({secs}s)", flush=True)
                continue
            results[n] = lv
            print(f"{n:2d} {PLAN[n][0]:<10} {','.join(PLAN[n][2]) or '-':<16} moves={depth:<3} animals={len(lv['blocks'])} tries={tried} ({secs}s)", flush=True)
    for n in sorted(results):
        print(audit.show(audit.norm(results[n])).split('\n  ')[0])
    out = f'tools/generated-seed{seed}.json'
    prev = {}
    try: prev = {int(k): v for k, v in json.load(open(out)).items()}
    except Exception: pass
    prev.update(results)
    json.dump({str(k): prev[k] for k in sorted(prev)}, open(out, 'w'), indent=1)
    print('saved', out)
    if apply:
        missing = [n for n in todo if n not in results]
        if missing: sys.exit(f'not applying: failed {missing}')
        L = json.load(open('data/levels.json'))
        for n, lv in results.items(): L[n - 1] = lv
        open('data/levels.json', 'w').write(levelfmt.dump(L))
        print('applied', sorted(results))


if __name__ == '__main__':
    main()
