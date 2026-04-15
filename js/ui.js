// UI overlays, toasts, tutorial, level select.

import { state, loadProgress, tutorialSeen, markTutorialSeen } from './state.js';

// Encouragement messages
const CHEERS = ['Great move! 🌟', 'You got this! 💪', 'So smart! 🧠', 'Keep going! 🚀', 'Awesome! ⭐', 'Nice one! 👏', 'Wonderful! 🌈'];
const WIN_MSGS = ["You're a puzzle star!", 'Your brain is amazing!', 'What a smarty pants!', 'Incredible work!', "You're unstoppable!"];
const WIN_EMOJIS = ['🎉', '⭐', '🌟', '🏆', '🎊', '✨'];

export function pickCheer() { return CHEERS[(Math.random() * CHEERS.length) | 0]; }
export function pickWinMsg() { return WIN_MSGS[(Math.random() * WIN_MSGS.length) | 0]; }
export function pickWinEmoji() { return WIN_EMOJIS[(Math.random() * WIN_EMOJIS.length) | 0]; }

export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

export function updateMoveCount() {
  document.getElementById('moveCount').textContent =
    state.moveCount > 0 ? `${state.moveCount} moves` : '';
}

// ── Tutorial ────────────────────────────────────────────────────
export function maybeShowTutorial() {
  if (!tutorialSeen()) document.getElementById('tutorial').classList.add('show');
}
export function closeTutorial() {
  document.getElementById('tutorial').classList.remove('show');
  markTutorialSeen();
}

// ── Level select ────────────────────────────────────────────────
export function openLevelSelect(onSelect) {
  const p = loadProgress();
  const grid = document.getElementById('lgrid');
  grid.innerHTML = '';
  state.levels.forEach((lv, i) => {
    const div = document.createElement('div');
    const done = i < p.best;
    const cur = i === state.levelIndex;
    div.className = 'lv' + (done ? ' done' : ' open') + (cur ? ' cur' : '');
    const starCount = (p.stars && p.stars[i]) ? p.stars[i] : 0;
    const starStr = done ? '⭐'.repeat(starCount) + '☆'.repeat(3 - starCount) : '';
    div.innerHTML =
      `<span class="lnum">${i + 1}</span>` +
      (done ? '<span class="ck">✓</span>' : '') +
      (starStr ? `<span class="lstars">${starStr}</span>` : '');
    div.addEventListener('click', () => {
      closeLevelSelect();
      onSelect(i);
    });
    grid.appendChild(div);
  });
  document.getElementById('ls').classList.add('show');
}
export function closeLevelSelect() {
  document.getElementById('ls').classList.remove('show');
}

// ── Win overlay ─────────────────────────────────────────────────
export function showWinOverlay(stars) {
  const starStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
  document.getElementById('winStars').textContent = starStr;
  document.getElementById('winMsg').textContent = pickWinMsg();
  document.getElementById('oe').textContent = pickWinEmoji();
  document.getElementById('ov').classList.add('show');
}
export function hideWinOverlay() {
  document.getElementById('ov').classList.remove('show');
}
