// Hint UI: animates a pointing finger from a block to the first move the solver recommends.
// Replaces the old "any legal move" heuristic with a real BFS-backed suggestion.

import { state } from './state.js';
import { cellsOf } from './geometry.js';
import { nextHintMove } from './solver.js';
import { playSfx } from './audio.js';

let hintTimer = null;

export function stopHint() {
  clearTimeout(hintTimer);
  hintTimer = null;
  const finger = document.getElementById('hf');
  if (finger) finger.style.display = 'none';
}

export function showHint() {
  stopHint();
  if (!state.level || state.blocks.length === 0) return;

  const move = nextHintMove(state.level, state.blocks);
  if (!move) return;

  const block = state.blocks.find(b => b.id === move.id);
  if (!block) return;

  playSfx('hint');

  const finger = document.getElementById('hf');
  const boardRect = document.getElementById('board').getBoundingClientRect();
  const cs = state.cellSize;

  // Start on the block's center.
  const cells = cellsOf(block);
  const cx = cells.reduce((s, { c }) => s + c, 0) / cells.length;
  const cy = cells.reduce((s, { r }) => s + r, 0) / cells.length;
  const sx = boardRect.left + cx * cs + cs / 2 - 26;
  const sy = boardRect.top + cy * cs + cs / 2 - 26;

  // End at the block's new center (offset by the anchor delta).
  const dc = move.col - block.col;
  const dr = move.row - block.row;
  const ex = sx + dc * cs;
  const ey = sy + dr * cs;

  finger.style.display = 'block';
  finger.style.transition = 'none';
  finger.style.left = sx + 'px';
  finger.style.top = sy + 'px';

  let reps = 0;
  function stepForward() {
    finger.style.transition =
      'left 0.55s cubic-bezier(0.4, 0, 0.2, 1), top 0.55s cubic-bezier(0.4, 0, 0.2, 1)';
    finger.style.left = ex + 'px';
    finger.style.top = ey + 'px';
    hintTimer = setTimeout(stepBack, 720);
  }
  function stepBack() {
    finger.style.transition = 'none';
    finger.style.left = sx + 'px';
    finger.style.top = sy + 'px';
    reps++;
    hintTimer = reps < 3 ? setTimeout(stepForward, 200) : setTimeout(stopHint, 200);
  }
  setTimeout(stepForward, 60);
}
