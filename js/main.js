// Entry point. Wires modules together and runs the game loop.

import { state, getSavedLevelIdx, recordLevelComplete, clearProgress, loadSoundPref, saveSoundPref } from './state.js';
import { loadLevels, cloneBlocks } from './levels.js';
import { atGate } from './geometry.js';
import { renderBoard, animateExit, clearBlocks } from './render.js';
import { critterSVG } from './critters.js';
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

const DEBUG = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ||
  new URLSearchParams(location.search).get('debug') === '1';

// Bumped on every level (re)start so delayed win celebrations queued for an
// earlier level know to stand down.
let levelGen = 0;

// ── Game flow ───────────────────────────────────────────────────
function initLevel(idx) {
  levelGen++;
  hideWinOverlay();
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
  // Only runs on localhost or with ?debug=1: on a few levels the search takes
  // seconds, and players shouldn't pay for it at every level load.
  if (DEBUG) {
    try {
      const t0 = performance.now();
      const r = solve(state.level, state.blocks);
      const ms = Math.round(performance.now() - t0);
      if (!r) console.warn(`[solver] Level ${idx + 1} exceeded node budget; hint may fall back to greedy.`);
      else console.info(`[solver] Level ${idx + 1}: ${r.moves.length} hint moves (${ms} ms)`);
    } catch (e) {
      console.warn('[solver] error on level', idx + 1, e);
    }
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

  if (state.blocks.length > 0) return;

  // Level solved: save the stars right away (so leaving mid-celebration can't
  // lose the win), then celebrate once the exit animations finish — unless
  // the player has moved on to another level (or restarted) by then.
  const gen = levelGen;
  const stars = computeStars();
  recordLevelComplete(state.levelIndex, stars);
  setTimeout(() => {
    if (gen === levelGen) showWin(stars, gen);
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

function showWin(stars, gen) {
  playSfx('win');
  launchFireworks();
  setTimeout(() => {
    if (gen === levelGen) showWinOverlay(stars);
  }, 900);
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
  wireHoldToReset();
  document.getElementById('ls').addEventListener('click', e => {
    if (e.target.id === 'ls') closeLevelSelect();
  });
  document.getElementById('obtn').addEventListener('click', () => nextLevel());
  document.getElementById('tutBtn').addEventListener('click', () => {
    closeTutorial();
    if (!state._audioInited) { initAudio(); state._audioInited = true; }
  });
}

// "Clear all stars" needs a 2-second press-and-hold (with a filling bar), so a
// stray tap from a little one can't wipe everything.
const RESET_HOLD_MS = 2000;

function wireHoldToReset() {
  const btn = document.getElementById('resetAllBtn');
  let holdTimer = null;
  let holdPointer = null;

  const cancel = e => {
    if (holdPointer === null || (e && e.pointerId !== holdPointer)) return;
    clearTimeout(holdTimer);
    holdTimer = null;
    holdPointer = null;
    btn.classList.remove('holding');
  };

  btn.addEventListener('pointerdown', e => {
    if (holdPointer !== null) return;
    e.preventDefault();
    playSfx('tap');
    holdPointer = e.pointerId;
    btn.classList.add('holding');
    holdTimer = setTimeout(() => {
      holdTimer = null;
      holdPointer = null;
      btn.classList.remove('holding');
      clearProgress();
      closeLevelSelect();
      initLevel(0);
      showToast('All stars cleared 🔄');
    }, RESET_HOLD_MS);
  });
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointerleave', cancel);
  btn.addEventListener('pointercancel', cancel);
  btn.addEventListener('contextmenu', e => e.preventDefault());
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
const TEST_KEY = 'animal_escape_test_level';

function loadTestLevel() {
  try {
    const raw = localStorage.getItem(TEST_KEY);
    if (!raw) return null;
    const lv = JSON.parse(raw);
    // Normalize shape entries so {dc,dr} → [dc,dr] matches our internal format.
    for (const b of (lv.blocks || [])) {
      b.shape = b.shape.map(p => Array.isArray(p) ? [p[0], p[1]] : [p.dc, p.dr]);
      if (!b.dir) b.dir = 'free';
    }
    return lv;
  } catch (e) { return null; }
}

function installTestPlayUI() {
  // Replace the hamburger (🗺️) button with a "back to editor" affordance
  // and hide the win → nxt() flow's wraparound behavior.
  document.getElementById('mapBtn').textContent = '✎';
  document.getElementById('mapBtn').title = 'Back to editor';
  document.getElementById('mapBtn').onclick = () => { window.location.href = 'editor.html'; };
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:500;background:linear-gradient(135deg,#fff,#f8f0ff);border:2px solid var(--accent);border-radius:14px;padding:6px 16px;font-weight:700;color:var(--text);font-size:13px;box-shadow:var(--shadow);';
  banner.textContent = '🛠️ Test-playing from editor';
  document.body.appendChild(banner);
}

async function boot() {
  // Reflect persisted sound preference on the toggle button.
  const soundOn = loadSoundPref();
  state.soundOn = soundOn;
  document.getElementById('soundBtn').textContent = soundOn ? '🔊' : '🔇';

  createBubbles();
  wireButtons();
  // Drawn animal heads in the tutorial (placeholders marked data-critter="<color>").
  document.querySelectorAll('[data-critter]').forEach((el, i) => {
    el.outerHTML = critterSVG(el.dataset.critter, { blinkDelay: (i * 0.7) % 4.6 });
  });

  const params = new URLSearchParams(location.search);
  const testMode = params.get('test') === '1';
  if (testMode) {
    const testLevel = loadTestLevel();
    if (testLevel) {
      state.levels = [testLevel];
      installTestPlayUI();
      initLevel(0);
      return;
    }
    // Fall through to normal boot if no test level stashed.
  }

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
  registerServiceWorker();
}

// ── Offline / updates ───────────────────────────────────────────
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // When a new version of sw.js takes over (CACHE_VERSION bumped), reload once
  // so the freshly cached files are the ones running. Skipped on the very
  // first install, where there was no previous controller.
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }
    showToast('Updated! ✨');
    setTimeout(() => window.location.reload(), 600);
  });

  navigator.serviceWorker.register('sw.js')
    .then(reg => {
      // Check for a newer sw.js each time the app comes back to the foreground
      // (installed PWAs can stay open for days).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch(err => console.warn('SW register failed:', err));
}

boot();
