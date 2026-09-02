"""Hand-authored replacement levels with varied board shapes.
Each level is an ASCII map: '.' empty, '#' wall, letters = block cells
(same letter = same block). LEGEND maps letter -> (id, color, dir).
Run:  python3 tools/designs.py            # audit + print
      python3 tools/designs.py --apply    # write into data/levels.json
"""
import json, sys
sys.path.insert(0, 'tools')
import audit, levelfmt

def build(label, rows, legend, gates):
    H = len(rows); W = len(rows[0])
    assert all(len(r) == W for r in rows), label
    walls, cells = [], {}
    for r, line in enumerate(rows):
        for c, ch in enumerate(line):
            if ch == '#': walls.append({"col": c, "row": r})
            elif ch != '.': cells.setdefault(ch, []).append((c, r))
    blocks = []
    for ch, (bid, color, d) in legend.items():
        cs = cells[ch]; c0 = min(c for c, _ in cs); r0 = min(r for _, r in cs)
        blocks.append({"id": bid, "col": c0, "row": r0,
                       "shape": [[c - c0, r - r0] for c, r in sorted(cs, key=lambda p: (p[1], p[0]))],
                       "color": color, "dir": d})
    assert set(cells) == set(legend), (label, set(cells) ^ set(legend))
    gs = []
    for side, color, size, pos in gates:
        g = {"side": side, "color": color, "size": size}
        g["exit_row" if side in ("left", "right") else "exit_col"] = pos
        gs.append(g)
    lv = {"cols": W, "rows": H, "label": label, "blocks": blocks, "gates": gs}
    if walls: lv["walls"] = walls
    return lv

DESIGNS = {}

# ── 31: The Tower — tall and narrow ──────────────────────────────
DESIGNS[31] = build("Level 31", [
    "..PP..",
    "..PP..",
    "RRR...",
    "#....#",
    ".B.YY.",
    ".B..T.",
    ".B..T.",
    "#....#",
    "..OOO.",
    "K.....",
], {
    'P': ('sq1', 'purple', 'free'), 'R': ('r1', 'red', 'free'), 'B': ('b1', 'blue', 'v'),
    'Y': ('y1', 'yellow', 'free'), 'T': ('t1', 'teal', 'free'), 'O': ('o1', 'orange', 'free'),
    'K': ('pk1', 'pink', 'free'),
}, [
    ("top", "purple", 2, 3), ("right", "red", 1, 2), ("bottom", "blue", 1, 1),
    ("left", "yellow", 1, 4), ("right", "teal", 2, 5), ("bottom", "orange", 3, 3),
    ("top", "pink", 1, 0),
])

# ── 44: The River — wide and short, two bridges ───────────────────
DESIGNS[44] = build("Level 44", [
    "RRR..B.....",
    ".....B.TTT.",
    "###.###.###",
    ".OO....YY.G",
    ".OO........",
], {
    'R': ('r1', 'red', 'free'), 'B': ('b1', 'blue', 'free'), 'T': ('t1', 'teal', 'free'),
    'O': ('sq1', 'orange', 'free'), 'Y': ('y1', 'yellow', 'free'), 'G': ('g1', 'green', 'free'),
}, [
    ("right", "red", 1, 0), ("bottom", "blue", 1, 5), ("left", "teal", 1, 1),
    ("bottom", "orange", 2, 4), ("bottom", "yellow", 2, 7), ("top", "green", 1, 9),
])

# ── 47: The Ring — a solid block in the middle, everything circulates ──
DESIGNS[47] = build("Level 47", [
    "RRR...P..",
    "......PB.",
    "..YY...B.",
    "T..###...",
    "T..###..O",
    "T..###..O",
    ".......K.",
    "GG.....K.",
    "......VV.",
], {
    'R': ('r1', 'red', 'free'), 'P': ('p1', 'purple', 'v'), 'B': ('b1', 'blue', 'free'),
    'Y': ('y1', 'yellow', 'free'), 'T': ('t1', 'teal', 'free'), 'O': ('o1', 'orange', 'free'),
    'K': ('pk1', 'pink', 'free'), 'G': ('g1', 'green', 'free'), 'V': ('p2', 'purple', 'free'),
}, [
    ("right", "red", 1, 7), ("bottom", "purple", 2, 6), ("left", "blue", 2, 0),
    ("top", "yellow", 2, 6), ("bottom", "teal", 1, 0), ("top", "orange", 1, 7),
    ("left", "pink", 2, 5), ("right", "green", 1, 3),
])

