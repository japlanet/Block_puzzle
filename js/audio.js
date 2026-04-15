// Web Audio synth — zero-asset music + SFX.
// masterGain → { musicGain, sfxGain } → destination.
// Music auto-ducks briefly on every SFX so effects stay audible.

import { state, loadSoundPref, saveSoundPref } from './state.js';

let ctx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let noiseBuffer = null;
let musicRunning = false;
let musicCancel = null;

// ── Context setup (must happen after a user gesture) ─────────────
export function initAudio() {
  if (ctx) return ctx;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain(); masterGain.gain.value = 0.9;
  musicGain = ctx.createGain(); musicGain.gain.value = 0.08;
  sfxGain   = ctx.createGain(); sfxGain.gain.value = 0.28;
  musicGain.connect(masterGain);
  sfxGain.connect(masterGain);
  masterGain.connect(ctx.destination);
  noiseBuffer = makeNoiseBuffer(ctx);

  state.soundOn = loadSoundPref();
  if (state.soundOn) startMusic();
  return ctx;
}

function makeNoiseBuffer(ctx) {
  const len = ctx.sampleRate * 1.2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function isSoundOn() { return state.soundOn; }

export function toggleSound() {
  state.soundOn = !state.soundOn;
  saveSoundPref(state.soundOn);
  if (state.soundOn) {
    if (!ctx) initAudio();
    else startMusic();
  } else {
    stopMusic();
  }
  return state.soundOn;
}

export function resumeIfSuspended() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

// ── Frequency helpers ───────────────────────────────────────────
const A4 = 440;
// Semitone offsets from A4 for common notes we use.
const NOTE = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
function freq(name, octave = 4) {
  // name like 'C', 'C#', 'Eb'
  const base = NOTE[name[0]];
  const accidental = name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0;
  const semis = base + accidental + (octave - 4) * 12;
  return A4 * Math.pow(2, semis / 12);
}

// ── Envelope helper ─────────────────────────────────────────────
function env(gainNode, t0, { a = 0.01, d = 0.1, s = 0, r = 0.1, peak = 0.3, sustainFor = 0 }) {
  const g = gainNode.gain;
  g.cancelScheduledValues(t0);
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(peak, t0 + a);
  const susLevel = Math.max(0.0001, peak * s);
  if (s > 0) {
    g.exponentialRampToValueAtTime(susLevel, t0 + a + d);
    g.setValueAtTime(susLevel, t0 + a + d + sustainFor);
    g.exponentialRampToValueAtTime(0.0001, t0 + a + d + sustainFor + r);
    return t0 + a + d + sustainFor + r;
  } else {
    g.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    return t0 + a + d + r;
  }
}

// ── Duck music briefly ──────────────────────────────────────────
function duckMusic(amount = 0.4, recoverAfter = 0.25) {
  if (!musicGain) return;
  const now = ctx.currentTime;
  const target = 0.08 * amount;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setTargetAtTime(target, now, 0.02);
  musicGain.gain.setTargetAtTime(0.08, now + recoverAfter, 0.15);
}

// ── Background music ────────────────────────────────────────────
// Slow C-major progression: Cmaj, Am, F, G. Each chord lasts 2 bars.
// A simple top-line melody threads over it with a triangle lead.
const CHORDS = [
  { root: ['C', 3], tones: [['C', 4], ['E', 4], ['G', 4]] },
  { root: ['A', 2], tones: [['A', 3], ['C', 4], ['E', 4]] },
  { root: ['F', 2], tones: [['F', 3], ['A', 3], ['C', 4]] },
  { root: ['G', 2], tones: [['G', 3], ['B', 3], ['D', 4]] },
];
// 4-bar melody (note names, octave, beats) looped over each chord pair.
const MELODY_BARS = [
  [['E', 5, 1], ['G', 5, 1], ['E', 5, 1], ['C', 5, 1]],
  [['D', 5, 1], ['E', 5, 1], ['G', 5, 1], ['E', 5, 1]],
  [['F', 5, 1], ['A', 5, 1], ['F', 5, 1], ['D', 5, 1]],
  [['G', 5, 1], ['E', 5, 1], ['D', 5, 1], ['C', 5, 2]],
];

function startMusic() {
  if (musicRunning) return;
  if (!ctx) return;
  musicRunning = true;
  const BPM = 80;
  const beat = 60 / BPM;
  let t = ctx.currentTime + 0.1;
  let bar = 0;
  let cancelled = false;
  musicCancel = () => { cancelled = true; };

  function scheduleBar() {
    if (cancelled || !musicRunning || !state.soundOn) return;
    const chord = CHORDS[bar % CHORDS.length];
    const melody = MELODY_BARS[bar % MELODY_BARS.length];

    // Bass (fades in, plucked on beat 1 & 3)
    for (const beatIdx of [0, 2]) {
      playPluck(chord.root[0], chord.root[1], t + beatIdx * beat, beat * 0.9, 0.18, 'sine');
    }
    // Pad — detuned sawtooth pair, low-passed, long release.
    playPad(chord.tones, t, beat * 4);
    // Lead melody
    let mt = t;
    for (const [n, oc, beats] of melody) {
      playLead(n, oc, mt, beats * beat);
      mt += beats * beat;
    }

    bar++;
    t += beat * 4;
    // Schedule the next bar slightly before it starts.
    setTimeout(scheduleBar, Math.max(0, (t - beat * 0.25 - ctx.currentTime) * 1000));
  }
  scheduleBar();
}

function stopMusic() {
  musicRunning = false;
  if (musicCancel) musicCancel();
  musicCancel = null;
}

function playPluck(name, oct, t0, dur, peak, type) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq(name, oct), t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(musicGain);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

function playPad(tones, t0, dur) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.35);
  g.gain.setValueAtTime(0.05, t0 + dur - 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  filter.connect(g); g.connect(musicGain);
  for (const [n, oc] of tones) {
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq(n, oc);
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    }
  }
}

