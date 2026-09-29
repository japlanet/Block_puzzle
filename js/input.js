// Pointer-based drag with smooth sub-cell motion.
// The block's logical position (col,row) advances one cell at a time when the
// cursor crosses a cell boundary; the visual position is offset smoothly via
// CSS transform so the drag feels pixel-accurate, not grid-snappy.

import { state } from './state.js';
import { canMove, isFree } from './geometry.js';
import { positionBlockElement, setBlockClass, nudgeStuck } from './render.js';
import { playSfx, initAudio, resumeIfSuspended } from './audio.js';
import { stopHint } from './hint.js';

let onReleaseHandler = () => {};
let lastSlideSfxAt = 0;
let lastBumpAt = 0;

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
  // One drag at a time: a second finger or a resting palm must not hijack
  // (or strand off-grid) the block that is already being dragged.
  if (state.dragInfo) return;
  stopHint();
  initAudio();
  resumeIfSuspended();

  const b = state.blocks.find(x => x.id === id);
  if (!b) return;

  // Frozen or padlocked: no drag, just a shiver that points at the reason
  // (its snowflakes, or the animal with the key).
  if (!isFree(b, state.level, state.blocks)) {
    playSfx('stuck');
    nudgeStuck(b, state.blocks);
    return;
  }

  // Every press starts a drag, even on the already-selected block; a tap
  // (press + release without moving) on the selected block deselects it.
  const wasSelected = state.selectedId === id;
  state.selectedId = id;
  playSfx('select');

  state.dragInfo = {
    id,
    pointerId: e.pointerId,
    px: e.clientX,
    py: e.clientY,
    sc: b.col,
    sr: b.row,
    subX: 0,
    subY: 0,
    dragged: false,
    wasSelected,
    bumping: false,
  };
  // Drop any leftover snap-back transition so the block tracks the finger.
  const el = document.getElementById('bg-' + id);
  if (el) el.style.transition = '';
  refreshBlockClasses();
  setBlockClass(b, 'drag');
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
}

function onMove(e) {
  const dr = state.dragInfo;
  if (!dr || e.pointerId !== dr.pointerId) return;
  e.preventDefault();
  const b = state.blocks.find(x => x.id === dr.id);
  if (!b) return;

  const cs = state.cellSize;
  const dx = e.clientX - dr.px;
  const dy = e.clientY - dr.py;
  if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
  dr.dragged = true;

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
  const rawX = subX, rawY = subY;
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

  // Bumped into a wall or another animal: a soft "bonk" + wobble, once per
  // push (and throttled) so holding against an obstacle doesn't buzz.
  const bumping = (canH && subX !== rawX) || (canV && subY !== rawY);
  if (bumping && !dr.bumping) {
    const now = performance.now();
    if (now - lastBumpAt > 350) {
      lastBumpAt = now;
      playSfx('invalid');
      wobble(b);
    }
  }
  dr.bumping = bumping;

  dr.subX = subX;
  dr.subY = subY;
  positionBlockElement(b, { x: subX, y: subY });

  if (committedThisFrame) {
    const now = performance.now();
    if (now - lastSlideSfxAt > 70) {
      playSfx('slide');
      lastSlideSfxAt = now;
    }
  }
}

function removeDragListeners() {
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onCancel);
}

function onUp(e) {
  const dr = state.dragInfo;
  if (!dr) { removeDragListeners(); return; }
  if (e.pointerId !== dr.pointerId) return; // some other finger lifted
  removeDragListeners();

  const b = state.blocks.find(x => x.id === dr.id);
  state.dragInfo = null;
  if (!b) return;

  // Snap any sub-cell offset back to zero with a quick ease.
  snapToGrid(b);

  const moved = b.col !== dr.sc || b.row !== dr.sr;
  // A plain tap on the block that was already selected deselects it.
  if (dr.wasSelected && !dr.dragged && !moved) state.selectedId = null;
  refreshBlockClasses();
  onReleaseHandler(b, moved);
}

/** The browser took the touch away (system gesture etc.): put the block back where it started. */
function onCancel(e) {
  const dr = state.dragInfo;
  if (!dr) { removeDragListeners(); return; }
  if (e.pointerId !== dr.pointerId) return;
  removeDragListeners();

  const b = state.blocks.find(x => x.id === dr.id);
  state.dragInfo = null;
  if (!b) return;

  // Re-anchor at the start cell but keep the block visually where it is,
  // then ease the leftover offset away.
  const cs = state.cellSize;
  const offX = (b.col - dr.sc) * cs + dr.subX;
  const offY = (b.row - dr.sr) * cs + dr.subY;
  b.col = dr.sc;
  b.row = dr.sr;
  positionBlockElement(b, { x: offX, y: offY });
  snapToGrid(b);
  refreshBlockClasses();
}

function snapToGrid(b) {
  const el = document.getElementById('bg-' + b.id);
  if (!el) return;
  void el.offsetWidth; // commit the current offset so the transition runs from it
  el.style.transition = 'transform 0.14s cubic-bezier(0.2, 0.8, 0.2, 1)';
  el.style.transform = '';
  setTimeout(() => { if (el) el.style.transition = ''; }, 160);
}

/** Brief side-to-side wiggle of the animal (the inner art, so it doesn't fight the drag transform). */
function wobble(b) {
  const el = document.getElementById('bg-' + b.id);
  if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth; // restart the animation
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 260);
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
