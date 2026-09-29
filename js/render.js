// Board rendering: grid cells, walls, holes, gates, blocks.
// Blocks are created once per level (SVG + drawn animal head are static).
// Subsequent updates just reposition via CSS transform, enabling smooth
// sub-cell drag.

import { state } from './state.js';
import { cellsOf, bbox, gateLine, iceLeft, locksShut } from './geometry.js';
import { critterSVG } from './critters.js';
import { snowflakeSVG, keySVG, padlockSVG } from './badges.js';

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

// Emoji stand-ins, kept for the level editor's palette. The game itself draws
// the animals with critterSVG() from critters.js.
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
  // Doors stick out 0.4 cell above and below the board (see renderBoard).
  state.cellSize = Math.max(24, Math.min(
    Math.floor(maxW / lv.cols),
    Math.floor(maxH / (lv.rows + 0.8)),
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

  markWallsAndHoles(board, lv);

  const wrap = document.getElementById('bw');
  wrap.querySelectorAll('.gate, .gate-lock').forEach(e => e.remove());
  // Room for top and bottom doors (and their padlocks), so they never run
  // into the top bar or the buttons below.
  wrap.style.margin = `${Math.round(cs * 0.4)}px 0`;
  // Defer so the board has settled in layout before we measure.
  requestAnimationFrame(() => {
    lv.gates.forEach((g, i) => placeGate(g, wrap, board, i));
    refreshStatus(lv, state.blocks, { instant: true });
  });

  for (const b of state.blocks) createBlockElement(b);
  refreshStatus(lv, state.blocks, { instant: true });
  document.getElementById('ll').textContent = lv.label;
}

/**
 * Style the rock and hole cells of a freshly built grid (cells in row-major
 * order). A board with holes gets the `shaped` class and a drawn outline that
 * follows its shape instead of the rectangular frame. Shared with the editor.
 */
export function markWallsAndHoles(board, lv) {
  const cells = board.querySelectorAll('.cell');
  for (const w of lv.walls || []) {
    const el = cells[w.row * lv.cols + w.col];
    if (el) el.classList.add('wall-cell');
  }
  for (const h of lv.holes || []) {
    const el = cells[h.row * lv.cols + h.col];
    if (el) { el.classList.remove('wall-cell'); el.classList.add('hole-cell'); }
  }
  board.querySelectorAll('.board-shape').forEach(e => e.remove());
  const shaped = !!(lv.holes && lv.holes.length);
  board.classList.toggle('shaped', shaped);
  if (shaped) board.prepend(boardShapeSVG(lv, state.cellSize));
}

/**
 * The board's outline as one SVG path traced around the cells that are not
 * holes (outer edge and any inner lakes), filled like the rectangular board
 * and stroked like its frame. Sits under the cells.
 */
function boardShapeSVG(lv, cs) {
  const holes = new Set((lv.holes || []).map(h => h.col + ',' + h.row));
  const inside = (c, r) => c >= 0 && r >= 0 && c < lv.cols && r < lv.rows && !holes.has(c + ',' + r);
  // Directed boundary edges with the board on their right-hand side
  // (clockwise on screen), keyed by start corner.
  const edges = new Map();
  const add = (x1, y1, x2, y2) => {
    const k = x1 + ',' + y1;
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k).push([x2, y2]);
  };
  for (let r = 0; r < lv.rows; r++) for (let c = 0; c < lv.cols; c++) {
    if (!inside(c, r)) continue;
    if (!inside(c, r - 1)) add(c, r, c + 1, r);
    if (!inside(c + 1, r)) add(c + 1, r, c + 1, r + 1);
    if (!inside(c, r + 1)) add(c + 1, r + 1, c, r + 1);
    if (!inside(c - 1, r)) add(c, r + 1, c, r);
  }
  const B = 3; // the board's border width: cells start 3px inside the SVG
  let d = '';
  for (const [start, outs] of edges) {
    while (outs.length) {
      let [x, y] = start.split(',').map(Number);
      const pts = [[x, y]];
      let next = outs.pop();
      while (next) {
        const [nx, ny] = next;
        pts.push([nx, ny]);
        if (nx + ',' + ny === start) break;
        const cand = edges.get(nx + ',' + ny) || [];
        // At a pinch corner prefer the right turn so loops stay separate.
        const [px, py] = pts[pts.length - 2];
        const dx = nx - px, dy = ny - py;
        let pick = cand.findIndex(([qx, qy]) => (qx - nx) === -dy && (qy - ny) === dx);
        if (pick < 0) pick = 0;
        next = cand.splice(pick, 1)[0];
      }
      // Keep only the corners.
      const corners = pts.filter((p, i) => {
        if (i === 0 || i === pts.length - 1) return true;
        const a = pts[i - 1], b = pts[i + 1];
        return (p[0] - a[0]) * (b[1] - p[1]) !== (p[1] - a[1]) * (b[0] - p[0]);
      });
      d += 'M' + corners.map(([px, py]) => `${B + px * cs} ${B + py * cs}`).join(' L') + ' Z ';
    }
  }
  const W = lv.cols * cs + 2 * B, H = lv.rows * cs + 2 * B;
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('class', 'board-shape');
  el.setAttribute('width', W);
  el.setAttribute('height', H);
  el.innerHTML = `<path d="${d}" fill="#f8f4ff" fill-rule="evenodd" stroke="#d8c8f0" stroke-width="${2 * B + 2}" stroke-linejoin="round"/>`
    + `<path d="${d}" fill="none" fill-rule="evenodd" stroke="rgba(100,60,150,0.08)" stroke-width="3" stroke-linejoin="round"/>`;
  return el;
}

