// Editor state: the level being edited, current tool, undo/redo stack, autosave.

const DRAFT_KEY = 'animal_escape_editor_draft';
const TEST_KEY = 'animal_escape_test_level';

export const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'];
export const ANIMAL_EMOJI = {
  red: '🦊', blue: '🐳', green: '🐸', yellow: '🐤',
  purple: '🦄', orange: '🦁', pink: '🐷', teal: '🐢',
};

function emptyLevel(cols = 8, rows = 8, label = 'My Level') {
  return { cols, rows, label, blocks: [], gates: [], walls: [] };
}

export const state = {
  level: emptyLevel(),
  // Active tool: one of
  //   { type: 'block', color: 'red', dir: 'free', pendingCells: Set<'c,r'>, editingId: string|null }
  //   { type: 'gate', color: 'red', size: 2 }
  //   { type: 'wall' }
  //   { type: 'eraser' }
  //   null
  tool: null,
  nextId: 1,
  undoStack: [],  // snapshots (deep copies of level)
  redoStack: [],
  listeners: new Set(), // change observers
};

function deepClone(lv) {
  return {
    cols: lv.cols,
    rows: lv.rows,
    label: lv.label,
    blocks: lv.blocks.map(b => ({ ...b, shape: b.shape.map(p => [p[0], p[1]]) })),
    gates: lv.gates.map(g => ({ ...g })),
    walls: lv.walls.map(w => ({ ...w })),
  };
}

export function subscribe(fn) {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}
function notify() {
  for (const fn of state.listeners) fn();
}

/**
 * Snapshot current level, run a mutator, save snapshot to undo, autosave.
 * Use this for every user-visible change.
 */
export function mutate(fn) {
  state.undoStack.push(deepClone(state.level));
  if (state.undoStack.length > 80) state.undoStack.shift();
  state.redoStack.length = 0;
  fn(state.level);
  autoSave();
  notify();
}

export function undo() {
  if (!state.undoStack.length) return false;
  state.redoStack.push(deepClone(state.level));
  state.level = state.undoStack.pop();
  autoSave();
  notify();
  return true;
}

export function redo() {
  if (!state.redoStack.length) return false;
  state.undoStack.push(deepClone(state.level));
  state.level = state.redoStack.pop();
  autoSave();
  notify();
  return true;
}

export function setTool(tool) {
  // Cancel any in-progress block construction when switching tools.
  if (state.tool && state.tool.type === 'block' && state.tool.pendingCells && state.tool.pendingCells.size && !tool) {
    // If completely clearing, discard pending (no mutate — the pending block was never committed).
  }
  state.tool = tool;
  notify();
}

export function startNewBlock(color, dir = 'free') {
  state.tool = {
    type: 'block',
    color,
    dir,
    pendingCells: new Set(),
    editingId: null,
  };
  notify();
}

export function startEditBlock(blockId) {
  const b = state.level.blocks.find(x => x.id === blockId);
  if (!b) return;
  const cells = new Set(b.shape.map(([dc, dr]) => (b.col + dc) + ',' + (b.row + dr)));
  state.tool = {
    type: 'block',
    color: b.color,
    dir: b.dir,
    pendingCells: cells,
    editingId: b.id,
  };
  notify();
}

export function togglePendingCell(col, row) {
  if (!state.tool || state.tool.type !== 'block') return;
  const k = col + ',' + row;
  if (state.tool.pendingCells.has(k)) state.tool.pendingCells.delete(k);
  else state.tool.pendingCells.add(k);
  notify();
}

export function finishPendingBlock() {
  const t = state.tool;
  if (!t || t.type !== 'block' || !t.pendingCells.size) return false;
  const cells = [...t.pendingCells].map(k => k.split(',').map(Number));
  const minC = Math.min(...cells.map(x => x[0]));
  const minR = Math.min(...cells.map(x => x[1]));
  const shape = cells.map(([c, r]) => [c - minC, r - minR]);

  mutate(lv => {
    if (t.editingId) {
      const idx = lv.blocks.findIndex(b => b.id === t.editingId);
      if (idx >= 0) {
        lv.blocks[idx] = { id: t.editingId, col: minC, row: minR, color: t.color, dir: t.dir, shape };
      }
    } else {
      // Pick an ID that isn't taken.
      let id;
      const existing = new Set(lv.blocks.map(b => b.id));
      const prefix = t.color[0];
      for (let i = 1; i < 999; i++) {
        id = prefix + i;
        if (!existing.has(id)) break;
      }
      lv.blocks.push({ id, col: minC, row: minR, color: t.color, dir: t.dir, shape });
    }
  });
  cancelPendingBlock();
  return true;
}

export function cancelPendingBlock() {
  state.tool = null;
  notify();
}

// ── Gates ────────────────────────────────────────────────────────
export function addGate({ side, color, size, exit_row, exit_col }) {
  mutate(lv => {
    const g = { side, color, size };
    if (side === 'left' || side === 'right') g.exit_row = exit_row;
    else g.exit_col = exit_col;
    lv.gates.push(g);
  });
}
export function removeGate(index) {
  mutate(lv => { lv.gates.splice(index, 1); });
}

// ── Walls ────────────────────────────────────────────────────────
export function toggleWall(col, row) {
  mutate(lv => {
    const i = lv.walls.findIndex(w => w.col === col && w.row === row);
    if (i >= 0) lv.walls.splice(i, 1);
    else lv.walls.push({ col, row });
  });
}

// ── Blocks ───────────────────────────────────────────────────────
export function removeBlock(id) {
  mutate(lv => {
    const i = lv.blocks.findIndex(b => b.id === id);
    if (i >= 0) lv.blocks.splice(i, 1);
  });
}

// ── Grid resize / label / new ────────────────────────────────────
export function resizeGrid(cols, rows) {
  mutate(lv => {
    lv.cols = cols; lv.rows = rows;
    // Drop anything that now falls outside.
    lv.blocks = lv.blocks.filter(b => {
      for (const [dc, dr] of b.shape) {
        if (b.col + dc >= cols || b.row + dr >= rows) return false;
      }
      return true;
    });
    lv.walls = lv.walls.filter(w => w.col < cols && w.row < rows);
    lv.gates = lv.gates.filter(g => {
      const sz = g.size || 1;
      if (g.side === 'left' || g.side === 'right') return g.exit_row + sz <= rows && g.exit_row >= 0;
      return g.exit_col + sz <= cols && g.exit_col >= 0;
    });
  });
}

export function setLabel(label) {
  mutate(lv => { lv.label = label; });
}

export function loadLevel(lv) {
  state.level = deepClone(lv);
  state.tool = null;
  state.undoStack.length = 0;
  state.redoStack.length = 0;
  autoSave();
  notify();
}

export function newLevel(cols = 8, rows = 8) {
  loadLevel(emptyLevel(cols, rows, 'My Level ' + new Date().toISOString().slice(0, 10)));
}

// ── Persistence ──────────────────────────────────────────────────
export function autoSave() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state.level));
  } catch (e) { /* storage full — ignore */ }
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.cols && parsed.rows) {
      state.level = deepClone(parsed);
      return true;
    }
  } catch (e) {}
  return false;
}

/** Stash the current level for test-play (picked up by index.html?test=1). */
export function stashForTestPlay() {
  try {
    localStorage.setItem(TEST_KEY, JSON.stringify(state.level));
    return true;
  } catch (e) { return false; }
}

/** True iff the level has anything worth saving. */
export function isNonEmpty(lv = state.level) {
  return lv.blocks.length > 0 || lv.gates.length > 0 || lv.walls.length > 0;
}
