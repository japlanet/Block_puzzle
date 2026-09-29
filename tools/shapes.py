"""Board shapes and piece shapes for tools/generate.py.

BOARDS: hand-drawn board outlines. 'o' is a board cell, '.' a hole (cut out
of the board, drawn as empty space), '#' a rock (a wall cell on the board).
Keep them at most 10 wide and 11 tall so cells stay big on an iPad.

PIECES: every piece shape the generator may use, as rows of 'x'. All
rotations and mirror images are derived automatically.
"""

BOARDS = {
    'heart': [
        ".ooo..ooo.",
        "oooooooooo",
        "oooooooooo",
        "oooooooooo",
        "oooooooooo",
        ".oooooooo.",
        "..oooooo..",
        "...oooo...",
        "....oo....",
    ],
    'house': [
        "....o....",
        "...ooo...",
        "..ooooo..",
        ".ooooooo.",
        "ooooooooo",
        ".ooooooo.",
        ".ooooooo.",
        ".ooooooo.",
        ".ooooooo.",
        ".ooooooo.",
    ],
    'fish': [
        "..oooo....",
        ".oooooo..o",
        "oooooooooo",
        "oooooooooo",
        "oooooooooo",
        ".oooooo..o",
        "..oooo....",
    ],
    'plus': [
        "...oooo...",
        "...oooo...",
        "...oooo...",
        "oooooooooo",
        "oooooooooo",
        "oooooooooo",
        "oooooooooo",
        "...oooo...",
        "...oooo...",
        "...oooo...",
    ],
    'ell': [
        "oooo.....",
        "oooo.....",
        "oooo.....",
        "oooo.....",
        "oooo.....",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
    ],
    'tee': [
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "..ooooo..",
        "..ooooo..",
        "..ooooo..",
        "..ooooo..",
        "..ooooo..",
    ],
    'horseshoe': [
        "ooo....ooo",
        "ooo....ooo",
        "ooo....ooo",
        "ooo....ooo",
        "ooo....ooo",
        "oooooooooo",
        "oooooooooo",
        "oooooooooo",
    ],
    'donut': [
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "ooo...ooo",
        "ooo...ooo",
        "ooo...ooo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
    ],
    'diamond': [
        "...ooo...",
        "..ooooo..",
        ".ooooooo.",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        ".ooooooo.",
        "..ooooo..",
        "...ooo...",
    ],
    'octagon': [
        "..ooooo..",
        ".ooooooo.",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        ".ooooooo.",
        "..ooooo..",
    ],
    'hourglass': [
        "ooooooooo",
        "ooooooooo",
        ".ooooooo.",
        "..ooooo..",
        "...ooo...",
        "..ooooo..",
        ".ooooooo.",
        "ooooooooo",
        "ooooooooo",
    ],
    'rooms': [
        "oooo..oooo",
        "oooo..oooo",
        "oooooooooo",
        "oooo..oooo",
        "oooo..oooo",
        "oooooooooo",
        "oooo..oooo",
    ],
    'stairs': [
        "ooo......",
        "oooo.....",
        "ooooo....",
        "oooooo...",
        "ooooooo..",
        "oooooooo.",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
    ],
    'tree': [
        "....o....",
        "...ooo...",
        "..ooooo..",
        ".ooooooo.",
        "..ooooo..",
        ".ooooooo.",
        "ooooooooo",
        ".ooooooo.",
        "...ooo...",
        "...ooo...",
    ],
    'mushroom': [
        "..ooooo..",
        ".ooooooo.",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "...ooo...",
        "...ooo...",
        "..ooooo..",
    ],
    'cat': [
        "oo.....oo",
        "ooo...ooo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        ".ooooooo.",
        "..ooooo..",
    ],
    'butterfly': [
        "ooo....ooo",
        "oooo..oooo",
        "oooooooooo",
        ".oooooooo.",
        "..oooooo..",
        ".oooooooo.",
        "oooooooooo",
        "oooo..oooo",
        "ooo....ooo",
    ],
    'castle': [
        "oo.ooo.oo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "ooo...ooo",
        "ooo...ooo",
    ],
    'boat': [
        "....o.....",
        "....oo....",
        "....ooo...",
        "....oooo..",
        "oooooooooo",
        "oooooooooo",
        "oooooooooo",
        ".oooooooo.",
        "..oooooo..",
    ],
    'hook': [
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "oooo.....",
        "oooo.....",
        "oooo.....",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
    ],
    'crown': [
        "o...o...o",
        "oo.ooo.oo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
    ],
    'aitch': [
        "ooo...ooo",
        "ooo...ooo",
        "ooo...ooo",
        "ooooooooo",
        "ooooooooo",
        "ooooooooo",
        "ooo...ooo",
        "ooo...ooo",
        "ooo...ooo",
    ],
    'pond': [
        "oooooooooo",
        "oooooooooo",
        "oo....oooo",
        "oo....oooo",
        "oooooooooo",
        "oooooooooo",
        "oooooooooo",
    ],
    'tall': [
        "oooooo",
        "oooooo",
        "oooooo",
        "oooooo",
        "oooooo",
        "oooooo",
        "oooooo",
        "oooooo",
        "oooooo",
        "oooooo",
    ],
    'wide': [
        "oooooooooo",
        "oooooooooo",
        "oooooooooo",
        "oooooooooo",
        "oooooooooo",
        "oooooooooo",
    ],
    'rocks': [
        "oooooooo",
        "oooooooo",
        "oo#oo#oo",
        "oooooooo",
        "oooooooo",
        "oo#oo#oo",
        "oooooooo",
        "oooooooo",
    ],
    'zigzag': [
        "oooooooo..",
        "oooooooo..",
        "oooooooo..",
        "oooooooooo",
        "..oooooooo",
        "..oooooooo",
        "..oooooooo",
    ],
}