function playLead(name, oct, t0, dur) {
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle'; osc.frequency.value = freq(name, oct);
  osc2.type = 'sine'; osc2.frequency.value = freq(name, oct) * 2; // octave harmonic
  const g2 = ctx.createGain(); g2.gain.value = 0.06;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.9);
  osc.connect(g); g.connect(musicGain);
  osc2.connect(g2); g2.connect(musicGain);
  osc.start(t0); osc.stop(t0 + dur);
  osc2.start(t0); osc2.stop(t0 + dur);
}

// ── Sound effects ───────────────────────────────────────────────
const EXIT_MOTIFS = {
  red:    [['G', 4], ['C', 5], ['E', 5]],     // fox chirp
  blue:   [['F', 3], ['A', 3], ['D', 4]],     // whale whoop-lite
  green:  [['C', 4], ['E', 4], ['G', 4]],     // frog hop
  yellow: [['E', 5], ['G', 5], ['C', 6]],     // chick tweet
  purple: [['D', 4], ['G', 4], ['D', 5]],     // unicorn sparkle
  orange: [['C', 4], ['F', 4], ['A', 4]],     // lion call
  pink:   [['G', 4], ['E', 5], ['C', 5]],     // piglet giggle
  teal:   [['A', 3], ['D', 4], ['F#', 4]],    // turtle plod
};

export function playSfx(type, opts = {}) {
  if (!ctx || !state.soundOn) return;
  resumeIfSuspended();
  const t0 = ctx.currentTime;
  duckMusic(0.5, 0.2);

  if (type === 'tap')        return sfxTap(t0);
  if (type === 'slide')      return sfxSlide(t0);
  if (type === 'exit')       return sfxExit(t0, opts.color);
  if (type === 'win')        return sfxWin(t0);
  if (type === 'hint')       return sfxHint(t0);
  if (type === 'invalid')    return sfxInvalid(t0);
  if (type === 'select')     return sfxSelect(t0);
}

