// Fetch levels.json and normalize shape entries for internal use.
// Accepts either [dc,dr] arrays (preferred) or {dc,dr} objects (legacy).
// Runs a validator on every loaded level — any data-integrity issue (gate
// overlap, orphan color, off-board gate, block collision) is logged to the
// console so authoring bugs surface loudly instead of stacking silently.

export async function loadLevels(url = 'data/levels.json') {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  const raw = await res.json();
  const levels = raw.map(normalizeLevel);
  for (let i = 0; i < levels.length; i++) {
    const issues = validateLevel(levels[i]);
    if (issues.length) {
      console.warn(`[levels] ${levels[i].label} has ${issues.length} issue(s):`);
      for (const msg of issues) console.warn('  • ' + msg);
    }
  }
  return levels;
}

/**
 * Returns an array of human-readable issue strings for the given level.
 * Empty array means clean. Exported so the level editor can reuse it.
 */
export function validateLevel(lv) {
  const issues = [];
  // 1. Same-side gate overlaps.
  const seen = new Map(); // cellKey → color
  for (const g of lv.gates) {
    for (const cell of gateEdgeCells(lv, g)) {
      const k = cell.join(',');
      if (seen.has(k)) {
        issues.push(`${seen.get(k)} and ${g.color} ${g.side} gates both occupy cell ${cell.join(',')}`);
      }
      seen.set(k, g.color);
    }
  }
  // 2. Gate off-board.
  for (const g of lv.gates) {
    const sz = g.size || 1;
    if (g.side === 'left' || g.side === 'right') {
      if (g.exit_row == null) { issues.push(`${g.color} ${g.side} gate missing exit_row`); continue; }
      if (g.exit_row < 0 || g.exit_row + sz > lv.rows) {
        issues.push(`${g.color} ${g.side} gate rows ${g.exit_row}..${g.exit_row + sz - 1} off-board (0..${lv.rows - 1})`);
      }
    } else if (g.side === 'top' || g.side === 'bottom') {
      if (g.exit_col == null) { issues.push(`${g.color} ${g.side} gate missing exit_col`); continue; }
      if (g.exit_col < 0 || g.exit_col + sz > lv.cols) {
        issues.push(`${g.color} ${g.side} gate cols ${g.exit_col}..${g.exit_col + sz - 1} off-board (0..${lv.cols - 1})`);
      }
    } else {
      issues.push(`unknown gate side ${JSON.stringify(g.side)}`);
    }
  }
  // 3. Orphan colors — every block color needs ≥1 gate and vice-versa.
  const blockColors = new Set(lv.blocks.map(b => b.color));
  const gateColors = new Set(lv.gates.map(g => g.color));
  for (const c of blockColors) if (!gateColors.has(c)) issues.push(`block color ${c} has no matching gate`);
  for (const c of gateColors) if (!blockColors.has(c)) issues.push(`gate color ${c} has no matching block`);
  // 4. Blocks off-board / on walls / overlapping each other.
  const walls = new Set((lv.walls || []).map(w => w.col + ',' + w.row));
  const occupied = new Map();
  for (const b of lv.blocks) {
    for (const [dc, dr] of b.shape) {
      const c = b.col + dc, r = b.row + dr;
      if (c < 0 || c >= lv.cols || r < 0 || r >= lv.rows) {
        issues.push(`block ${b.id} cell (${c},${r}) outside grid`);
      }
      const k = c + ',' + r;
      if (walls.has(k)) issues.push(`block ${b.id} overlaps wall at (${c},${r})`);
      if (occupied.has(k)) issues.push(`block ${b.id} overlaps block ${occupied.get(k)} at (${c},${r})`);
      occupied.set(k, b.id);
    }
  }
  // 5. Duplicate IDs.
  const ids = new Set();
  for (const b of lv.blocks) {
    if (ids.has(b.id)) issues.push(`duplicate block id ${b.id}`);
    ids.add(b.id);
  }
  return issues;
}

/** Return the outer-edge cells a gate occupies (one step outside the board). */
function gateEdgeCells(lv, g) {
  const sz = g.size || 1;
  const out = [];
  if (g.side === 'right')  for (let r = g.exit_row; r < g.exit_row + sz; r++) out.push([lv.cols, r]);
  if (g.side === 'left')   for (let r = g.exit_row; r < g.exit_row + sz; r++) out.push([-1, r]);
  if (g.side === 'bottom') for (let c = g.exit_col; c < g.exit_col + sz; c++) out.push([c, lv.rows]);
  if (g.side === 'top')    for (let c = g.exit_col; c < g.exit_col + sz; c++) out.push([c, -1]);
  return out;
}

function normalizeLevel(lv) {
  return {
    cols: lv.cols,
    rows: lv.rows,
    label: lv.label,
    blocks: (lv.blocks || []).map(normalizeBlock),
    gates: (lv.gates || []).map(g => ({ ...g })),
    walls: (lv.walls || []).map(w => ({ ...w })),
  };
}

function normalizeBlock(b) {
  return {
    id: b.id,
    col: b.col,
    row: b.row,
    color: b.color,
    dir: b.dir || 'free',
    shape: b.shape.map(p => Array.isArray(p) ? [p[0], p[1]] : [p.dc, p.dr]),
  };
}

/** Snapshot-clone the blocks of a level for a fresh play session. */
export function cloneBlocks(level) {
  return level.blocks.map(b => ({
    id: b.id,
    col: b.col,
    row: b.row,
    color: b.color,
    dir: b.dir,
    shape: b.shape.map(p => [p[0], p[1]]),
  }));
}
