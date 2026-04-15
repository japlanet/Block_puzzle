// Board rendering: grid cells, walls, gates, blocks.
// Blocks are created once per level (SVG + emoji are static). Subsequent updates
// just reposition via CSS transform, enabling smooth sub-cell drag.

import { state } from './state.js';
import { cellsOf, bbox } from './geometry.js';

export const COLORS = {
  red:    { bg: '#ff6b6b', brd: '#e55050', arr: 'rgba(255,255,255,0.5)', light: '#ffe0e0' },
  blue:   { bg: '#54a0ff', brd: '#3a80e0', arr: 'rgba(255,255,255,0.5)', light: '#d8eeff' },
  green:  { bg: '#6bcb77', brd: '#4caf50', arr: 'rgba(255,255,255,0.5)', light: '#e0f5e0' },
  yellow: { bg: '#ffd93d', brd: '#e6c235', arr: 'rgba(0,0,0,0.2)',       light: '#fff8d0' },
  purple: { bg: '#a882dd', brd: '#8860c8', arr: 'rgba(255,255,255,0.5)', light: '#f0e0ff' },
  orange: { bg: '#ff9f43', brd: '#e88830', arr: 'rgba(255,255,255,0.5)', light: '#fff0d8' },
  pink:   { bg: '#ff6b9d', brd: '#e85080', arr: 'rgba(255,255,255,0.5)', light: '#ffe0ee' },
  teal:   { bg: '#48dbfb', brd: '#30c0e0', arr: 'rgba(255,255,255,0.5)', light: '#d8f8ff' },
};

