// Pointer + keyboard input for the editor.
// Delegates off an event listener on #editorBoard so re-renders don't lose wiring.

import {
  state, setTool, togglePendingCell, startEditBlock,
  removeBlock, toggleWall, addGate, removeGate, undo, redo,
} from './state.js';
import { renderAll } from './render.js';

export function wireInput() {
  const board = document.getElementById('editorBoard');

  board.addEventListener('click', e => {
    const t = state.tool;
    // Edge slot? → gate placement.
    const slot = e.target.closest('.edgeSlot');
    if (slot && t && t.type === 'gate') {
      const side = slot.dataset.side;
      const base = { side, color: t.color, size: t.size };
      if (side === 'left' || side === 'right') base.exit_row = +slot.dataset.exitRow;
      else base.exit_col = +slot.dataset.exitCol;
      // Refuse if the cells overlap an existing gate on that side.
      if (gateWouldOverlap(base)) return;
      addGate(base);
      return;
    }

    // Gate element? → eraser deletes it.
    const gateEl = e.target.closest('.gate');
    if (gateEl) {
      const idx = +gateEl.dataset.gateIndex;
      if (t && t.type === 'eraser') {
        removeGate(idx);
      }
      return;
    }

    // Block element? → eraser deletes; click with select/no tool edits.
    const blockEl = e.target.closest('.bg');
    if (blockEl) {
      const id = blockEl.dataset.blockId;
      if (!id) return;
      if (t && t.type === 'eraser') {
        removeBlock(id);
        return;
      }
      // Click a block with no tool → edit it.
      if (!t || t.type === 'block' && !t.pendingCells.size) {
        startEditBlock(id);
      }
      return;
    }

    // Interior cell? → block cell toggle, wall, or eraser (wall).
    const cell = e.target.closest('.cell');
    if (cell) {
      const c = +cell.dataset.col, r = +cell.dataset.row;
      if (t && t.type === 'block') {
        // Can't put a block on a wall.
        const isWall = state.level.walls.some(w => w.col === c && w.row === r);
        if (isWall) return;
        // Or on another (non-pending) block.
        const occupyingBlock = state.level.blocks.find(b => {
          if (state.tool.editingId === b.id) return false;
          return b.shape.some(([dc, dr]) => b.col + dc === c && b.row + dr === r);
        });
        if (occupyingBlock) return;
        togglePendingCell(c, r);
        return;
      }
      if (t && t.type === 'wall') {
        // Don't place wall over blocks.
        const occupyingBlock = state.level.blocks.find(b =>
          b.shape.some(([dc, dr]) => b.col + dc === c && b.row + dr === r));
        if (occupyingBlock) return;
        toggleWall(c, r);
        return;
      }
      if (t && t.type === 'eraser') {
        // Eraser on a wall cell removes the wall.
        if (state.level.walls.some(w => w.col === c && w.row === r)) {
          toggleWall(c, r);
          return;
        }
      }
    }
  });

  // Keyboard.
  window.addEventListener('keydown', e => {
    const typing = /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '');
    if (typing) return;
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault(); undo();
    } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault(); redo();
    } else if (e.key === 'Escape') {
      setTool(null);
    } else if (e.key.toLowerCase() === 'w') {
      setTool({ type: 'wall' });
    } else if (e.key.toLowerCase() === 'e') {
      setTool({ type: 'eraser' });
    } else if (e.key.toLowerCase() === 'g') {
      setTool({ type: 'gate', color: 'red', size: 1 });
    }
  });
}

function gateWouldOverlap(proposed) {
  const lv = state.level;
  const proposedCells = [];
  const sz = proposed.size || 1;
  if (proposed.side === 'right' || proposed.side === 'left') {
    for (let r = proposed.exit_row; r < proposed.exit_row + sz; r++) {
      proposedCells.push(proposed.side + ':' + r);
    }
  } else {
    for (let c = proposed.exit_col; c < proposed.exit_col + sz; c++) {
      proposedCells.push(proposed.side + ':' + c);
    }
  }
  for (const g of lv.gates) {
    const gsz = g.size || 1;
    if (g.side !== proposed.side) continue;
    if (g.side === 'right' || g.side === 'left') {
      for (let r = g.exit_row; r < g.exit_row + gsz; r++) {
        if (proposedCells.includes(g.side + ':' + r)) return true;
      }
    } else {
      for (let c = g.exit_col; c < g.exit_col + gsz; c++) {
        if (proposedCells.includes(g.side + ':' + c)) return true;
      }
    }
  }
  return false;
}
