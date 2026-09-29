// Entry point. Wires modules together and runs the game loop.

import { state, getSavedLevelIdx, recordLevelComplete, clearProgress, loadSoundPref, saveSoundPref } from './state.js';
import { loadLevels, cloneBlocks, normalizeLevel } from './levels.js';
import { atGate, isFree, gateOpen } from './geometry.js';
import { renderBoard, animateExit, clearBlocks, refreshStatus } from './render.js';
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

// Delay between waves of animals going home: when the key animal leaves, a
// door unlocks, and an animal already waiting there follows a moment later.
const WAVE_MS = 420;

/**
 * Send home every animal that sits at an open door of its colour, then keep
 * going while that frees more (ice melts, padlocks open). The game state
 * updates at once; the animations play in waves.
 */
function checkGatesAndWin() {
  const gen = levelGen;
  let wave = 0;
  for (;;) {
    const exits = [];
    for (const b of state.blocks) {
      if (!isFree(b, state.level, state.blocks)) continue;
      const gi = state.level.gates.findIndex(g =>
        g.color === b.color && gateOpen(g, state.level, state.blocks) && atGate(b, g, state.level));
      if (gi >= 0) exits.push({ block: b, gate: state.level.gates[gi], gi });
    }
    if (exits.length === 0) break;
    // Remove from game state immediately (animations continue on the DOM nodes).
    const gone = new Set(exits.map(e => e.block.id));
    state.blocks = state.blocks.filter(x => !gone.has(x.id));
    if (gone.has(state.selectedId)) state.selectedId = null;
    const blocksNow = state.blocks;
    const run = () => {
      if (gen !== levelGen) return;
      for (const { block, gate, gi } of exits) {
        playSfx('exit', { color: block.color });
        // Visual particle burst at the gate location.
        const gateEl = document.querySelector(`.gate[data-gate-index="${gi}"]`);
        if (gateEl) exitBurst(gateEl.getBoundingClientRect(), block.color);
        animateExit(block, gate);
      }
      // Melt snowflakes / open padlocks to match, after the exit jingle starts.
      setTimeout(() => {
        if (gen !== levelGen) return;
        const changed = refreshStatus(state.level, blocksNow);
        if (changed.unlocked) playSfx('unlock');
        else if (changed.thawed) playSfx('thaw');
        else if (changed.cracked) playSfx('crack');
      }, 180);
    };
    if (wave === 0) run(); else setTimeout(run, wave * WAVE_MS);
    wave++;
  }
  if (wave === 0 || state.blocks.length > 0) return;

  // Level solved: save the stars right away (so leaving mid-celebration can't
  // lose the win), then celebrate once the exit animations finish — unless
  // the player has moved on to another level (or restarted) by then.
  const stars = computeStars();
  recordLevelComplete(state.levelIndex, stars);
  setTimeout(() => {
    if (gen === levelGen) showWin(stars, gen);
  }, 460 + (wave - 1) * WAVE_MS);
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
  checkGatesAndWin();
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
    showVersion();
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!state._audioInited) { initAudio(); state._audioInited = true; }
    resetLevel();
  });
  document.getElementById('lsx').addEventListener('click', () => closeLevelSelect());
  document.getElementById('updateBtn').addEventListener('click', () => checkForUpdate());
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
    return normalizeLevel(JSON.parse(raw));
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
// All the games share japlanet.github.io, so only ever touch this game's caches.
const CACHE_PREFIX = 'animal-escape-';
let swReg = null;

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

  // updateViaCache 'none': GitHub Pages lets browsers cache sw.js for 10
  // minutes; update checks must always ask the network.
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    .then(reg => {
      swReg = reg;
      // Check for a newer sw.js each time the app comes back to the foreground
      // or is restored, and every half hour while it stays open (installed
      // PWAs can stay open for days).
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.addEventListener('pageshow', check);
      setInterval(() => { if (document.visibilityState === 'visible') check(); }, 30 * 60 * 1000);
    })
    .catch(err => console.warn('SW register failed:', err));
}

/** The version this page is running, from its service worker (null if none yet). */
function runningVersion() {
  const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
  if (!sw) return Promise.resolve(null);
  return new Promise(resolve => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 1500);
    ch.port1.onmessage = e => { clearTimeout(timer); resolve(e.data); };
    sw.postMessage('version', [ch.port2]);
  });
}

/** Show the running version under the level grid (for grown-ups checking an update). */
async function showVersion() {
  const v = await runningVersion();
  const el = document.getElementById('appVersion');
  if (el) el.textContent = v ? 'Version ' + v.replace(CACHE_PREFIX + 'v', '') : '';
}

/**
 * "Check for update" in the level select. Asks the website which version is
 * current; if it's newer than the running one, installs it (the service
 * worker takes over and the controllerchange handler reloads). If that hasn't
 * happened within 10 s, clears this game's caches and reloads from the
 * network. Nothing is cleared unless the website answered, so pressing it
 * offline can't leave the game unable to start.
 */
async function checkForUpdate() {
  const btn = document.getElementById('updateBtn');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = '⏳ Checking…';
  const done = msg => { btn.disabled = false; btn.textContent = '🔄 Check for update'; if (msg) showToast(msg); };
  let latest = null;
  try {
    const res = await fetch('sw.js?check=' + Date.now(), { cache: 'no-store' });
    if (res.ok) latest = ((await res.text()).match(/CACHE_VERSION = '([^']+)'/) || [])[1] || null;
  } catch (e) { /* offline */ }
  if (!latest) return done("Can't reach the game's website. Try again when online.");
  const running = await runningVersion();
  if (running === latest) return done('Up to date ✓');
  btn.textContent = '⏳ Updating…';
  try { if (swReg) await swReg.update(); } catch (e) {}
  setTimeout(hardRefresh, 10000);
}

async function hardRefresh() {
  try {
    for (const k of await caches.keys()) if (k.startsWith(CACHE_PREFIX)) await caches.delete(k);
    if (swReg) await swReg.unregister();
  } catch (e) { console.warn('[update] hard refresh:', e); }
  window.location.reload();
}

boot();