function sfxTap(t0) {
  // Pluck + short filtered noise click.
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine'; osc.frequency.value = 620;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
  osc.connect(g); g.connect(sfxGain);
  osc.start(t0); osc.stop(t0 + 0.12);
  noiseBurst(t0, 0.03, 0.1, { lowcut: 1800, peak: 0.08 });
}

function sfxSelect(t0) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq('E', 5), t0);
  osc.frequency.exponentialRampToValueAtTime(freq('G', 5), t0 + 0.09);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
  osc.connect(g); g.connect(sfxGain);
  osc.start(t0); osc.stop(t0 + 0.2);
}

function sfxSlide(t0) {
  // Filtered-noise whoosh with an upward filter sweep.
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 4;
  filter.frequency.setValueAtTime(400, t0);
  filter.frequency.exponentialRampToValueAtTime(1200, t0 + 0.14);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  src.connect(filter); filter.connect(g); g.connect(sfxGain);
  src.start(t0); src.stop(t0 + 0.18);
}

function sfxExit(t0, color) {
  const motif = EXIT_MOTIFS[color] || EXIT_MOTIFS.purple;
  motif.forEach(([n, oc], i) => {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g = ctx.createGain();
    const g2 = ctx.createGain(); g2.gain.value = 0.08;
    const start = t0 + i * 0.09;
    osc.type = 'triangle'; osc.frequency.value = freq(n, oc);
    osc2.type = 'sine'; osc2.frequency.value = freq(n, oc) * 2;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.3, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
    osc.connect(g); g.connect(sfxGain);
    osc2.connect(g2); g2.connect(sfxGain);
    osc.start(start); osc.stop(start + 0.3);
    osc2.start(start); osc2.stop(start + 0.3);
  });
}

function sfxWin(t0) {
  // Four-chord rising fanfare with sparkle arpeggio.
  const chords = [
    [['C', 4], ['E', 4], ['G', 4]],
    [['F', 4], ['A', 4], ['C', 5]],
    [['G', 4], ['B', 4], ['D', 5]],
    [['C', 5], ['E', 5], ['G', 5]],
  ];
  chords.forEach((tones, i) => {
    const start = t0 + i * 0.18;
    tones.forEach(([n, oc]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 3 ? 'triangle' : 'sine';
      osc.frequency.value = freq(n, oc);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.22, start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
      osc.connect(g); g.connect(sfxGain);
      osc.start(start); osc.stop(start + 0.6);
    });
  });
  // Sparkle arpeggio on top
  const sparkle = [['E', 6], ['G', 6], ['C', 7], ['G', 6], ['C', 7]];
  sparkle.forEach(([n, oc], i) => {
    const start = t0 + 0.55 + i * 0.08;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq(n, oc);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.14, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    osc.connect(g); g.connect(sfxGain);
    osc.start(start); osc.stop(start + 0.2);
  });
}

function sfxHint(t0) {
  [['G', 5], ['E', 5], ['C', 5]].forEach(([n, oc], i) => {
    const start = t0 + i * 0.07;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq(n, oc);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    osc.connect(g); g.connect(sfxGain);
    osc.start(start); osc.stop(start + 0.14);
  });
}

function sfxInvalid(t0) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass'; filter.frequency.value = 400;
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, t0);
  osc.frequency.exponentialRampToValueAtTime(90, t0 + 0.15);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
  osc.connect(filter); filter.connect(g); g.connect(sfxGain);
  osc.start(t0); osc.stop(t0 + 0.22);
}

function noiseBurst(t0, attack, duration, { lowcut = 800, peak = 0.1 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass'; filter.frequency.value = lowcut;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter); filter.connect(g); g.connect(sfxGain);
  src.start(t0); src.stop(t0 + duration + 0.02);
}
