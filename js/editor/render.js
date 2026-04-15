// Draw the edited level in #editorBoard.
// Reuses the same block-rendering approach as the game so WYSIWYG matches play.

import { state, ANIMAL_EMOJI } from './state.js';
import { COLORS as GAME_COLORS, ANIMALS, createBlockElement, positionBlockElement } from '../render.js';
import { cellsOf } from '../geometry.js';
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

  // Cells.
  const walls = new Set((lv.walls || []).map(w => w.col + ',' + w.row));
  for (let r = 0; r < lv.rows; r++) {
    for (let c = 0; c < lv.cols; c++) {
      const d = document.createElement('div');
      d.className = 'cell' + (walls.has(c + ',' + r) ? ' wall-cell' : '');
      d.dataset.col = c;
      d.dataset.row = r;
      boardEl.appendChild(d);
    }
  }

  // Pending block preview: mark cells we're about to commit.
  if (state.tool && state.tool.type === 'block' && state.tool.pendingCells) {
    for (const k of state.tool.pendingCells) {
      const [c, r] = k.split(',').map(Number);
      const cell = boardEl.children[r * lv.cols + c];
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
    createBlockElement(b);
    positionBlockElement(b);
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
  const el = document.createElement('div');
  el.className = 'gate';
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

  const gw = Math.round(cellSize * 0.4);
  const sz = g.size || 1;
  if (g.side === 'right') {
    el.style.left = `${cellSize * lv.cols}px`;
    el.style.top  = `${g.exit_row * cellSize}px`;
    el.style.width = `${gw}px`;
    el.style.height = `${cellSize * sz}px`;
    el.style.borderRadius = '0 14px 14px 0';
    el.style.borderLeft = 'none';
  } else if (g.side === 'left') {
    el.style.left = `${-gw}px`;
    el.style.top  = `${g.exit_row * cellSize}px`;
    el.style.width = `${gw}px`;
    el.style.height = `${cellSize * sz}px`;
    el.style.borderRadius = '14px 0 0 14px';
    el.style.borderRight = 'none';
  } else if (g.side === 'bottom') {
    el.style.top = `${cellSize * lv.rows}px`;
    el.style.left = `${g.exit_col * cellSize}px`;
    el.style.height = `${gw}px`;
    el.style.width = `${cellSize * sz}px`;
    el.style.borderRadius = '0 0 14px 14px';
    el.style.borderTop = 'none';
  } else {
    el.style.top = `${-gw}px`;
    el.style.left = `${g.exit_col * cellSize}px`;
    el.style.height = `${gw}px`;
    el.style.width = `${cellSize * sz}px`;
    el.style.borderRadius = '14px 14px 0 0';
    el.style.borderBottom = 'none';
  }
  boardEl.appendChild(el);
}

function renderEdgeSlots() {
  const lv = state.level;
  const t = state.tool;
  const sz = t.size || 1;
  const slotT = Math.round(cellSize * 0.4);

  // Right slots
  for (let r = 0; r + sz <= lv.rows; r++) {
    addEdgeSlot({
      side: 'right', exit_row: r,
      left: cellSize * lv.cols, top: r * cellSize,
      width: slotT, height: cellSize * sz,
    });
  }
  // Left slots
  for (let r = 0; r + sz <= lv.rows; r++) {
    addEdgeSlot({
      side: 'left', exit_row: r,
      left: -slotT, top: r * cellSize,
      width: slotT, height: cellSize * sz,
    });
  }
  // Top slots
  for (let c = 0; c + sz <= lv.cols; c++) {
    addEdgeSlot({
      side: 'top', exit_col: c,
      left: c * cellSize, top: -slotT,
      width: cellSize * sz, height: slotT,
    });
  }
  // Bottom slots
  for (let c = 0; c + sz <= lv.cols; c++) {
    addEdgeSlot({
      side: 'bottom', exit_col: c,
      left: c * cellSize, top: cellSize * lv.rows,
      width: cellSize * sz, height: slotT,
    });
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
