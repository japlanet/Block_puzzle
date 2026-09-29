// Pure grid logic — no DOM, no state. Safe to call from solver or render.

/**
 * Return the absolute cells a block occupies given its anchor (col,row) and shape offsets.
 * shape is an array of [dc, dr] pairs (preferred) or {dc, dr} objects (legacy).
 */
export function cellsOf(b) {
  return b.shape.map(d => {
    if (Array.isArray(d)) return { c: b.col + d[0], r: b.row + d[1] };
    return { c: b.col + d.dc, r: b.row + d.dr };
  });
}

/** Set of "c,r" keys for a block's cells. */
export function cellSet(b) {
  const s = new Set();
  for (const { c, r } of cellsOf(b)) s.add(c + ',' + r);
  return s;
}

/** Do two blocks share any cell? */
export function overlaps(a, b) {
  const s = cellSet(a);
  return cellsOf(b).some(({ c, r }) => s.has(c + ',' + r));
}

const NONE = [];
const blockedCache = new WeakMap();   // level -> { walls, holes, nw, nh, all, holeSet }

function cellCache(level) {
  const walls = level.walls || NONE, holes = level.holes || NONE;
  let e = blockedCache.get(level);
  // The editor edits levels in place, so check the arrays haven't changed.
  if (!e || e.walls !== walls || e.holes !== holes || e.nw !== walls.length || e.nh !== holes.length) {
    const holeSet = new Set(holes.map(h => h.col + ',' + h.row));
    const all = new Set(holeSet);
    for (const w of walls) all.add(w.col + ',' + w.row);
    e = { walls, holes, nw: walls.length, nh: holes.length, all, holeSet };
    blockedCache.set(level, e);
  }
  return e;
}

/**
 * Cells a block can never enter: rocks (`walls`) and `holes`, the cells cut
 * out of the rectangle to give the board its shape. Set of "c,r" keys.
 */
export function blockedCells(level) {
  return cellCache(level).all;
}

/** Is (c,r) part of the board's shape (inside the grid and not a hole)? */
export function onBoard(level, c, r) {
  if (c < 0 || c >= level.cols || r < 0 || r >= level.rows) return false;
  return !cellCache(level).holeSet.has(c + ',' + r);
}

/**
 * Can block `b` move by (dc, dr) in the given level, without leaving the board,
 * hitting a wall or hole, or overlapping another block in `blocks`?
 */
export function canMove(b, dc, dr, level, blocks) {
  const test = { ...b, col: b.col + dc, row: b.row + dr };
  const blocked = blockedCells(level);
  for (const { c, r } of cellsOf(test)) {
    if (c < 0 || c >= level.cols || r < 0 || r >= level.rows) return false;
    if (blocked.has(c + ',' + r)) return false;
  }
  for (const o of blocks) {
    if (o.id === b.id) continue;
    if (overlaps(test, o)) return false;
  }
  return true;
}

/**
 * The board edge a gate sits on: the outermost board column (left/right gates)
 * or row (top/bottom gates) across the gate's span. On a plain rectangle that
 * is the grid edge; on a shaped board it can be an inner edge, such as the
 * inside of an L. Returns null if the span's cells don't share one edge line.
 */
const lineCache = new WeakMap();   // gate -> { key, line }

export function gateLine(g, level) {
  // Hot path for the hint search: cache per gate, keyed on everything it reads.
  const holes = level.holes || NONE;
  const key = `${level.cols},${level.rows},${holes.length},${g.side},${g.size},${g.exit_row},${g.exit_col}`;
  const hit = lineCache.get(g);
  if (hit && hit.key === key && hit.holes === holes) return hit.line;
  const line = computeGateLine(g, level);
  lineCache.set(g, { key, holes, line });
  return line;
}

function computeGateLine(g, level) {
  const sz = g.size || 1;
  const vertical = g.side === 'left' || g.side === 'right';
  const start = vertical ? g.exit_row : g.exit_col;
  let line = null;
  for (let i = start; i < start + sz; i++) {
    let edge = null;
    const n = vertical ? level.cols : level.rows;
    for (let j = 0; j < n; j++) {
      const on = vertical ? onBoard(level, j, i) : onBoard(level, i, j);
      if (!on) continue;
      if (g.side === 'left' || g.side === 'top') { edge = j; break; }
      edge = j;
    }
    if (edge === null || (line !== null && edge !== line)) return null;
    line = edge;
  }
  return line;
}

/** Is block `b` fully aligned with gate `g` (matching color assumed)? */
export function atGate(b, g, level) {
  const line = gateLine(g, level);
  if (line === null) return false;
  const cells = cellsOf(b);
  const sz = g.size || 1;
  if (g.side === 'left' || g.side === 'right') {
    const beyond = g.side === 'right' ? (({ c }) => c > line) : (({ c }) => c < line);
    if (cells.some(beyond)) return false;
    const edge = cells.filter(({ c }) => c === line);
    return edge.length > 0 && edge.every(({ r }) => r >= g.exit_row && r < g.exit_row + sz);
  }
  const beyond = g.side === 'bottom' ? (({ r }) => r > line) : (({ r }) => r < line);
  if (cells.some(beyond)) return false;
  const edge = cells.filter(({ r }) => r === line);
  return edge.length > 0 && edge.every(({ c }) => c >= g.exit_col && c < g.exit_col + sz);
}

// ── Frozen animals and padlocks ────────────────────────────────────
// Both depend only on which animals have gone home so far, so the solvers can
// work them out from the live blocks alone:
//   ice: N   — frozen until N animals (any colour) have gone home.
//   key      — carries the key; lock: true — padlocked (an animal or a door),
//              opens once every key carrier has gone home.

/** How many animals have gone home, given the live blocks. */
export function homeCount(level, blocks) {
  return level.blocks.length - blocks.length;
}

/** Snowflakes left on a frozen block (0 = thawed). */
export function iceLeft(b, level, blocks) {
  return Math.max(0, (b.ice || 0) - homeCount(level, blocks));
}

/** Are the padlocks still shut (some key carrier is still on the board)? */
export function locksShut(level, blocks) {
  return blocks.some(b => b.key);
}

/** Can this block be moved right now (not frozen, not padlocked)? */
export function isFree(b, level, blocks) {
  if (iceLeft(b, level, blocks) > 0) return false;
  if (b.lock && locksShut(level, blocks)) return false;
  return true;
}

/** Is this door open right now? */
export function gateOpen(g, level, blocks) {
  return !(g.lock && locksShut(level, blocks));
}

/** All directions a block is allowed to move, based on its `dir` lock. */
export function directionsOf(b) {
  if (b.dir === 'h') return [[-1, 0], [1, 0]];
  if (b.dir === 'v') return [[0, -1], [0, 1]];
  return [[-1, 0], [1, 0], [0, -1], [0, 1]];
}

/** Bounding box of a block's occupied cells (for rendering only). */
export function bbox(b) {
  const cs = cellsOf(b);
  const minC = Math.min(...cs.map(x => x.c));
  const maxC = Math.max(...cs.map(x => x.c));
  const minR = Math.min(...cs.map(x => x.r));
  const maxR = Math.max(...cs.map(x => x.r));
  return { minC, maxC, minR, maxR, w: maxC - minC + 1, h: maxR - minR + 1 };
}
