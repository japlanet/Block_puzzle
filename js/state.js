// Central game state + localStorage-backed progress.
// Other modules read/write through this to keep the game-wide state coherent.

export const state = {
  levels: [],       // Array of normalized level definitions
  levelIndex: 0,    // Index into levels
  level: null,      // Active level definition (reference into levels)
  blocks: [],       // Live blocks on the board (mutated during play)
  cellSize: 70,     // Pixel size of one grid cell (recomputed on resize)
  selectedId: null, // ID of currently-selected block, or null
  dragInfo: null,   // { id, px, py, sc, sr, offX, offY } during pointer drag
  moveCount: 0,     // Moves this level
  soundOn: true,
};

// ── Progress (localStorage) ─────────────────────────────────────
const SAVE_KEY = 'animal_escape_progress';
const TUT_KEY = 'animal_escape_tut';
const SOUND_KEY = 'animal_escape_sound';

export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || { best: 0, stars: {} };
  } catch (e) {
    return { best: 0, stars: {} };
  }
}

export function saveProgress(p) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(p)); } catch (e) {}
}

export function recordLevelComplete(levelIdx, stars) {
  const p = loadProgress();
  if (levelIdx + 1 > p.best) p.best = levelIdx + 1;
  if (!p.stars) p.stars = {};
  const prev = p.stars[levelIdx] || 0;
  if (stars > prev) p.stars[levelIdx] = stars;
  saveProgress(p);
}

export function getSavedLevelIdx() {
  return Math.min(loadProgress().best, state.levels.length - 1);
}

export function tutorialSeen() {
  try { return localStorage.getItem(TUT_KEY) === '1'; } catch (e) { return false; }
}
export function markTutorialSeen() {
  try { localStorage.setItem(TUT_KEY, '1'); } catch (e) {}
}

export function loadSoundPref() {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    return v === null ? true : v === '1';
  } catch (e) { return true; }
}
export function saveSoundPref(on) {
  try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch (e) {}
}
