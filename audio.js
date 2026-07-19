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
  else if (mapId === 'melody') soundProfile = 'music';
  else if (mapId === 'paris') soundProfile = 'cafe';
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
  if (soundProfile === 'music')   { popMusical(tier); return; }
  if (soundProfile === 'cafe')    { popCafe(tier);    return; }
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
  if (soundProfile === 'music')   { clinkMusical(impact); return; }
  if (soundProfile === 'cafe')    { clinkCafe(impact);    return; }
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

// Music-shop map: hollow wooden-body knock, like tapping the side of a guitar —
// a soft, warm thud with a felt attack instead of the default metallic tink.
function clinkMusical(impact) {
  const a = ac(), t = a.currentTime;
  const vol = Math.min(0.16, impact * 0.035);
  if (vol < 0.013) return;
  const base = 220 + Math.random() * 160; // low-mid hollow-body range
  [1, 1.5].forEach((mult, i) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(base * mult, t);
    o.frequency.exponentialRampToValueAtTime(base * mult * 0.9, t + 0.07);
    const pv = vol * (i === 0 ? 1 : 0.4);
    g.gain.setValueAtTime(pv, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.11);
  });
  // soft felt attack — short low-passed noise, no hard edge
  const len = Math.floor(a.sampleRate * 0.02);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
  const ng = a.createGain(); ng.gain.setValueAtTime(vol * 0.5, t);
  src.connect(lp).connect(ng).connect(a.destination); src.start(t);
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

// Music-shop map: a plucked-string merge (ukulele / harp). Each tier plays the
// next degree of a C major-pentatonic scale, so climbing tiers climbs the scale
// and a combo cascade rings out as a rising arpeggio. Pentatonic keeps even
// chaotic simultaneous merges consonant. Higher tiers open the filter and ring
// a touch longer, so big merges feel bigger, not just higher-pitched.
const MUSIC_SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]; // C D E G A · octave up
function popMusical(tier) {
  const a = ac(), t = a.currentTime;
  const semi = MUSIC_SCALE[Math.min(tier, MUSIC_SCALE.length - 1)];
  const f = 261.63 * Math.pow(2, semi / 12); // C4 root
  const bright = 1 + tier * 0.12;
  const sustain = 0.5 + tier * 0.03;
  // bright plucked core: sawtooth through a decaying lowpass
  const o = a.createOscillator(), g = a.createGain();
  const lp = a.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(f * 6 * bright, t);
  lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.25);
  o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + sustain);
  o.connect(lp).connect(g).connect(a.destination); o.start(t); o.stop(t + sustain + 0.05);
  // warm body — pure fundamental under the saw so single merges aren't thin
  const ob = a.createOscillator(), gb = a.createGain();
  ob.type = 'sine'; ob.frequency.setValueAtTime(f, t);
  gb.gain.setValueAtTime(0.0001, t);
  gb.gain.exponentialRampToValueAtTime(0.135, t + 0.01);
  gb.gain.exponentialRampToValueAtTime(0.0001, t + sustain * 0.9);
  ob.connect(gb).connect(a.destination); ob.start(t); ob.stop(t + sustain);
  // tiny noise pluck for the string attack
  const len = Math.floor(a.sampleRate * 0.012);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const ng = a.createGain(); ng.gain.setValueAtTime(0.15, t);
  src.connect(ng).connect(a.destination); src.start(t);
}

// Paris map: porcelain teacup "ting" — a teaspoon tapped on china. Inharmonic
// bell partials with a faint upward curl + a tiny spoon-tap click. Daintier and
// brighter than Kyoto's ceramic profile; pitch rises with tier (9-tier chain).
// Won the 2026-07-19 sound-lab audition (tools/sound-lab.html).
function popCafe(tier) {
  const a = ac(), t = a.currentTime;
  const base = 740 * Math.pow(1.09, tier);
  [[1, 1, 0.4], [2.53, 0.42, 0.25], [4.9, 0.15, 0.12]].forEach(([m, amp, dec]) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(base * m, t);
    o.frequency.exponentialRampToValueAtTime(base * m * 1.015, t + dec);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2 * amp, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dec + 0.03);
  });
  // spoon-tap click at the front
  const len = Math.floor(a.sampleRate * 0.008);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
  const src = a.createBufferSource(); src.buffer = buf;
  const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
  const ng = a.createGain(); ng.gain.setValueAtTime(0.1, t);
  src.connect(hp).connect(ng).connect(a.destination); src.start(t);
}

