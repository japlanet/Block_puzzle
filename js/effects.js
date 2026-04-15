// Visual effects: background bubbles, win fireworks, exit particle bursts.

import { COLORS } from './render.js';

// ── Background bubbles (created once at startup) ─────────────────
export function createBubbles() {
  const palette = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'];
  for (let i = 0; i < 12; i++) {
    const b = document.createElement('div');
    b.className = 'bubble';
    const sz = 20 + Math.random() * 40;
    const c = COLORS[palette[i % palette.length]].bg + '66';
    b.style.cssText =
      `width:${sz}px;height:${sz}px;background:${c};` +
      `left:${Math.random() * 100}vw;` +
      `animation-duration:${8 + Math.random() * 12}s;` +
      `animation-delay:${-Math.random() * 10}s;`;
    document.body.appendChild(b);
  }
}

// ── Win fireworks (color burst across the whole screen) ──────────
const BURST_COLORS = ['#ff6b6b', '#54a0ff', '#6bcb77', '#ffd93d', '#a882dd', '#ff9f43', '#ff6b9d', '#48dbfb'];
export function launchFireworks() {
  const fw = document.getElementById('fw');
  fw.innerHTML = '';
  for (let i = 0; i < 90; i++) {
    setTimeout(() => {
      const s = document.createElement('div');
      s.className = 'sp';
      const sz = 8 + Math.random() * 14;
      const col = BURST_COLORS[(Math.random() * BURST_COLORS.length) | 0];
      s.style.cssText =
        `width:${sz}px;height:${sz}px;background:${col};` +
        `left:${10 + Math.random() * 80}vw;top:${10 + Math.random() * 60}vh;` +
        `animation-duration:${0.6 + Math.random() * 0.8}s;` +
        `border-radius:${Math.random() > 0.5 ? '50%' : '3px'};`;
      const ang = Math.random() * Math.PI * 2;
      const d = 60 + Math.random() * 150;
      s.style.setProperty('--tx', Math.cos(ang) * d + 'px');
      s.style.setProperty('--ty', Math.sin(ang) * d + 80 + 'px');
      fw.appendChild(s);
      setTimeout(() => s.remove(), 1600);
    }, i * 18);
  }
}

/**
 * Small colored particle burst at the gate when a matching block exits.
 * gateRect = DOMRect of the gate element.
 */
export function exitBurst(gateRect, color) {
  const fw = document.getElementById('fw');
  const centerX = gateRect.left + gateRect.width / 2;
  const centerY = gateRect.top + gateRect.height / 2;
  const main = COLORS[color]?.bg || '#ff6b9d';
  const accent = COLORS[color]?.brd || '#ff4081';
  const colors = [main, accent, '#fff'];
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('div');
    s.className = 'exitBurst';
    const sz = 6 + Math.random() * 8;
    s.style.cssText =
      `width:${sz}px;height:${sz}px;background:${colors[i % colors.length]};` +
      `left:${centerX - sz / 2}px;top:${centerY - sz / 2}px;`;
    const ang = Math.random() * Math.PI * 2;
    const d = 40 + Math.random() * 60;
    s.style.setProperty('--bx', Math.cos(ang) * d + 'px');
    s.style.setProperty('--by', Math.sin(ang) * d + 'px');
    fw.appendChild(s);
    setTimeout(() => s.remove(), 650);
  }
}