# ── 49: The Cross — walled-off corners make a plus-shaped arena ───
DESIGNS[49] = build("Level 49", [
    "##.RRR.##",
    "##..B..##",
    "..P.B..YY",
    "..P....T.",
    "O.....KT.",
    "O.GG..K..",
    "##.....##",
    "##.SS..##",
], {
    'R': ('r1', 'red', 'free'), 'B': ('b1', 'blue', 'v'), 'P': ('p1', 'purple', 'free'),
    'Y': ('y1', 'yellow', 'free'), 'T': ('t1', 'teal', 'free'), 'O': ('o1', 'orange', 'free'),
    'K': ('pk1', 'pink', 'free'), 'G': ('g1', 'green', 'free'), 'S': ('p2', 'purple', 'free'),
}, [
    ("bottom", "red", 3, 3), ("bottom", "blue", 1, 4), ("left", "purple", 2, 4),
    ("left", "yellow", 2, 2), ("top", "teal", 1, 5), ("right", "orange", 2, 3),
    ("top", "pink", 1, 3), ("right", "green", 1, 5),
])

# ── 57: The Staircase — a diagonal wall splits the board ──────────
DESIGNS[57] = build("Level 57", [
    "RRR....B",
    "#......B",
    ".#.PP...",
    "..#PP.Y.",
    "T.....Y.",
    "TT..#...",
    ".....#..",
    ".O.KK.#.",
    ".O......",
], {
    'R': ('r1', 'red', 'free'), 'B': ('b1', 'blue', 'free'), 'P': ('sq1', 'purple', 'free'),
    'Y': ('y1', 'yellow', 'v'), 'T': ('t1', 'teal', 'free'), 'O': ('o1', 'orange', 'h'),
    'K': ('pk1', 'pink', 'free'),
}, [
    ("right", "red", 1, 0), ("bottom", "blue", 1, 3), ("right", "purple", 2, 2),
    ("top", "yellow", 1, 6), ("bottom", "teal", 2, 0), ("left", "orange", 2, 7),
    ("bottom", "pink", 2, 4),
])

# ── 60: Grand Finale — four pillars, big open floor ───────────────
DESIGNS[60] = build("Level 60", [
    "RRR...B..K",
    "......B..K",
    "..##...##.",
    "..##.T.##.",
    "P....T....",
    "P...GG...O",
    "..##...##O",
    "..##...##.",
    ".YY....VV.",
    "..........",
], {
    'R': ('r1', 'red', 'free'), 'B': ('b1', 'blue', 'free'), 'K': ('pk1', 'pink', 'v'),
    'T': ('t1', 'teal', 'free'), 'P': ('p1', 'purple', 'free'), 'G': ('g1', 'green', 'free'),
    'O': ('o1', 'orange', 'free'), 'Y': ('y1', 'yellow', 'free'), 'V': ('p2', 'purple', 'free'),
}, [
    ("right", "red", 1, 9), ("bottom", "blue", 1, 4), ("bottom", "pink", 1, 9),
    ("top", "teal", 1, 5), ("right", "purple", 2, 4), ("left", "green", 1, 9),
    ("left", "orange", 2, 5), ("top", "yellow", 2, 0),
])

def main():
    apply = '--apply' in sys.argv
    ok = True
    for n, lv in sorted(DESIGNS.items()):
        lvn = audit.norm(lv)
        issues = []
        walls = {(w['col'], w['row']) for w in lvn['walls']}
        stuck = [b['id'] for b in lvn['blocks'] if not audit.solo_reachable(lvn, b, walls)]
        if stuck: status, info = 'stuck', ', '.join(stuck)
        else: status, info = audit.solve(lvn, budget=600_000, time_cap=90)
        print(f"{n:2d} {status:<10} {info}", flush=True)
        if status != 'solved': ok = False
        print(audit.show(lvn), flush=True)
    if apply:
        if not ok: sys.exit("not applying: some designs are not solvable")
        L = json.load(open('data/levels.json'))
        for n, lv in DESIGNS.items(): L[n-1] = lv
        open('data/levels.json', 'w').write(levelfmt.dump(L))
        print("applied", sorted(DESIGNS))

if __name__ == '__main__': main()
