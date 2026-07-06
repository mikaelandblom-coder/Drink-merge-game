// All sound synthesis and music control.
// Sounds are generated via Web Audio API — no file loading needed for SFX.

let actx = null;
let muted = false;
let soundProfile = 'default'; // set per map; controls clink/pop timbre

function setSoundProfile(mapId) {
  if (mapId === 'saigon') soundProfile = 'wood';
  else if (mapId === 'kyoto') soundProfile = 'ceramic';
  else if (mapId === 'mage') soundProfile = 'arcane';
  else if (mapId === 'teddy') soundProfile = 'plush';
  else soundProfile = 'default';
}

function ac() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  return actx;
}

function initAudio() {
  // Call once on first user gesture to unlock AudioContext on mobile.
  ac();
}

function pop(tier) {
  if (muted) return;
  if (soundProfile === 'wood')    { popWood(tier);    return; }
  if (soundProfile === 'ceramic') { popCeramic(tier); return; }
  if (soundProfile === 'arcane')  { popArcane(tier);  return; }
  if (soundProfile === 'plush')   { popPlush(tier);   return; }
  const a = ac(), t = a.currentTime;
  const f = 220 * Math.pow(1.18, tier);
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.09);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.25);

  const o2 = a.createOscillator(), g2 = a.createGain();
  o2.type = 'triangle'; o2.frequency.setValueAtTime(f * 2.5, t);
  g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o2.connect(g2).connect(a.destination); o2.start(t); o2.stop(t + 0.32);
}

// Pho map: bubbly "bloop" merge sound — like soup combining in a pot
function popWood(tier) {
  const a = ac(), t = a.currentTime;
  const f = 110 * Math.pow(1.15, tier);
  // Warm rounded bubble tone
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f * 1.4, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.18);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.3);
  // Soft thump underneath
  const o2 = a.createOscillator(), g2 = a.createGain();
  o2.type = 'triangle'; o2.frequency.setValueAtTime(80 + tier * 12, t);
  o2.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  g2.gain.setValueAtTime(0.18, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o2.connect(g2).connect(a.destination); o2.start(t); o2.stop(t + 0.15);
}

function shoot() {
  if (muted) return;
  const a = ac(), t = a.currentTime;
  const len = a.sampleRate * 0.15;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass';
  f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(2200, t + 0.12);
  const g = a.createGain();
  g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  src.connect(f).connect(g).connect(a.destination); src.start(t);

  const o = a.createOscillator(), g2 = a.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(320, t);
  o.frequency.exponentialRampToValueAtTime(520, t + 0.08);
  g2.gain.setValueAtTime(0.1, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g2).connect(a.destination); o.start(t); o.stop(t + 0.14);
}

function clink(impact) {
  if (muted) return;
  if (soundProfile === 'wood')    { clinkWood(impact);    return; }
  if (soundProfile === 'ceramic') { clinkCeramic(impact); return; }
  if (soundProfile === 'arcane')  { clinkArcane(impact);  return; }
  if (soundProfile === 'plush')   { clinkPlush(impact);   return; }
  const a = ac(), t = a.currentTime;
  const vol = Math.min(0.14, impact * 0.032);
  if (vol < 0.012) return;
  const base = 1800 + Math.random() * 1400;
  const partials = [1, 2.41, 3.88, 5.2];
  const decays   = [0.22, 0.16, 0.11, 0.08];
  partials.forEach((mult, i) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(base * mult, t);
    o.frequency.exponentialRampToValueAtTime(base * mult * 0.985, t + decays[i]);
    const pv = vol * (i === 0 ? 1 : 0.45 / i);
    g.gain.setValueAtTime(pv, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decays[i]);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + decays[i] + 0.02);
  });
  const o2 = a.createOscillator(), g2 = a.createGain();
  o2.type = 'triangle'; o2.frequency.setValueAtTime(base * 6, t);
  g2.gain.setValueAtTime(vol * 0.5, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
  o2.connect(g2).connect(a.destination); o2.start(t); o2.stop(t + 0.025);
}

