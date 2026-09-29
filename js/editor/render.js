// Draw the edited level in #editorBoard.
// Reuses the same block-rendering approach as the game so WYSIWYG matches play.

import { state, ANIMAL_EMOJI } from './state.js';
import { COLORS as GAME_COLORS, createBlockElement, markWallsAndHoles, gateBox, gateLockBadge } from '../render.js';
import { gateLine } from '../geometry.js';
import { state as gameState } from '../state.js';

let cellSize = 56;
let boardEl = null;

function calcCellSize() {
  const lv = state.level;
  // Fit comfortably into the stage (mid-column of the workbench).
  const maxW = Math.min(window.innerWidth - 560, 820);
  const maxH = window.innerHeight - 180;
  cellSize = Math.max(28, Math.min(
    Math.floor((maxW - 64) / lv.cols),
    Math.floor((maxH - 120) / lv.rows),
    64,
  ));
  return cellSize;
}

export function cellSizePx() { return cellSize; }

/** Full re-render. Cheap enough on edit-sized grids that we don't bother diffing. */
export function renderAll() {
  if (!boardEl) boardEl = document.getElementById('editorBoard');
  const lv = state.level;
  calcCellSize();

  // Sync the game's shared state module so reused functions (createBlockElement,
  // positionBlockElement) see the right level + cellSize.
  gameState.level = lv;
  gameState.cellSize = cellSize;
  gameState.blocks = lv.blocks;

  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${lv.cols}, ${cellSize}px)`;
  boardEl.style.gridTemplateRows    = `repeat(${lv.rows}, ${cellSize}px)`;
  boardEl.style.width  = `${cellSize * lv.cols}px`;
  boardEl.style.height = `${cellSize * lv.rows}px`;

  // Cells, then rocks, cut-outs and the board's outline (same as the game).
  for (let r = 0; r < lv.rows; r++) {
    for (let c = 0; c < lv.cols; c++) {
      const d = document.createElement('div');
      d.className = 'cell';
      d.dataset.col = c;
      d.dataset.row = r;
      boardEl.appendChild(d);
    }
  }
  markWallsAndHoles(boardEl, lv);

  // Pending block preview: mark cells we're about to commit.
  if (state.tool && state.tool.type === 'block' && state.tool.pendingCells) {
    for (const k of state.tool.pendingCells) {
      const [c, r] = k.split(',').map(Number);
      const cell = boardEl.querySelector(`.cell[data-col="${c}"][data-row="${r}"]`);
      if (cell) cell.classList.add('pending');
    }
  }

  // Gates — render around the board.
  for (let i = 0; i < lv.gates.length; i++) {
    placeGate(lv.gates[i], i);
  }

  // Edge slots for gate placement (only when gate tool is active).
  if (state.tool && state.tool.type === 'gate') {
    renderEdgeSlots();
  }

  // Blocks.
  for (const b of lv.blocks) {
    createBlockElement(b, boardEl);
    const el = document.getElementById('bg-' + b.id);
    if (el) el.classList.remove('bg');
    if (el) el.classList.add('bg');
    if (el && state.tool && state.tool.type === 'block' && state.tool.editingId === b.id) {
      el.classList.add('selected');
    }
    if (el) el.dataset.blockId = b.id;
  }
}

function placeGate(g, idx) {
  const lv = state.level;
  const box = gateBox(g, lv, cellSize);
  if (!box) return; // not on the board's edge (validation panel says why)
  const el = document.createElement('div');
  el.className = 'gate' + (g.lock ? ' locked' : '');
  el.dataset.gateIndex = idx;
  const col = GAME_COLORS[g.color];
  el.style.background = `linear-gradient(135deg, ${col.bg}, ${col.brd})`;
  el.style.border = `3px solid ${col.brd}`;
  el.style.color = g.color === 'yellow' ? '#6a5a20' : '#fff';
  el.style.textShadow = g.color === 'yellow' ? 'none' : '0 1px 2px rgba(0,0,0,0.2)';
  el.style.position = 'absolute';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.fontSize = '18px';
  el.style.fontWeight = '700';
  el.textContent = ANIMAL_EMOJI[g.color] || '⭐';
  el.style.left = box.left + 'px';
  el.style.top = box.top + 'px';
  el.style.width = box.width + 'px';
  el.style.height = box.height + 'px';
  el.style.borderRadius = { right: '0 14px 14px 0', left: '14px 0 0 14px', bottom: '0 0 14px 14px', top: '14px 14px 0 0' }[g.side];
  el.style['border' + { right: 'Left', left: 'Right', bottom: 'Top', top: 'Bottom' }[g.side]] = 'none';
  boardEl.appendChild(el);
  if (g.lock) boardEl.appendChild(gateLockBadge(box.left + box.width / 2, box.top + box.height / 2, cellSize, idx));
}

/** Clickable slots wherever a gate of the chosen size fits on the board's edge (inner edges too). */
function renderEdgeSlots() {
  const lv = state.level;
  const sz = state.tool.size || 1;
  for (const side of ['right', 'left', 'top', 'bottom']) {
    const vertical = side === 'left' || side === 'right';
    const n = vertical ? lv.rows : lv.cols;
    for (let i = 0; i + sz <= n; i++) {
      const g = { side, size: sz, [vertical ? 'exit_row' : 'exit_col']: i };
      if (gateLine(g, lv) === null) continue;
      const box = gateBox(g, lv, cellSize);
      addEdgeSlot({ side, exit_row: vertical ? i : undefined, exit_col: vertical ? undefined : i, ...box });
    }
  }
}

function addEdgeSlot({ side, exit_row, exit_col, left, top, width, height }) {
  const el = document.createElement('div');
  el.className = 'edgeSlot';
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  el.style.width = width + 'px';
  el.style.height = height + 'px';
  el.dataset.side = side;
  if (side === 'left' || side === 'right') el.dataset.exitRow = exit_row;
  else el.dataset.exitCol = exit_col;
  boardEl.appendChild(el);
}
