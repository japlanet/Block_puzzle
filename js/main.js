// Entry point. Wires modules together and runs the game loop.

import { state, getSavedLevelIdx, recordLevelComplete, loadSoundPref, saveSoundPref } from './state.js';
import { loadLevels, cloneBlocks } from './levels.js';
import { atGate } from './geometry.js';
import { renderBoard, animateExit, clearBlocks, ANIMALS } from './render.js';
import { wireBlock, setOnRelease, refreshBlockClasses } from './input.js';
import { initAudio, toggleSound, isSoundOn, playSfx, resumeIfSuspended } from './audio.js';
import { solve } from './solver.js';
import { stopHint, showHint } from './hint.js';
import { createBubbles, launchFireworks, exitBurst } from './effects.js';
import {
  updateMoveCount, showToast, pickCheer,
  maybeShowTutorial, closeTutorial,
  openLevelSelect, closeLevelSelect, showWinOverlay, hideWinOverlay,
} from './ui.js';

// ── Game flow ───────────────────────────────────────────────────
function initLevel(idx) {
  state.levelIndex = idx;
  state.level = state.levels[idx] || state.levels[0];
  if (!state.level) throw new Error('No levels loaded');
  state.blocks = cloneBlocks(state.level);
  state.selectedId = null;
  state.dragInfo = null;
  state.moveCount = 0;
  stopHint();
  clearBlocks();
  renderBoard();
  for (const b of state.blocks) wireBlock(b);
  updateMoveCount();
  // Solver sanity-check (dev aid — prints to console only on unsolvable levels).
  try {
    const r = solve(state.level, state.blocks);
    if (!r) console.warn(`[solver] Level ${idx + 1} exceeded node budget; hint may fall back to greedy.`);
  } catch (e) {
    console.warn('[solver] error on level', idx + 1, e);
  }
}

function resetLevel() {
  stopHint();
  playSfx('tap');
  initLevel(state.levelIndex);
}

function nextLevel() {
  hideWinOverlay();
  playSfx('tap');
  // Advance and remember.
  const next = (state.levelIndex + 1) % state.levels.length;
  initLevel(next);
}

/** Check if any live block now sits on its gate; exit it if so. */
function checkGatesAndWin(releasedBlock) {
  // Collect all exits this release triggers (a block can only match one gate by color).
  const exits = [];
  for (const b of state.blocks) {
    for (const g of state.level.gates) {
      if (b.color === g.color && atGate(b, g, state.level)) {
        exits.push({ block: b, gate: g });
        break;
      }
    }
  }
  if (exits.length === 0) return;

  // Run exit animations in parallel.
  for (const { block, gate } of exits) {
    playSfx('exit', { color: block.color });
    // Visual particle burst at the gate location.
    const gateEl = findGateElement(gate);
    if (gateEl) exitBurst(gateEl.getBoundingClientRect(), block.color);
    animateExit(block, gate);
    // Remove from game state immediately (animation continues on DOM node).
    state.blocks = state.blocks.filter(x => x.id !== block.id);
    if (state.selectedId === block.id) state.selectedId = null;
  }

  // Win check once animations finish.
  setTimeout(() => {
    if (state.blocks.length === 0) showWin();
  }, 460);
}

function findGateElement(gate) {
  return [...document.querySelectorAll('.gate')]
    .find(el => el.dataset.color === gate.color && el.dataset.side === gate.side);
}

function computeStars() {
  const par = state.level.blocks.length * 2.5;
  if (state.moveCount <= par) return 3;
  if (state.moveCount <= par * 1.5) return 2;
  return 1;
}

function showWin() {
  playSfx('win');
  launchFireworks();
  const stars = computeStars();
  recordLevelComplete(state.levelIndex, stars);
  setTimeout(() => showWinOverlay(stars), 900);
}

// ── Release handler passed to input.js ──────────────────────────
setOnRelease((block, moved) => {
  if (moved) {
    state.moveCount++;
    updateMoveCount();
    if (state.moveCount % 4 === 0 && state.moveCount > 0) showToast(pickCheer());
  }
  checkGatesAndWin(block);
});

// ── Button wiring ───────────────────────────────────────────────
function wireButtons() {
  document.getElementById('soundBtn').addEventListener('click', () => {
    if (!state._audioInited) { initAudio(); state._audioInited = true; }
    resumeIfSuspended();
    const on = toggleSound();
    document.getElementById('soundBtn').textContent = on ? '🔊' : '🔇';
  });
  document.getElementById('hb').addEventListener('click', () => {
    if (!state._audioInited) { initAudio(); state._audioInited = true; }
    resumeIfSuspended();
    showHint();
  });
  document.getElementById('mapBtn').addEventListener('click', () => {
    if (!state._audioInited) { initAudio(); state._audioInited = true; }
    playSfx('tap');
    openLevelSelect(idx => initLevel(idx));
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!state._audioInited) { initAudio(); state._audioInited = true; }
    resetLevel();
  });
  document.getElementById('lsx').addEventListener('click', () => closeLevelSelect());
  document.getElementById('ls').addEventListener('click', e => {
    if (e.target.id === 'ls') closeLevelSelect();
  });
  document.getElementById('obtn').addEventListener('click', () => nextLevel());
  document.getElementById('tutBtn').addEventListener('click', () => {
    closeTutorial();
    if (!state._audioInited) { initAudio(); state._audioInited = true; }
  });
}

// ── Resize ──────────────────────────────────────────────────────
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    clearBlocks();
    renderBoard();
    for (const b of state.blocks) wireBlock(b);
    refreshBlockClasses();
  }, 120);
});

// ── Boot ────────────────────────────────────────────────────────
async function boot() {
  // Reflect persisted sound preference on the toggle button.
  const soundOn = loadSoundPref();
  state.soundOn = soundOn;
  document.getElementById('soundBtn').textContent = soundOn ? '🔊' : '🔇';

  createBubbles();
  wireButtons();
  try {
    state.levels = await loadLevels();
  } catch (e) {
    console.error('Failed to load levels:', e);
    document.getElementById('ll').textContent = 'Load error';
    return;
  }
  const saved = getSavedLevelIdx();
  initLevel(Math.max(0, Math.min(saved, state.levels.length - 1)));
  maybeShowTutorial();

  // Register service worker for offline + installable PWA.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW register failed:', err));
  }
}

boot();
