// Fetch levels.json and normalize shape entries for internal use.
// Accepts either [dc,dr] arrays (preferred) or {dc,dr} objects (legacy).

export async function loadLevels(url = 'data/levels.json') {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  const raw = await res.json();
  return raw.map(normalizeLevel);
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
