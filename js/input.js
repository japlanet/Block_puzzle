// Pointer-based drag with smooth sub-cell motion.
// The block's logical position (col,row) advances one cell at a time when the
// cursor crosses a cell boundary; the visual position is offset smoothly via
// CSS transform so the drag feels pixel-accurate, not grid-snappy.

import { state } from './state.js';
import { canMove } from './geometry.js';
import { positionBlockElement, setBlockClass } from './render.js';
import { playSfx, initAudio, resumeIfSuspended } from './audio.js';
import { stopHint } from './hint.js';

let onReleaseHandler = () => {};
let lastSlideSfxAt = 0;

/** Register a callback fired on drag release (for win/gate checking). */
export function setOnRelease(fn) { onReleaseHandler = fn; }

/** Attach pointerdown to a newly-created block element. */
export function wireBlock(b) {
  const el = document.getElementById('bg-' + b.id);
  if (!el) return;
  el.addEventListener('pointerdown', e => onDown(e, b.id));
}

function onDown(e, id) {
  e.preventDefault();
  stopHint();
  initAudio();
  resumeIfSuspended();

  // Toggle selection if tapping the already-selected block.
  if (state.selectedId === id) {
    state.selectedId = null;
    refreshBlockClasses();
    return;
  }

  state.selectedId = id;
  playSfx('select');
  const b = state.blocks.find(x => x.id === id);
  if (!b) return;

  state.dragInfo = {
    id,
    px: e.clientX,
    py: e.clientY,
    sc: b.col,
    sr: b.row,
  };
  refreshBlockClasses();
  setBlockClass(b, 'drag');
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

function onMove(e) {
  const dr = state.dragInfo;
  if (!dr) return;
  e.preventDefault();
  const b = state.blocks.find(x => x.id === dr.id);
  if (!b) return;

  const cs = state.cellSize;
  const dx = e.clientX - dr.px;
  const dy = e.clientY - dr.py;
  if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

  const canH = b.dir === 'h' || b.dir === 'free';
  const canV = b.dir === 'v' || b.dir === 'free';

  const wantDc = canH ? Math.round(dx / cs) : 0;
  const wantDr = canV ? Math.round(dy / cs) : 0;

  let committedThisFrame = false;

  // Advance horizontally toward want.
  while (b.col - dr.sc < wantDc) {
    if (!canMove(b, 1, 0, state.level, state.blocks)) break;
    b.col += 1; committedThisFrame = true;
  }
  while (b.col - dr.sc > wantDc) {
    if (!canMove(b, -1, 0, state.level, state.blocks)) break;
    b.col -= 1; committedThisFrame = true;
  }

  // Advance vertically toward want.
  while (b.row - dr.sr < wantDr) {
    if (!canMove(b, 0, 1, state.level, state.blocks)) break;
    b.row += 1; committedThisFrame = true;
  }
  while (b.row - dr.sr > wantDr) {
    if (!canMove(b, 0, -1, state.level, state.blocks)) break;
    b.row -= 1; committedThisFrame = true;
  }

  // Sub-cell residual for smooth visual.
  const committedPx = (b.col - dr.sc) * cs;
  const committedPy = (b.row - dr.sr) * cs;
  let subX = canH ? (dx - committedPx) : 0;
  let subY = canV ? (dy - committedPy) : 0;

  // Clamp sub-offset against blocked neighbors so the block doesn't visually crash into obstacles.
  const cap = cs * 0.18;
  if (canH) {
    if (subX > 0 && !canMove(b, 1, 0, state.level, state.blocks)) subX = Math.min(subX, cap);
    if (subX < 0 && !canMove(b, -1, 0, state.level, state.blocks)) subX = Math.max(subX, -cap);
  } else {
    subX = 0;
  }
  if (canV) {
    if (subY > 0 && !canMove(b, 0, 1, state.level, state.blocks)) subY = Math.min(subY, cap);
    if (subY < 0 && !canMove(b, 0, -1, state.level, state.blocks)) subY = Math.max(subY, -cap);
  } else {
    subY = 0;
  }

  positionBlockElement(b, { x: subX, y: subY });

  if (committedThisFrame) {
    const now = performance.now();
    if (now - lastSlideSfxAt > 70) {
      playSfx('slide');
      lastSlideSfxAt = now;
    }
  }
}

function onUp() {
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);

  const dr = state.dragInfo;
  if (!dr) return;
  const b = state.blocks.find(x => x.id === dr.id);
  state.dragInfo = null;
  if (!b) return;

  // Snap any sub-cell offset back to zero with a quick ease.
  const el = document.getElementById('bg-' + b.id);
  if (el) {
    el.style.transition = 'transform 0.14s cubic-bezier(0.2, 0.8, 0.2, 1)';
    el.style.transform = '';
    setTimeout(() => { if (el) el.style.transition = ''; }, 160);
  }

  const moved = b.col !== dr.sc || b.row !== dr.sr;
  refreshBlockClasses();
  onReleaseHandler(b, moved);
}

/** Reapply the correct classes to every live block (sel/drag state). */
export function refreshBlockClasses() {
  for (const b of state.blocks) {
    if (b.id === state.selectedId && !state.dragInfo) {
      setBlockClass(b, 'sel');
    } else {
      setBlockClass(b, '');
    }
  }
}