export const ANIMALS = {
  red: '🦊', blue: '🐳', green: '🐸', yellow: '🐤',
  purple: '🦄', orange: '🦁', pink: '🐷', teal: '🐢',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Compute cell size to fit the viewport given the active level. */
export function calcCellSize() {
  const lv = state.level;
  const maxW = Math.min(window.innerWidth - 28, 520);
  const maxH = window.innerHeight - 180;
  state.cellSize = Math.max(24, Math.min(
    Math.floor(maxW / lv.cols),
    Math.floor(maxH / lv.rows),
    72
  ));
}

/** Full re-render of the board for the current level. */
export function renderBoard() {
  calcCellSize();
  const cs = state.cellSize;
  const lv = state.level;
  const board = document.getElementById('board');
  board.innerHTML = '';
  board.style.gridTemplateColumns = `repeat(${lv.cols}, ${cs}px)`;
  board.style.gridTemplateRows    = `repeat(${lv.rows}, ${cs}px)`;
  board.style.width  = `${cs * lv.cols}px`;
  board.style.height = `${cs * lv.rows}px`;

  for (let r = 0; r < lv.rows; r++) {
    for (let c = 0; c < lv.cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      board.appendChild(cell);
    }
  }

  if (lv.walls && lv.walls.length) {
    const cells = board.querySelectorAll('.cell');
    for (const w of lv.walls) {
      const idx = w.row * lv.cols + w.col;
      if (cells[idx]) cells[idx].className = 'cell wall-cell';
    }
  }

  const wrap = document.getElementById('bw');
  wrap.querySelectorAll('.gate').forEach(e => e.remove());
  // Defer so the board has settled in layout before we measure.
  requestAnimationFrame(() => {
    for (const g of lv.gates) placeGate(g, wrap, board);
  });

  for (const b of state.blocks) createBlockElement(b);
  document.getElementById('ll').textContent = lv.label;
}

function placeGate(g, wrap, board) {
  const cs = state.cellSize;
  const lv = state.level;
  const el = document.createElement('div');
  el.className = 'gate';
  const col = COLORS[g.color];
  el.style.background = `linear-gradient(135deg, ${col.bg}, ${col.brd})`;
  el.style.border = `3px solid ${col.brd}`;
  el.style.color = g.color === 'yellow' ? '#6a5a20' : '#fff';
  el.style.textShadow = g.color === 'yellow' ? 'none' : '0 1px 2px rgba(0,0,0,0.2)';

  const br = board.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  const bx = br.left - wr.left;
  const by = br.top - wr.top;
  const gw = cs * 0.4;
  const sz = g.size;
  const emoji = ANIMALS[g.color] || '⭐';

  const base = `border-radius:14px;`;
  if (g.side === 'right') {
    el.style.cssText += `;${base}width:${gw}px;height:${cs * sz}px;left:${bx + cs * lv.cols}px;top:${by + g.exit_row * cs}px;border-radius:0 14px 14px 0;border-left:none;`;
  } else if (g.side === 'left') {
    el.style.cssText += `;${base}width:${gw}px;height:${cs * sz}px;left:${bx - gw}px;top:${by + g.exit_row * cs}px;border-radius:14px 0 0 14px;border-right:none;`;
  } else if (g.side === 'bottom') {
    el.style.cssText += `;${base}height:${gw}px;width:${cs * sz}px;top:${by + cs * lv.rows}px;left:${bx + g.exit_col * cs}px;border-radius:0 0 14px 14px;border-top:none;`;
  } else { // top
    el.style.cssText += `;${base}height:${gw}px;width:${cs * sz}px;top:${by - gw}px;left:${bx + g.exit_col * cs}px;border-radius:14px 14px 0 0;border-bottom:none;`;
  }
  el.style.background = `linear-gradient(135deg, ${col.bg}, ${col.brd})`;
  el.textContent = emoji;
  el.dataset.color = g.color;
  el.dataset.side = g.side;
  wrap.appendChild(el);
}

/** Build a new block DOM element and place it on the board. Called once per level. */
export function createBlockElement(b) {
  const board = document.getElementById('board');
  const cs = state.cellSize;
  const g = document.createElement('div');
  g.id = 'bg-' + b.id;
  g.className = 'bg';
  g.style.animationDelay = (Math.random() * 2).toFixed(2) + 's';
  board.appendChild(g);
  drawBlockInterior(g, b);
  positionBlockElement(b);
  return g;
}

function drawBlockInterior(g, b) {
  g.innerHTML = '';
  const cs = state.cellSize;
  const col = COLORS[b.color];
  const bb = bbox(b);
  const W = bb.w * cs;
  const H = bb.h * cs;
  g.style.width = W + 'px';
  g.style.height = H + 'px';

  const cells = cellsOf(b);
  const cellKeys = new Set(cells.map(({ c, r }) => `${c},${r}`));
  const r2 = Math.max(8, cs * 0.2);
  let paths = '';
  const pad = 2;
  for (const { c, r } of cells) {
    const x = (c - bb.minC) * cs + pad;
    const y = (r - bb.minR) * cs + pad;
    const w = cs - pad * 2;
    const h = cs - pad * 2;
    const hasT = cellKeys.has(`${c},${r - 1}`);
    const hasB = cellKeys.has(`${c},${r + 1}`);
    const hasL = cellKeys.has(`${c - 1},${r}`);
    const hasR = cellKeys.has(`${c + 1},${r}`);
    const tlR = hasT || hasL ? 2 : r2;
    const trR = hasT || hasR ? 2 : r2;
    const blR = hasB || hasL ? 2 : r2;
    const brR = hasB || hasR ? 2 : r2;
    paths += `M ${x + tlR} ${y} L ${x + w - trR} ${y} Q ${x + w} ${y} ${x + w} ${y + trR} `
           + `L ${x + w} ${y + h - brR} Q ${x + w} ${y + h} ${x + w - brR} ${y + h} `
           + `L ${x + blR} ${y + h} Q ${x} ${y + h} ${x} ${y + h - blR} `
           + `L ${x} ${y + tlR} Q ${x} ${y} ${x + tlR} ${y} Z `;
  }

  const animal = ANIMALS[b.color] || '⭐';
  const eFontSize = Math.max(16, Math.min(cs * 0.55, W < cs * 1.5 ? cs * 0.5 : cs * 0.58));

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none;';

  const defs = document.createElementNS(SVG_NS, 'defs');
  const fid = 'f' + b.id;
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.id = fid;
  filter.setAttribute('x', '-20%'); filter.setAttribute('y', '-20%');
  filter.setAttribute('width', '140%'); filter.setAttribute('height', '140%');
  const fe = document.createElementNS(SVG_NS, 'feDropShadow');
  fe.setAttribute('dx', '0'); fe.setAttribute('dy', '3');
  fe.setAttribute('stdDeviation', '4');
  fe.setAttribute('flood-color', 'rgba(0,0,0,0.2)');
  filter.appendChild(fe);
  defs.appendChild(filter);
  svg.appendChild(defs);

  // Gradient fill for a bit more life than flat color.
  const grad = document.createElementNS(SVG_NS, 'linearGradient');
  const gid = 'grad' + b.id;
  grad.id = gid;
  grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
  grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
  const stop1 = document.createElementNS(SVG_NS, 'stop');
  stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', col.bg);
  const stop2 = document.createElementNS(SVG_NS, 'stop');
  stop2.setAttribute('offset', '100%'); stop2.setAttribute('stop-color', col.brd);
  grad.appendChild(stop1); grad.appendChild(stop2);
  defs.appendChild(grad);

  const mainPath = document.createElementNS(SVG_NS, 'path');
  mainPath.setAttribute('d', paths);
  mainPath.setAttribute('fill', `url(#${gid})`);
  mainPath.setAttribute('filter', `url(#${fid})`);
  svg.appendChild(mainPath);

  // Inner highlight — subtle top-edge shine.
  const hlPath = document.createElementNS(SVG_NS, 'path');
  hlPath.setAttribute('d', paths);
  hlPath.setAttribute('fill', 'none');
  hlPath.setAttribute('stroke', 'rgba(255,255,255,0.4)');
  hlPath.setAttribute('stroke-width', '3');
  hlPath.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(hlPath);

  const brdPath = document.createElementNS(SVG_NS, 'path');
  brdPath.setAttribute('d', paths);
  brdPath.setAttribute('fill', 'none');
  brdPath.setAttribute('stroke', col.brd);
  brdPath.setAttribute('stroke-width', '2.5');
  brdPath.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(brdPath);

  // Animal emoji, centered via foreignObject so it scales with the block.
  const fo = document.createElementNS(SVG_NS, 'foreignObject');
  fo.setAttribute('x', '0'); fo.setAttribute('y', '0');
  fo.setAttribute('width', W); fo.setAttribute('height', H);
  fo.style.cssText = 'pointer-events:none;';
  const fd = document.createElement('div');
  fd.style.cssText = `width:${W}px;height:${H}px;display:flex;align-items:center;justify-content:center;font-size:${eFontSize}px;line-height:1;pointer-events:none;`;
  fd.textContent = animal;
  fo.appendChild(fd);
  svg.appendChild(fo);
  g.appendChild(svg);

  // Direction arrow overlay for constrained blocks.
  if (b.dir === 'h' || b.dir === 'v') {
    const a = document.createElement('div');
    a.className = 'da';
    a.style.cssText = 'left:0;top:0;width:100%;height:100%;';
    const ac = col.arr;
    a.innerHTML = b.dir === 'h'
      ? `<svg viewBox="0 0 100 100" xmlns="${SVG_NS}" preserveAspectRatio="none"><polygon points="10,50 30,18 30,38 70,38 70,18 90,50 70,82 70,62 30,62 30,82" fill="${ac}" opacity="0.6"/></svg>`
      : `<svg viewBox="0 0 100 100" xmlns="${SVG_NS}" preserveAspectRatio="none"><polygon points="50,10 82,30 62,30 62,70 82,70 50,90 18,70 38,70 38,30 18,30" fill="${ac}" opacity="0.6"/></svg>`;
    g.appendChild(a);
  }
}

/**
 * Position the block element based on current col/row.
 * subOffset (optional) applies an additional pixel translation for smooth drag.
 */
export function positionBlockElement(b, subOffset = { x: 0, y: 0 }) {
  const el = document.getElementById('bg-' + b.id);
  if (!el) return;
  const cs = state.cellSize;
  const bb = bbox(b);
  el.style.left = bb.minC * cs + 'px';
  el.style.top  = bb.minR * cs + 'px';
  if (subOffset.x || subOffset.y) {
    el.style.transform = `translate(${subOffset.x}px, ${subOffset.y}px)`;
  } else {
    el.style.transform = '';
  }
}

export function setBlockClass(b, extra) {
  const el = document.getElementById('bg-' + b.id);
  if (!el) return;
  el.className = 'bg' + (extra ? ' ' + extra : '');
}

/**
 * Animate a block out through its gate and remove it from the DOM.
 * Returns a promise that resolves when the animation finishes.
 */
export function animateExit(b, gate) {
  return new Promise(resolve => {
    const el = document.getElementById('bg-' + b.id);
    if (!el) { resolve(); return; }
    const cs = state.cellSize;
    // Fly outward by ~1.2 cells in gate's exit direction.
    let dx = 0, dy = 0;
    if (gate.side === 'right')  dx = cs * 1.2;
    if (gate.side === 'left')   dx = -cs * 1.2;
    if (gate.side === 'bottom') dy = cs * 1.2;
    if (gate.side === 'top')    dy = -cs * 1.2;

    el.classList.add('exiting');
    el.style.transform = `translate(${dx}px, ${dy}px) scale(0.4)`;
    el.style.opacity = '0';
    el.style.filter = 'blur(2px)';
    setTimeout(() => {
      el.remove();
      resolve();
    }, 440);
  });
}

/** Remove any remaining block DOM nodes (e.g. on level reset). */
export function clearBlocks() {
  document.querySelectorAll('.bg').forEach(n => n.remove());
}
