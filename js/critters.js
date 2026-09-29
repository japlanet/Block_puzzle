// The animal friends, drawn as SVG heads (same style as the Ice Cream Shop
// critters: round head, soft outline, shiny eyes, rosy cheeks). They sit on
// top of a coloured block, so every head gets a white "sticker" ring and a
// soft offset shadow (plain shapes, no SVG filters) to stand out from it.
//
//   critterSVG('red')                              -> waiting fox that blinks
//   critterSVG('red', { mood: 'happy' })           -> ^ ^ eyes, open smile
//   critterSVG('red', { blink: false })            -> open eyes, no lid anim
//   critterSVG('red', { blinkDelay: 1.3 })         -> blink offset in seconds
//
// Blinking is a CSS animation on the .lid ellipses (see css/style.css). The
// lids also carry transform="scale(1 0)" so they stay invisible on pages
// without that CSS or with reduced motion.

// Head centre / radius in the 200-unit drawing space.
const HX = 100, HY = 95, HR = 62;

// Everything fits in this square box (the unicorn horn tip pokes out a hair).
export const CRITTER_VIEWBOX = '0 -12 200 200';

const INK = '#3b2a20';

const SPECS = {
  red:    { body: '#f98a3c', dark: '#c25a12', light: '#fff3e8', earInner: '#3f2a1a', nose: '#3f2a1a', cheek: '#fb7185' },
  blue:   { body: '#6f8cf2', dark: '#2f4fb8', light: '#e4efff', nose: '#2f4fb8', cheek: '#f9a8d4', water: '#9fe3ff', waterDark: '#2c9bd6' },
  green:  { body: '#8fd66a', dark: '#4f9a33', light: '#dcf7c9', nose: '#4f9a33', cheek: '#fb7185' },
  yellow: { body: '#fff27a', dark: '#d6a100', light: '#fffbd6', beak: '#fb923c', beakDark: '#c2410c', cheek: '#fb923c' },
  purple: { body: '#fcf4ff', dark: '#b9a2f7', light: '#ffffff', earInner: '#f9a8d4', nose: '#e879f9', cheek: '#f9a8d4' },
  orange: { body: '#f6c76b', dark: '#c9862c', light: '#fde9bd', mane: '#b86f1f', mane2: '#df9a3c', earInner: '#fde9bd', nose: '#7c4a1e', cheek: '#fb923c' },
  pink:   { body: '#f9b4cf', dark: '#d9679a', light: '#fddbe8', earInner: '#f48fb1', nose: '#ee8fb9', cheek: '#f472b6' },
  teal:   { body: '#b3e67a', dark: '#5c9a2f', light: '#e6f7cf', shell: '#5f9e3a', shellDark: '#35681c', scute: '#8cc653', rim: '#f1dc8e', nose: '#5c9a2f', cheek: '#fb7185' },
};

// ── tiny shape helpers ─────────────────────────────────────────────
// A shape is { t, a, fill, line, sil, tf }. `sil` shapes form the silhouette
// that gets the white ring + shadow; `line` adds the soft dark outline.
const C = (cx, cy, r, fill, x = {}) => ({ t: 'circle', a: { cx, cy, r }, fill, ...x });
const E = (cx, cy, rx, ry, fill, x = {}) => ({ t: 'ellipse', a: { cx, cy, rx, ry }, fill, ...x });
const P = (d, fill, x = {}) => ({ t: 'path', a: { d }, fill, ...x });
const G = (points, fill, x = {}) => ({ t: 'polygon', a: { points }, fill, ...x });

function geom(s) {
  let out = '';
  for (const k in s.a) out += ` ${k}="${s.a[k]}"`;
  if (s.tf) out += ` transform="${s.tf}"`;
  return out;
}