// Paris map: soft pastry-bump collision — a dusted thud, pastry landing on a
// plate. The items are pastries, so no china clink between them.
function clinkCafe(impact) {
  const a = ac(), t = a.currentTime;
  const vol = Math.min(0.26, impact * 0.06);
  if (vol < 0.018) return;
  const base = 180 + Math.random() * 90;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * 0.6, t + 0.1);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.17);
  // powdered-sugar dust
  const len = Math.floor(a.sampleRate * 0.06);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
  const src = a.createBufferSource(); src.buffer = buf;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
  const ng = a.createGain(); ng.gain.setValueAtTime(vol * 0.7, t);
  src.connect(lp).connect(ng).connect(a.destination); src.start(t);
}

// Paris map: tiny service-bell "ding" per coin. A slight random pitch wobble
// per coin keeps a 110ms shower from drilling.
function coinTickCafe() {
  const a = ac(), t = a.currentTime;
  const f = 2093 * (1 + (Math.random() - 0.5) * 0.05);
  [[1, 0.07, 0.22], [2.67, 0.025, 0.12]].forEach(([m, vol, dec]) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * m, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dec + 0.02);
  });
}

// Triumphant flourish for a beaten high score — a bright rising major arpeggio
// with a shimmering sparkle tail. Map-agnostic: always celebratory.
// New-best celebration: a proper brass "ta-ta-ta-daaa!". A sawtooth through a
// lowpass whose cutoff blooms open over the first ~60ms reads as a trumpet
// attack; the held final note lands as a full C-major chord with vibrato, and
// the old sparkle sweep rides out on top of it.
function fanfare() {
  if (muted) return;
  const a = ac(), t = a.currentTime;
  // One synthesized trumpet voice.
  const brass = (f, st, dur, vol, vib) => {
    const o = a.createOscillator(), g = a.createGain(), lp = a.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f, st);
    lp.type = 'lowpass'; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(f * 1.5, st);
    lp.frequency.linearRampToValueAtTime(f * 4.5, st + 0.06); // the brassy "blat"
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(vol, st + 0.025);
    g.gain.setValueAtTime(vol, st + Math.max(0.03, dur - 0.09));
    g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
    if (vib) {
      const lfo = a.createOscillator(), lg = a.createGain();
      lfo.frequency.value = 5.5; lg.gain.value = f * 0.014;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(st + 0.18); lfo.stop(st + dur);
    }
    o.connect(lp).connect(g).connect(a.destination);
    o.start(st); o.stop(st + dur + 0.02);
  };
  // Pickup triplet on G5, then the long C6 with E5+G5 harmony under it.
  brass(784,  t + 0.00, 0.15, 0.15);
  brass(784,  t + 0.17, 0.15, 0.15);
  brass(784,  t + 0.34, 0.15, 0.15);
  brass(1047, t + 0.52, 1.00, 0.17, true);   // lead: C6, held with vibrato
  brass(659,  t + 0.52, 1.00, 0.07, true);   // harmony: E5
  brass(784,  t + 0.52, 1.00, 0.07, true);   // harmony: G5
  // sparkle tail once the chord lands
  const ts = t + 0.62;
  const o3 = a.createOscillator(), g3 = a.createGain();
  o3.type = 'triangle';
  o3.frequency.setValueAtTime(2093, ts);
  o3.frequency.exponentialRampToValueAtTime(3136, ts + 0.20); // sweep up to G7
  g3.gain.setValueAtTime(0.0001, ts);
  g3.gain.exponentialRampToValueAtTime(0.13, ts + 0.02);
  g3.gain.exponentialRampToValueAtTime(0.0001, ts + 0.45);
  o3.connect(g3).connect(a.destination); o3.start(ts); o3.stop(ts + 0.48);
}

// XP level-up (progress.js): a quick bright ascending triad + sparkle.
// Deliberately shorter and softer than fanfare() — level-ups happen mid-play,
// so the chime rewards without interrupting (and can never be confused with
// the new-high-score trumpets).
function levelUp() {
  if (muted) return;
  const a = ac(), t = a.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];   // C5 E5 G5 C6
  notes.forEach((f, i) => {
    const st = t + i * 0.065, last = i === notes.length - 1;
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(f, st);
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(last ? 0.14 : 0.09, st + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, st + (last ? 0.45 : 0.18));
    o.connect(g).connect(a.destination); o.start(st); o.stop(st + (last ? 0.5 : 0.22));
  });
  // faint glass shimmer as the top note lands
  const ts = t + 0.22;
  const o2 = a.createOscillator(), g2 = a.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(2093, ts);
  o2.frequency.exponentialRampToValueAtTime(2637, ts + 0.16);
  g2.gain.setValueAtTime(0.0001, ts);
  g2.gain.exponentialRampToValueAtTime(0.05, ts + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.0001, ts + 0.3);
  o2.connect(g2).connect(a.destination); o2.start(ts); o2.stop(ts + 0.32);
}

