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

/**
 * Can block `b` move by (dc, dr) in the given level, without leaving the board,
 * hitting a wall, or overlapping another block in `blocks`?
 */
export function canMove(b, dc, dr, level, blocks) {
  const test = { ...b, col: b.col + dc, row: b.row + dr };
  for (const { c, r } of cellsOf(test)) {
    if (c < 0 || c >= level.cols || r < 0 || r >= level.rows) return false;
  }
  if (level.walls && level.walls.length) {
    const ws = new Set(level.walls.map(w => w.col + ',' + w.row));
    for (const { c, r } of cellsOf(test)) {
      if (ws.has(c + ',' + r)) return false;
    }
  }
  for (const o of blocks) {
    if (o.id === b.id) continue;
    if (overlaps(test, o)) return false;
  }
  return true;
}

/** Is block `b` fully aligned with gate `g` (matching color assumed)? */
export function atGate(b, g, level) {
  const cells = cellsOf(b);
  const sz = g.size || 1;
  if (g.side === 'right') {
    const edge = cells.filter(({ c }) => c === level.cols - 1);
    return edge.length > 0 && edge.every(({ r }) => r >= g.exit_row && r < g.exit_row + sz);
  }
  if (g.side === 'left') {
    const edge = cells.filter(({ c }) => c === 0);
    return edge.length > 0 && edge.every(({ r }) => r >= g.exit_row && r < g.exit_row + sz);
  }
  if (g.side === 'bottom') {
    const edge = cells.filter(({ r }) => r === level.rows - 1);
    return edge.length > 0 && edge.every(({ c }) => c >= g.exit_col && c < g.exit_col + sz);
  }
  if (g.side === 'top') {
    const edge = cells.filter(({ r }) => r === 0);
    return edge.length > 0 && edge.every(({ c }) => c >= g.exit_col && c < g.exit_col + sz);
  }
  return false;
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