/** Pixel box of a gate relative to the board's top-left border corner. */
export function gateBox(g, lv, cs) {
  const gw = cs * 0.4;
  const sz = g.size || 1;
  const line = gateLine(g, lv);
  if (line === null) return null;
  if (g.side === 'right')  return { left: cs * (line + 1), top: g.exit_row * cs, width: gw, height: cs * sz };
  if (g.side === 'left')   return { left: cs * line - gw, top: g.exit_row * cs, width: gw, height: cs * sz };
  if (g.side === 'bottom') return { left: g.exit_col * cs, top: cs * (line + 1), width: cs * sz, height: gw };
  return { left: g.exit_col * cs, top: cs * line - gw, width: cs * sz, height: gw };
}

function placeGate(g, wrap, board, index) {
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
  const box = gateBox(g, lv, cs);
  if (!box) return;

  const radius = { right: '0 14px 14px 0', left: '14px 0 0 14px', bottom: '0 0 14px 14px', top: '14px 14px 0 0' }[g.side];
  const noBorder = { right: 'left', left: 'right', bottom: 'top', top: 'bottom' }[g.side];
  el.style.cssText += `;width:${box.width}px;height:${box.height}px;left:${bx + box.left}px;top:${by + box.top}px;`
    + `border-radius:${radius};border-${noBorder}:none;`;
  el.style.background = `linear-gradient(135deg, ${col.bg}, ${col.brd})`;
  // The animal who lives behind this door (no blinking: keeps doors calm and cheap).
  el.innerHTML = critterSVG(g.color, { blink: false, size: Math.round(gw * 0.95) });
  el.dataset.color = g.color;
  el.dataset.side = g.side;
  el.dataset.gateIndex = index;
  wrap.appendChild(el);
  if (g.lock) {
    // The padlock hangs on the door (a sibling: the door clips its children).
    el.classList.add('locked');
    wrap.appendChild(gateLockBadge(bx + box.left + box.width / 2, by + box.top + box.height / 2, cs, index));
  }
}

/** A padlock centred on (x, y), for a padlocked door. Shared with the editor. */
export function gateLockBadge(x, y, cs, index) {
  const lock = document.createElement('div');
  lock.className = 'badge gate-lock';
  const ls = Math.round(Math.max(22, Math.min(cs * 0.6, 40)));
  lock.style.cssText = `left:${x - ls / 2}px;top:${y - ls / 2}px;width:${ls}px;height:${ls}px;`;
  lock.dataset.gateIndex = index;
  lock.innerHTML = padlockSVG();
  return lock;
}