// Pho map: wooden chopstick/bowl "tok" collision sound
function clinkWood(impact) {
  const a = ac(), t = a.currentTime;
  const vol = Math.min(0.18, impact * 0.04);
  if (vol < 0.014) return;
  const base = 380 + Math.random() * 220; // lower, woodier range
  // Main woody knock — two close partials like hollow wood
  [1, 1.55].forEach((mult, i) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(base * mult, t);
    o.frequency.exponentialRampToValueAtTime(base * mult * 0.92, t + 0.06);
    const pv = vol * (i === 0 ? 1 : 0.5);
    g.gain.setValueAtTime(pv, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + 0.1);
  });
  // Short noise burst for the "attack" click
  const len = Math.floor(a.sampleRate * 0.025);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const flt = a.createBiquadFilter(); flt.type = 'bandpass';
  flt.frequency.value = 900; flt.Q.value = 1.5;
  const ng = a.createGain(); ng.gain.setValueAtTime(vol * 0.6, t);
  src.connect(flt).connect(ng).connect(a.destination); src.start(t);
}

// Kyoto map: soft marimba pop — warm wooden tone like a mochi squish
function popCeramic(tier) {
  const a = ac(), t = a.currentTime;
  const base = 320 * Math.pow(1.13, tier);
  // Warm rounded body — triangle gives marimba softness
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * 0.88, t + 0.12);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.32);
  // Soft harmonic — just a touch of sweetness on top
  const o2 = a.createOscillator(), g2 = a.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(base * 2.0, t);
  g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.1, t + 0.01);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o2.connect(g2).connect(a.destination); o2.start(t); o2.stop(t + 0.2);
  // Tiny soft pop at the front — the merge "squish"
  const len = Math.floor(a.sampleRate * 0.03);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = a.createBufferSource(); src.buffer = buf;
  const flt = a.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 600;
  const ng = a.createGain(); ng.gain.setValueAtTime(0.18, t);
  src.connect(flt).connect(ng).connect(a.destination); src.start(t);
}

// Kyoto map: soft food bump — mochi/dango squishing together, no hard edges
function clinkCeramic(impact) {
  const a = ac(), t = a.currentTime;
  const vol = Math.min(0.35, impact * 0.08);
  if (vol < 0.02) return;
  // Warm thud — low-mid body, pitch drops like something soft compressing
  const base = 200 + Math.random() * 120;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.1);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.2);
  // Squish texture — noise burst, less aggressively filtered so it's audible
  const len = Math.floor(a.sampleRate * 0.07);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
  const src = a.createBufferSource(); src.buffer = buf;
  const flt = a.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 900;
  const ng = a.createGain(); ng.gain.setValueAtTime(vol * 0.9, t);
  src.connect(flt).connect(ng).connect(a.destination); src.start(t);
}

// Mage map: shimmering magical "cast" chime for a merge — a bright bell that
// sweeps upward with sparkly overtones, like a small spell resolving.
function popArcane(tier) {
  const a = ac(), t = a.currentTime;
  const base = 520 * Math.pow(1.14, tier);
  // Bell core: rising sine with a long shimmer
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.12);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.24, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.55);
  // Glassy overtone
  const o2 = a.createOscillator(), g2 = a.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(base * 3.02, t);
  o2.frequency.exponentialRampToValueAtTime(base * 3.8, t + 0.12);
  g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.08, t + 0.015);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o2.connect(g2).connect(a.destination); o2.start(t); o2.stop(t + 0.35);
  // High sparkle tail
  const o3 = a.createOscillator(), g3 = a.createGain();
  o3.type = 'triangle'; o3.frequency.setValueAtTime(base * 5.5, t + 0.04);
  o3.frequency.exponentialRampToValueAtTime(base * 7, t + 0.2);
  g3.gain.setValueAtTime(0.0001, t + 0.04); g3.gain.exponentialRampToValueAtTime(0.05, t + 0.07);
  g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o3.connect(g3).connect(a.destination); o3.start(t + 0.04); o3.stop(t + 0.3);
}

// Mage map: soft crystalline "tink" collision — light, glassy, with a quick ring.
function clinkArcane(impact) {
  const a = ac(), t = a.currentTime;
  const vol = Math.min(0.13, impact * 0.03);
  if (vol < 0.012) return;
  const base = 2100 + Math.random() * 900;
  [1, 2.05].forEach((mult, i) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(base * mult, t);
    o.frequency.exponentialRampToValueAtTime(base * mult * 0.99, t + 0.09);
    const pv = vol * (i === 0 ? 1 : 0.4);
    g.gain.setValueAtTime(pv, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.14);
  });
}