PIECES = {
    # small
    'I1': ["x"],
    'I2': ["xx"],
    'I3': ["xxx"],
    'L3': ["x.", "xx"],
    # four
    'I4': ["xxxx"],
    'O4': ["xx", "xx"],
    'L4': ["x.", "x.", "xx"],
    'T4': ["xxx", ".x."],
    'S4': [".xx", "xx."],
    # five
    'P5': ["xx", "xx", "x."],
    'U5': ["x.x", "xxx"],
    'L5': ["x.", "x.", "x.", "xx"],
    'T5': ["xxx", ".x.", ".x."],
    'X5': [".x.", "xxx", ".x."],
    'V5': ["x..", "x..", "xxx"],
    'N5': ["xx..", ".xxx"],
    # big
    'R6': ["xx", "xx", "xx"],
    'C6': ["xx", "x.", "xx"] ,
}


def parse_piece(rows):
    return sorted((c, r) for r, line in enumerate(rows) for c, ch in enumerate(line) if ch == 'x')


def normalize(cells):
    mc = min(c for c, _ in cells); mr = min(r for _, r in cells)
    return tuple(sorted((c - mc, r - mr) for c, r in cells))


def orientations(cells):
    """All distinct rotations and mirror images of a piece."""
    out = set()
    cur = cells
    for _ in range(4):
        cur = [(-r, c) for c, r in cur]
        out.add(normalize(cur))
        out.add(normalize([(-c, r) for c, r in cur]))
    return sorted(out)


def transform_board(rows, mirror=False, flip=False, rotate=0):
    """Mirror (left-right), flip (top-bottom) and rotate a board drawing."""
    g = [list(r) for r in rows]
    if mirror: g = [r[::-1] for r in g]
    if flip: g = g[::-1]
    for _ in range(rotate % 4):
        g = [list(r) for r in zip(*g[::-1])]
    return [''.join(r) for r in g]