/**
 * Build a new block DOM element and place it on the board. Called once per level.
 * The level editor passes its own board (#editorBoard); the game uses #board.
 */
export function createBlockElement(b, board = document.getElementById('board')) {
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

  g.appendChild(svg);

  // The animal's head, centred on the biggest solid part of the piece.
  const spot = faceSpot(cells, bb);
  let fx = spot.x * cs, fy = spot.y * cs;
  const shortSide = Math.min(spot.w, spot.h) * cs;
  let size = shortSide * 0.94;
  const constrained = b.dir === 'h' || b.dir === 'v';
  const ad = cs * 0.22;      // arrowhead depth
  const am = cs * 0.06;      // arrowhead gap from the block edge
  // Arrow runs along x (dir h) or y (dir v) through the head's centre, between
  // the ends of the head's rectangle.
  const rx0 = (spot.x - spot.w / 2) * cs, rx1 = (spot.x + spot.w / 2) * cs;
  const ry0 = (spot.y - spot.h / 2) * cs, ry1 = (spot.y + spot.h / 2) * cs;
  let ax = fx, ay = fy, shaft = false;
  if (constrained) {
    const alongCells = b.dir === 'h' ? spot.w : spot.h;
    const crossCells = b.dir === 'h' ? spot.h : spot.w;
    if (alongCells < 2 && crossCells >= 2) {
      // Moves across its short side (e.g. a tall piece that slides sideways):
      // head in the first cell, a full double arrow in the last one.
      size = cs * 0.86;
      if (b.dir === 'h') { fy = ry0 + cs / 2; ay = ry1 - cs / 2; }
      else               { fx = rx0 + cs / 2; ax = rx1 - cs / 2; }
      shaft = true;
    } else {
      // Leave room at both ends for the arrowheads.
      size = Math.max(shortSide * 0.5, Math.min(size, alongCells * cs - 2 * (ad + am)));
    }
  }
  const face = document.createElement('div');
  face.className = 'face';
  face.style.cssText = `left:${fx - size / 2}px;top:${fy - size / 2}px;width:${size}px;height:${size}px;`;
  face.dataset.color = b.color;
  face.innerHTML = critterSVG(b.color, { blinkDelay: Math.random() * 4.6 });
  g.appendChild(face);

  if (b.ice) addIce(g, b, paths, W, H, { fx, fy, size });
  if (b.key || b.lock) {
    // Key: a sticker on the head's shoulder. Padlock: hung over the chin.
    const bs = Math.max(20, Math.min(size * 0.52, cs * 0.62));
    const badge = document.createElement('div');
    badge.className = 'badge ' + (b.key ? 'block-key' : 'block-lock');
    const bxp = b.key ? fx + size * 0.5 - bs * 0.62 : fx - bs / 2;
    const byp = b.key ? fy - size * 0.5 - bs * 0.2 : fy + size * 0.5 - bs * 0.78;
    badge.style.cssText = `left:${bxp}px;top:${byp}px;width:${bs}px;height:${bs}px;`;
    badge.innerHTML = b.key ? keySVG() : padlockSVG();
    g.appendChild(badge);
  }

  // Direction arrowheads for constrained blocks, at both ends of the piece.
  if (constrained) {
    const a = document.createElement('div');
    a.className = 'da';
    a.style.cssText = 'left:0;top:0;width:100%;height:100%;';
    const ac = b.color === 'yellow' ? 'rgba(120,90,0,0.45)' : 'rgba(255,255,255,0.85)';
    const hw = ad * 0.95;    // half the arrowhead's width
    const sw = Math.max(2, cs * 0.06);
    let d = b.dir === 'h'
      ? `M${rx0 + am + ad} ${ay - hw} L${rx0 + am} ${ay} L${rx0 + am + ad} ${ay + hw} Z M${rx1 - am - ad} ${ay - hw} L${rx1 - am} ${ay} L${rx1 - am - ad} ${ay + hw} Z`
      : `M${ax - hw} ${ry0 + am + ad} L${ax} ${ry0 + am} L${ax + hw} ${ry0 + am + ad} Z M${ax - hw} ${ry1 - am - ad} L${ax} ${ry1 - am} L${ax + hw} ${ry1 - am - ad} Z`;
    let extra = '';
    if (shaft) {
      const sd = b.dir === 'h'
        ? `M${rx0 + am + ad} ${ay} L${rx1 - am - ad} ${ay}`
        : `M${ax} ${ry0 + am + ad} L${ax} ${ry1 - am - ad}`;
      extra = `<path d="${sd}" stroke="${ac}" stroke-width="${cs * 0.14}"/>`;
    }
    a.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="${SVG_NS}"><path d="${d}" fill="${ac}" stroke="${ac}" stroke-width="${sw}" stroke-linejoin="round"/>${extra}</svg>`;
    g.appendChild(a);
  }
}

/**
 * Frozen animal: a frosty sheet over the whole piece (same outline) with a row
 * of snowflakes, one per animal that still has to go home before it thaws.
 */
function addIce(g, b, paths, W, H, { fx, fy, size }) {
  const cs = state.cellSize;
  const ice = document.createElement('div');
  ice.className = 'ice';
  const gid = 'ice' + b.id;
  // A few diagonal glints clipped to the piece.
  let glints = '';
  for (let x = -H; x < W; x += cs * 1.3) {
    glints += `<path d="M${x} ${H} L${x + H} 0" stroke="rgba(255,255,255,0.55)" stroke-width="${cs * 0.07}"/>`
      + `<path d="M${x + cs * 0.22} ${H} L${x + H + cs * 0.22} 0" stroke="rgba(255,255,255,0.35)" stroke-width="${cs * 0.03}"/>`;
  }
  ice.innerHTML = `<svg width="${W}" height="${H}" xmlns="${SVG_NS}" style="overflow:visible">`
    + `<defs><clipPath id="${gid}c"><path d="${paths}"/></clipPath>`
    + `<linearGradient id="${gid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgba(235,250,255,0.5)"/><stop offset="1" stop-color="rgba(150,215,245,0.42)"/></linearGradient></defs>`
    + `<path d="${paths}" fill="url(#${gid}g)"/>`
    + `<g clip-path="url(#${gid}c)">${glints}</g>`
    + `<path d="${paths}" fill="none" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>`
    + `<path d="${paths}" fill="none" stroke="rgba(80,170,220,0.7)" stroke-width="1.5" stroke-linejoin="round"/>`
    + `</svg>`;
  g.appendChild(ice);

  const pips = document.createElement('div');
  pips.className = 'pips';
  const ps = Math.round(Math.max(18, Math.min(cs * 0.42, 30)));
  pips.style.cssText = `left:${fx}px;top:${fy + size * 0.5 - ps * 0.55}px;--ps:${ps}px;`;
  for (let i = 0; i < b.ice; i++) {
    const p = document.createElement('div');
    p.className = 'pip';
    p.innerHTML = snowflakeSVG();
    pips.appendChild(p);
  }
  g.appendChild(pips);
}

/**
 * Bring the ice and padlocks in line with how many animals have gone home.
 * Melted snowflakes pop, fully thawed ice shatters, and padlocks spring open
 * once the key is home. Safe to call any time (no-op when nothing changed).
 * `instant` (after a re-render) skips the animations.
 * Returns what changed: { cracked, thawed, unlocked } for the sound effects.
 */
export function refreshStatus(level, blocks, { instant = false, root = document } = {}) {
  const out = { cracked: false, thawed: false, unlocked: false };
  for (const b of blocks) {
    const el = root.querySelector('#bg-' + CSS.escape(b.id));
    if (!el) continue;
    if (b.ice) {
      const left = iceLeft(b, level, blocks);
      const pips = [...el.querySelectorAll('.pip:not(.gone)')];
      for (let i = left; i < pips.length; i++) {
        if (instant) pips[i].remove(); else pips[i].classList.add('gone');
        out.cracked = true;
      }
      const ice = el.querySelector('.ice:not(.melting)');
      if (left === 0 && ice) {
        out.thawed = true;
        const pipRow = el.querySelector('.pips');
        if (instant) { ice.remove(); pipRow?.remove(); }
        else {
          ice.classList.add('melting');
          pipRow?.classList.add('melting');
          setTimeout(() => { ice.remove(); pipRow?.remove(); }, 650);
        }
      }
      el.classList.toggle('frozen', left > 0);
    }
    if (b.lock) {
      const shut = locksShut(level, blocks);
      el.classList.toggle('locked', shut);
      if (!shut && openBadge(el.querySelector('.block-lock'), instant)) out.unlocked = true;
    }
  }
  if (!locksShut(level, blocks)) {
    for (const gEl of root.querySelectorAll('.gate.locked')) gEl.classList.remove('locked');
    for (const lock of root.querySelectorAll('.gate-lock')) {
      if (openBadge(lock, instant)) out.unlocked = true;
    }
  }
  return out;
}

/** Pop a padlock badge open and fade it away. True if it was still shut. */
function openBadge(badge, instant) {
  if (!badge || badge.classList.contains('opening')) return false;
  if (instant) { badge.remove(); return true; }
  badge.innerHTML = padlockSVG({ open: true });
  badge.classList.add('opening');
  setTimeout(() => badge.remove(), 900);
  return true;
}

/**
 * The player pressed an animal that can't move yet: wiggle it and draw the
 * eye to the reason (its snowflakes pulse, or the key carriers glint).
 */
export function nudgeStuck(b, blocks) {
  const el = document.getElementById('bg-' + b.id);
  if (!el) return;
  const again = (node, cls, ms) => {
    if (!node) return;
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
    setTimeout(() => node.classList.remove(cls), ms);
  };
  again(el, 'shiver', 520);
  if (el.classList.contains('frozen')) again(el.querySelector('.pips'), 'pulse', 700);
  else {
    again(el.querySelector('.block-lock'), 'pulse', 700);
    for (const k of blocks.filter(x => x.key)) again(document.querySelector('#bg-' + CSS.escape(k.id) + ' .block-key'), 'glint', 1100);
  }
}

/**
 * Where the head goes: the centre (in cells, relative to the bounding box) of
 * the filled rectangle with the longest short side, then the biggest area,
 * then closest to the piece's middle. For an L or T that is one arm, never an
 * empty corner of the bounding box.
 */
function faceSpot(cells, bb) {
  const w = bb.w, h = bb.h;
  const filled = new Set(cells.map(({ c, r }) => `${c - bb.minC},${r - bb.minR}`));
  let mx = 0, my = 0;
  for (const { c, r } of cells) { mx += c - bb.minC + 0.5; my += r - bb.minR + 0.5; }
  mx /= cells.length; my /= cells.length;
  let best = null;
  for (let x0 = 0; x0 < w; x0++) for (let y0 = 0; y0 < h; y0++) {
    for (let x1 = x0; x1 < w; x1++) for (let y1 = y0; y1 < h; y1++) {
      let ok = true;
      for (let x = x0; x <= x1 && ok; x++) for (let y = y0; y <= y1; y++) {
        if (!filled.has(`${x},${y}`)) { ok = false; break; }
      }
      if (!ok) continue;
      const rw = x1 - x0 + 1, rh = y1 - y0 + 1;
      const cx = x0 + rw / 2, cy = y0 + rh / 2;
      const cand = { x: cx, y: cy, w: rw, h: rh, s: Math.min(rw, rh), a: rw * rh, d: Math.hypot(cx - mx, cy - my) };
      if (!best || cand.s > best.s || (cand.s === best.s && (cand.a > best.a ||
          (cand.a === best.a && cand.d < best.d - 1e-9)))) best = cand;
    }
  }
  return best || { x: w / 2, y: h / 2, w: 1, h: 1 };
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

    // Home at last: swap to the happy face (^ ^ and a big smile) for the exit.
    const face = el.querySelector('.face');
    if (face) face.innerHTML = critterSVG(b.color, { mood: 'happy' });
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
