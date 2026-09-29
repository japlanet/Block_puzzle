// Little drawn badges for the special animals and doors, in the same sticker
// style as the critters (soft dark outline, white ring, flat colours):
//
//   snowflakeSVG()          -> one snowflake pip (frozen animals show 1-3)
//   keySVG()                -> gold key (this animal carries the key)
//   padlockSVG()            -> gold padlock, shut
//   padlockSVG({ open })    -> the same padlock with its shackle popped up
//
// No text anywhere: a child who can't read counts snowflakes and matches the
// key to the padlocks.

const INK = '#3b2a20';
const GOLD = '#ffcf3f', GOLD_DARK = '#c98a00', GOLD_LIGHT = '#fff1a8';

const svg = (viewBox, body, cls) =>
  `<svg class="${cls}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`;

export function snowflakeSVG() {
  // Six arms with little V tips, on a pale blue disc with a white ring.
  let arms = '';
  for (let i = 0; i < 6; i++) {
    const a = i * 60;
    arms += `<g transform="rotate(${a} 20 20)"><path d="M20 20 L20 7 M20 11 L16.5 8 M20 11 L23.5 8"/></g>`;
  }
  return svg('0 0 40 40',
    `<circle cx="20" cy="21" r="17" fill="rgba(40,90,140,0.25)"/>`
    + `<circle cx="20" cy="20" r="17" fill="#ffffff"/>`
    + `<circle cx="20" cy="20" r="14" fill="#bfe9ff" stroke="#6cc4f0" stroke-width="2"/>`
    + `<g fill="none" stroke="#2c86c7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${arms}</g>`
    + `<circle cx="20" cy="20" r="2.6" fill="#2c86c7"/>`,
    'badge-svg snowflake');
}

export function keySVG() {
  // Round bow with a hole, a shaft and two teeth; tilted like a sticker.
  const outline = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"`;
  return svg('0 0 60 60',
    `<g transform="rotate(-35 30 30)">`
    // white sticker ring + soft shadow
    + `<g fill="rgba(0,0,0,0.18)" transform="translate(1.5 2.5)"><circle cx="17" cy="30" r="13"/><rect x="24" y="25" width="30" height="10" rx="4"/><rect x="42" y="30" width="12" height="13" rx="3"/></g>`
    + `<g fill="#fff"><circle cx="17" cy="30" r="13"/><rect x="24" y="25" width="30" height="10" rx="4"/><rect x="42" y="30" width="12" height="13" rx="3"/></g>`
    + `<rect x="26" y="27" width="26" height="6" rx="2.5" fill="${GOLD}" ${outline}/>`
    + `<rect x="40" y="31" width="5" height="8" rx="1.5" fill="${GOLD}" ${outline}/>`
    + `<rect x="47" y="31" width="5" height="10" rx="1.5" fill="${GOLD}" ${outline}/>`
    + `<circle cx="17" cy="30" r="10" fill="${GOLD}" ${outline}/>`
    + `<circle cx="17" cy="30" r="3.6" fill="#fff" stroke="${GOLD_DARK}" stroke-width="2"/>`
    + `<path d="M11 25 Q13.5 22 17 22" fill="none" stroke="${GOLD_LIGHT}" stroke-width="2.4" stroke-linecap="round"/>`
    + `</g>`,
    'badge-svg key');
}

export function padlockSVG({ open = false } = {}) {
  const outline = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"`;
  // The shackle is its own group so CSS can pop it open (.opening) too.
  const shackleY = open ? -9 : 0;
  return svg('0 -12 60 72',
    `<g fill="rgba(0,0,0,0.18)" transform="translate(1.5 2.5)"><rect x="8" y="25" width="44" height="33" rx="9"/></g>`
    + `<g class="shackle" transform="translate(0 ${shackleY})">`
    + `<path d="M17 27 V17 A13 13 0 0 1 43 17 V27" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round"/>`
    + `<path d="M17 27 V17 A13 13 0 0 1 43 17 V27" fill="none" stroke="${INK}" stroke-width="9.5" stroke-linecap="round"/>`
    + `<path d="M17 27 V17 A13 13 0 0 1 43 17 V27" fill="none" stroke="#c9ced8" stroke-width="5" stroke-linecap="round"/>`
    + `</g>`
    + `<rect x="8" y="25" width="44" height="33" rx="9" fill="#fff"/>`
    + `<rect x="10.5" y="27.5" width="39" height="28" rx="7" fill="${GOLD}" ${outline}/>`
    + `<path d="M15 32 H40" stroke="${GOLD_LIGHT}" stroke-width="3" stroke-linecap="round"/>`
    + `<circle cx="30" cy="39.5" r="4.2" fill="${INK}"/>`
    + `<path d="M28.3 41 L27.3 49 H32.7 L31.7 41 Z" fill="${INK}"/>`,
    'badge-svg padlock' + (open ? ' open' : ''));
}