// Teddy map: squeaker-toy merge — the classic squeeze-squeak of a plushie,
// pitch rising then falling, with a soft stuffing poof underneath.
function popPlush(tier) {
  const a = ac(), t = a.currentTime;
  const base = 700 * Math.pow(1.08, tier);
  // squeak: nasal triangle, quick up-down pitch bend like a squeezed squeaker
  const o = a.createOscillator(), g = a.createGain();
  const f = a.createBiquadFilter(); f.type = 'bandpass';
  f.frequency.setValueAtTime(base * 1.5, t); f.Q.value = 3;
  o.type = 'triangle';
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * 1.6, t + 0.07);
  o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.16);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.26, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(f).connect(g).connect(a.destination); o.start(t); o.stop(t + 0.24);
  // soft stuffing poof underneath
  const len = Math.floor(a.sampleRate * 0.09);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = a.createBufferSource(); src.buffer = buf;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
  const ng = a.createGain(); ng.gain.setValueAtTime(0.16, t);
  src.connect(lp).connect(ng).connect(a.destination); src.start(t);
}

// Teddy map: fabric poof collision — the softest profile in the game, a plush
// thump with no hard attack at all.
function clinkPlush(impact) {
  const a = ac(), t = a.currentTime;
  const vol = Math.min(0.3, impact * 0.07);
  if (vol < 0.02) return;
  // muffled body thud
  const base = 130 + Math.random() * 70;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.11);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.18);
  // fabric brush texture
  const len = Math.floor(a.sampleRate * 0.08);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
  const src = a.createBufferSource(); src.buffer = buf;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
  const ng = a.createGain(); ng.gain.setValueAtTime(vol * 0.8, t);
  src.connect(lp).connect(ng).connect(a.destination); src.start(t);
}

// Triumphant flourish for a beaten high score — a bright rising major arpeggio
// with a shimmering sparkle tail. Map-agnostic: always celebratory.
function fanfare() {
  if (muted) return;
  const a = ac(), t = a.currentTime;
  const notes = [1047, 1319, 1568, 2093]; // C6 · E6 · G6 · C7
  notes.forEach((f, i) => {
    const st = t + i * 0.10;
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(f, st);
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.22, st + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, st + 0.32);
    o.connect(g).connect(a.destination); o.start(st); o.stop(st + 0.34);
    // sine octave underneath for body
    const o2 = a.createOscillator(), g2 = a.createGain();
    o2.type = 'sine'; o2.frequency.setValueAtTime(f * 0.5, st);
    g2.gain.setValueAtTime(0.0001, st);
    g2.gain.exponentialRampToValueAtTime(0.10, st + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.0001, st + 0.24);
    o2.connect(g2).connect(a.destination); o2.start(st); o2.stop(st + 0.26);
  });
  // sparkle tail once the arpeggio lands
  const ts = t + notes.length * 0.10;
  const o3 = a.createOscillator(), g3 = a.createGain();
  o3.type = 'triangle';
  o3.frequency.setValueAtTime(2093, ts);
  o3.frequency.exponentialRampToValueAtTime(3136, ts + 0.20); // sweep up to G7
  g3.gain.setValueAtTime(0.0001, ts);
  g3.gain.exponentialRampToValueAtTime(0.13, ts + 0.02);
  g3.gain.exponentialRampToValueAtTime(0.0001, ts + 0.45);
  o3.connect(g3).connect(a.destination); o3.start(ts); o3.stop(ts + 0.48);
}

function coinTick() {
  if (muted) return;
  const a = ac(), t = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'square'; o.frequency.setValueAtTime(1568, t);
  o.frequency.setValueAtTime(2093, t + 0.04);
  g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.13);
}

// ---------- music ----------
let musicOn = true, musicStarted = false;
let bgmEl = null;

function initMusic(audioEl, volume, src) {
  bgmEl = audioEl;
  bgmEl.volume = volume;
  if (src && bgmEl.getAttribute('src') !== src) {
    bgmEl.pause();
    bgmEl.setAttribute('src', src);
    bgmEl.load();
    musicStarted = false;
  }
}

function startMusic() {
  if (musicStarted) return;
  musicStarted = true;
  if (musicOn) bgmEl.play().catch(() => {});
}

function toggleMusic(btn) {
  if (!musicStarted) { startMusic(); btn.textContent = 'music on'; return; }
  musicOn = !musicOn;
  btn.textContent = musicOn ? 'music on' : 'music off';
  if (musicOn) bgmEl.play().catch(() => {}); else bgmEl.pause();
}

function toggleMute(btn) {
  muted = !muted;
  btn.textContent = muted ? 'sound off' : 'sound on';
}