// Game-over chime, shared by every map: three warm descending notes (E5 C5 G4)
// landing on a soft low C — "the café is closing", not "you failed". Called
// from showGameOver() in ui.js on every run EXCEPT a new best, where the
// fanfare() trumpets take over instead (both at once would clash).
function gameOver() {
  if (muted) return;
  const a = ac(), t = a.currentTime;
  [659.25, 523.25, 392.00].forEach((f, i) => {
    const st = t + i * 0.22, last = i === 2;
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(f, st);
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(last ? 0.16 : 0.14, st + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, st + (last ? 0.8 : 0.3));
    o.connect(g).connect(a.destination); o.start(st); o.stop(st + (last ? 0.85 : 0.34));
  });
  // soft low C3 landing under the final note
  const st = t + 0.44;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(130.81, st);
  g.gain.setValueAtTime(0.0001, st);
  g.gain.exponentialRampToValueAtTime(0.08, st + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, st + 0.9);
  o.connect(g).connect(a.destination); o.start(st); o.stop(st + 0.95);
}

function coinTick() {
  if (muted) return;
  if (soundProfile === 'music') { coinTickMusical(); return; }
  if (soundProfile === 'cafe')  { coinTickCafe();    return; }
  const a = ac(), t = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'square'; o.frequency.setValueAtTime(1568, t);
  o.frequency.setValueAtTime(2093, t + 0.04);
  g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.13);
}

// Music-shop coin sound: instead of a repeated blip, each coin plays the next
// step of a pentatonic run one octave above the merge notes — so a merge's coin
// shower pours in as a rising arcade-payout flourish. The run restarts when a
// new burst begins (a gap since the last coin); once it reaches the top of the
// range it HOLDS the top note for any extra coins (a big combo lands on a bright
// sustained sparkle) rather than wrapping or descending.
let coinRunIdx = 0, coinRunLastMs = 0;
function coinTickMusical() {
  const a = ac(), t = a.currentTime;
  const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  if (now - coinRunLastMs > 350) coinRunIdx = 0; // new shower -> restart the run
  coinRunLastMs = now;
  const semi = MUSIC_SCALE[Math.min(coinRunIdx, MUSIC_SCALE.length - 1)]; // climb, then hold the top
  coinRunIdx++;
  const f = 523.25 * Math.pow(2, semi / 12); // C5 root — sparkles above the merges
  // soft bell pluck: triangle body + quiet sine octave, quick decay so a fast
  // 20-coin run stays clear instead of muddy
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.2);
  const o2 = a.createOscillator(), g2 = a.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(f * 2, t);
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(0.028, t + 0.006);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o2.connect(g2).connect(a.destination); o2.start(t); o2.stop(t + 0.13);
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
  }
  // Always re-arm, even when the src is unchanged: returnToMenu() paused
  // playback, and a stale musicStarted=true made startMusic() early-return
  // silently when the same map (or one sharing a track) was picked again.
  musicStarted = false;
}

function startMusic() {
  if (musicStarted) return;
  musicStarted = true;
  if (musicOn) bgmEl.play().catch(() => {});
}

// Tab-visibility pause/resume: the browser keeps an <audio> element playing
// in a hidden/minimized tab, so game.js calls these from visibilitychange.
// Both respect the user's music toggle — a paused-by-choice track stays paused.
function pauseMusicForHide() {
  if (bgmEl && musicStarted && musicOn) bgmEl.pause();
}
function resumeMusicAfterHide() {
  if (bgmEl && musicStarted && musicOn) bgmEl.play().catch(() => {});
}

function toggleMusic(btn) {
  if (!musicStarted) { startMusic(); setToggleBtn(btn, true); return; }
  musicOn = !musicOn;
  setToggleBtn(btn, musicOn);
  if (musicOn) bgmEl.play().catch(() => {}); else bgmEl.pause();
}

function toggleMute(btn) {
  muted = !muted;
  setToggleBtn(btn, !muted);
}

// HUD toggle buttons show their state via icon swap (.off class), not text.
function setToggleBtn(btn, on) {
  btn.classList.toggle('off', !on);
  btn.setAttribute('aria-pressed', String(on));
}