function star(cx, cy, outer, inner, points) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function hex(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

const pointyEars = s => [
  P('M42 72 L56 4 L92 46 Z', s.body, { line: 1, sil: 1 }),
  P('M52 62 L59 24 L80 46 Z', s.earInner),
  P('M158 72 L144 4 L108 46 Z', s.body, { line: 1, sil: 1 }),
  P('M148 62 L141 24 L120 46 Z', s.earInner),
];
const roundEars = s => [
  C(48, 44, 20, s.body, { line: 1, sil: 1 }), C(48, 44, 11, s.earInner),
  C(152, 44, 20, s.body, { line: 1, sil: 1 }), C(152, 44, 11, s.earInner),
];
const head = s => C(HX, HY, HR, s.body, { line: 1, sil: 1 });

// Lower part of the head below the chord at height y (for chins, masks, bands).
function chin(y, dip) {
  const dx = Math.sqrt(HR * HR - (y - HY) * (y - HY));
  const x1 = (HX - dx).toFixed(1), x2 = (HX + dx).toFixed(1);
  return `M${x1} ${y} Q100 ${y + dip} ${x2} ${y} A${HR} ${HR} 0 0 1 ${x1} ${y} Z`;
}

// ── per-animal back layers (ears, mane, head, markings) ───────────
const BACK = {
  red: s => [
    ...pointyEars(s),
    head(s),
    // White lower face: the fox's "mask".
    P('M38.7 104 Q66 98 100 126 Q134 98 161.3 104 A62 62 0 0 1 38.7 104 Z', s.light),
  ],
  blue: s => [
    // Water spout: a jet with two splashes and a few drops.
    P('M92 40 Q95 22 100 12 Q105 22 108 40 Z', s.water, { line: 1, sil: 1, stroke: s.waterDark }),
    P('M100 16 Q84 -6 62 4 Q78 4 90 22 Z', s.water, { line: 1, sil: 1, stroke: s.waterDark }),
    P('M100 16 Q116 -6 138 4 Q122 4 110 22 Z', s.water, { line: 1, sil: 1, stroke: s.waterDark }),
    C(58, 16, 5, s.water, { line: 1, stroke: s.waterDark }),
    C(142, 16, 5, s.water, { line: 1, stroke: s.waterDark }),
    head(s),
    // Pale chin / belly band with a couple of grooves.
    P(chin(118, 14), s.light),
    `<path d="M62 140 Q100 152 138 140 M76 150 Q100 158 124 150" fill="none" stroke="${s.dark}" stroke-width="3" stroke-linecap="round" opacity="0.28"/>`,
    // Little shine on the forehead.
    E(72, 58, 12, 7, '#fff', { op: 0.35, tf: 'rotate(-30 72 58)' }),
  ],
  green: s => [
    head(s),
    C(72, 46, 21, s.body, { line: 1, sil: 1 }),
    C(128, 46, 21, s.body, { line: 1, sil: 1 }),
    P(chin(128, 8), s.light, { op: 0.8 }),
  ],
  yellow: s => [
    // Feather tuft on top.
    P('M100 40 Q86 16 96 0 Q108 18 100 40 Z', s.body, { line: 1, sil: 1 }),
    P('M98 42 Q72 30 70 12 Q90 20 98 42 Z', s.body, { line: 1, sil: 1 }),
    P('M102 42 Q128 30 130 12 Q110 20 102 42 Z', s.body, { line: 1, sil: 1 }),
    head(s),
    E(100, 44, 14, 6, s.body), // hide the feather bases on the head outline
    E(72, 60, 12, 7, '#fff', { op: 0.45, tf: 'rotate(-30 72 60)' }),
  ],
  purple: s => [
    ...pointyEars(s),
    head(s),
    `<path d="M90 40 L100 -8 L110 40 Z" fill="#fcd34d" stroke="#d97706" stroke-width="2" stroke-linejoin="round"/>`,
    `<path d="M93 26 L107 22 M95 14 L105 11" stroke="#d97706" stroke-width="2" stroke-linecap="round"/>`,
    P('M84 40 Q96 6 112 36 Q104 26 96 42 Z', '#c084fc'),
    P('M104 38 Q120 10 132 40 Q120 30 110 44 Z', '#f9a8d4'),
    P('M66 44 Q70 18 92 30 Q80 30 74 48 Z', '#a5b4fc'),
  ],
  orange: s => [
    G(star(HX, HY + 2, 88, 72, 14), s.mane, { sil: 1 }),
    G(star(HX, HY + 2, 78, 64, 14), s.mane2, { tf: `rotate(12.9 ${HX} ${HY + 2})` }),
    ...roundEars(s),
    head(s),
    E(100, 117, 24, 17, s.light),
  ],
  pink: s => [
    ...pointyEars(s),
    head(s),
  ],
  teal: s => [
    // Shell dome behind the head, with a pale rim and a few scutes.
    P('M14 128 C14 40 56 8 100 8 C144 8 186 40 186 128 Z', s.shell, { line: 1, sil: 1, stroke: s.shellDark }),
    G(hex(100, 32, 17), s.scute, { tf: 'rotate(30 100 32)' }),
    G(hex(52, 60, 15), s.scute),
    G(hex(148, 60, 15), s.scute),
    G(hex(30, 104, 12), s.scute),
    G(hex(170, 104, 12), s.scute),
    P('M8 124 Q100 108 192 124 Q196 138 182 138 Q100 124 18 138 Q4 138 8 124 Z', s.rim, { line: 1, sil: 1, stroke: s.shellDark }),
  ],
};

// Features drawn on the face (the turtle's head is smaller and lower, so its
// face is drawn through a transform on top of the shell).
const FACE_TF = { teal: 'translate(100 116) scale(0.8) translate(-100 -95)' };

function eyes(s, mood, eyeY, blink) {
  let out = '';
  for (const x of [78, 122]) {
    if (mood === 'happy') {
      out += `<path d="M${x - 12} ${eyeY + 2} Q${x} ${eyeY - 12} ${x + 12} ${eyeY + 2}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    } else {
      out += `<circle cx="${x}" cy="${eyeY}" r="12.5" fill="#fff"/>`
           + `<circle cx="${x + 1}" cy="${eyeY + 1}" r="7" fill="#2b2b2b"/>`
           + `<circle cx="${x - 2.5}" cy="${eyeY - 3.5}" r="2.8" fill="#fff"/>`;
      if (blink) out += `<ellipse class="lid" cx="${x}" cy="${eyeY}" rx="13" ry="13" fill="${s.body}" transform="scale(1 0)"/>`;
    }
  }
  return out;
}

function face(color, s, mood, blink) {
  const frog = color === 'green';
  const eyeY = frog ? 46 : 92;
  let out = '';
  if (color === 'teal') out += shapes([head(s), P(chin(126, 6), s.light, { op: 0.8 })], s);
  out += `<ellipse cx="64" cy="114" rx="10" ry="6" fill="${s.cheek}" opacity="0.55"/>`
       + `<ellipse cx="136" cy="114" rx="10" ry="6" fill="${s.cheek}" opacity="0.55"/>`;
  out += eyes(s, mood, eyeY, blink);

  // Nose
  if (color === 'pink') {
    out += `<ellipse cx="100" cy="113" rx="20" ry="13" fill="${s.nose}" stroke="${s.dark}" stroke-width="2" stroke-opacity="0.45"/>`
         + `<ellipse cx="93" cy="113" rx="3.5" ry="4.5" fill="${s.dark}"/><ellipse cx="107" cy="113" rx="3.5" ry="4.5" fill="${s.dark}"/>`;
  } else if (frog || color === 'blue' || color === 'teal') {
    out += `<circle cx="93" cy="104" r="2.6" fill="${s.dark}"/><circle cx="107" cy="104" r="2.6" fill="${s.dark}"/>`;
  } else if (color !== 'yellow') {
    out += `<ellipse cx="100" cy="108" rx="7" ry="5" fill="${s.nose}"/>`;
  }

  // Mouth (the chick has a beak instead)
  if (color === 'yellow') {
    out += mood === 'happy'
      ? `<path d="M86 106 L100 98 L114 106 Q100 112 86 106 Z" fill="${s.beak}" stroke="${s.beakDark}" stroke-width="2" stroke-linejoin="round"/>`
        + `<path d="M88 112 Q100 110 112 112 L100 128 Z" fill="${s.beak}" stroke="${s.beakDark}" stroke-width="2" stroke-linejoin="round"/>`
        + `<path d="M90 109 Q100 113 110 109 L108 112 Q100 111 92 112 Z" fill="#7a2e3b"/>`
      : `<path d="M86 107 L100 99 L114 107 L100 121 Z" fill="${s.beak}" stroke="${s.beakDark}" stroke-width="2" stroke-linejoin="round"/>`
        + `<path d="M88 108 Q100 112 112 108" fill="none" stroke="${s.beakDark}" stroke-width="2" stroke-linecap="round"/>`;
  } else if (mood === 'happy') {
    const y = color === 'pink' ? 128 : 118;
    out += `<path d="M82 ${y} Q100 ${y + 28} 118 ${y} Z" fill="#7a2e3b"/>`
         + `<ellipse cx="100" cy="${y + 14}" rx="8" ry="5" fill="#f472b6"/>`;
  } else if (frog) {
    out += `<path d="M78 118 Q100 138 122 118" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  } else {
    const y = color === 'pink' ? 131 : 122;
    out += `<path d="M90 ${y} Q100 ${y + 9} 110 ${y}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  }
  return FACE_TF[color] ? `<g transform="${FACE_TF[color]}">${out}</g>` : out;
}

function shapes(list, s) {
  let out = '';
  for (const it of list) {
    if (typeof it === 'string') { out += it; continue; }
    out += `<${it.t}${geom(it)} fill="${it.fill}"`;
    if (it.line) out += ` stroke="${it.stroke || (s && s.dark)}" stroke-width="2.5" stroke-opacity="0.45" stroke-linejoin="round"`;
    if (it.op) out += ` opacity="${it.op}"`;
    out += '/>';
  }
  return out;
}

function silhouette(list) {
  let out = '';
  for (const it of list) if (typeof it !== 'string' && it.sil) out += `<${it.t}${geom(it)}/>`;
  return out;
}

// Cache: the markup only depends on colour, mood and whether it blinks.
const cache = new Map();

function inner(color, mood, blink) {
  const key = color + mood + blink;
  let m = cache.get(key);
  if (m) return m;
  const s = SPECS[color];
  const back = BACK[color](s);
  // Turtle: the head is part of the face layer; include it in the silhouette too.
  const sil = silhouette(back) + (color === 'teal' ? `<circle cx="100" cy="116" r="${HR * 0.8}"/>` : '');
  m = `<g transform="translate(0 6)" fill="#000" stroke="#000" stroke-width="14" stroke-linejoin="round" opacity="0.14">${sil}</g>`
    + `<g fill="#fff" stroke="#fff" stroke-width="14" stroke-linejoin="round">${sil}</g>`
    + shapes(back, s)
    + face(color, s, mood, blink);
  cache.set(key, m);
  return m;
}

/**
 * SVG markup for one animal head. Size it with CSS or the width/height opts;
 * it keeps its aspect ratio inside whatever box it gets.
 */
export function critterSVG(color, opts = {}) {
  if (!SPECS[color]) color = 'red';
  const mood = opts.mood === 'happy' ? 'happy' : 'waiting';
  const blink = mood === 'waiting' && opts.blink !== false;
  const style = blink ? ` style="--blink:${(+opts.blinkDelay || 0).toFixed(2)}s"` : '';
  const size = opts.size ? ` width="${opts.size}" height="${opts.size}"` : '';
  const cls = 'critter' + (opts.className ? ' ' + opts.className : '');
  return `<svg class="${cls}" viewBox="${CRITTER_VIEWBOX}"${size}${style} xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">`
    + inner(color, mood, blink) + '</svg>';
}
