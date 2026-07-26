// SOUND LIBRARY — every synth voice in the game, in one place.
//
// This file is the single source of truth for HOW each sound is made.
// config/soundmap.js says WHICH voice each map plays for each event, and
// audio.js is just the plumbing (mute, iOS routing, music) that calls them.
// tools/sound-lab.html loads this exact file, so auditioning a sound in the lab
// plays the same code the game runs — no more hand-copied duplicates drifting
// apart from audio.js.
//
// A voice NEVER touches ctx.destination. It renders into the `out` node it is
// handed: audio.js passes the master `sfxBus` (which on iOS is routed through a
// MediaStream <audio> carrier so SFX land on the media volume channel, not the
// ringer channel — see the iOS notes in audio.js), and the sound lab passes its
// own volume gain. Connecting straight to a.destination would silently
// reintroduce the 2026-07-20 iPad "SFX inaudible" bug.
//
// Voice contract:
//   play(a, out, o)
//     a   — AudioContext
//     out — AudioNode to connect to
//     o   — { when, tier, tiers, impact, index }
//           when   absolute start time (defaults to a.currentTime)
//           tier   merge voices: 0-based item tier
//           tiers  merge voices: length of the map's chain (default 9)
//           impact collision voices: collision speed, as game.js measures it
//           index  coin voices: position in the CURRENT payout shower (0-based),
//                  so a voice can climb a run without keeping its own state
//
// Adding a voice: add an entry here, then assign it to a map in the sound lab
// (or by hand in config/soundmap.js). Nothing else needs to change.

// ---------- shared helpers ----------

// Shaped noise burst — the texture layer under most collision/merge sounds.
// `shape` is the decay exponent: 1 = linear fade, higher = snappier.
function sfxNoise(a, out, o) {
  const t = o.when;
  const len = Math.max(8, Math.floor(a.sampleRate * o.dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  const p = o.shape === undefined ? 1 : o.shape;
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, p);
  const src = a.createBufferSource(); src.buffer = buf;
  const g = a.createGain(); g.gain.setValueAtTime(o.vol, t);
  if (o.type) {
    const f = a.createBiquadFilter();
    f.type = o.type; f.frequency.value = o.freq;
    if (o.q) f.Q.value = o.q;
    src.connect(f).connect(g).connect(out);
  } else {
    src.connect(g).connect(out);
  }
  src.start(t);
}

// C major pentatonic, 10 steps (C D E G A, two octaves + a bit). Used by every
// "tiers climb a scale" voice: a combo cascade then rings out as an arpeggio,
// and pentatonic keeps even chaotic simultaneous merges consonant.
const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const pentFreq = (root, i) => root * Math.pow(2, PENT[Math.min(i, PENT.length - 1)] / 12);

// The events a map can assign a sound to. Order drives the sound lab's columns.
const SOUND_EVENTS = [
  { key: 'merge',    label: 'Merge',      hint: 'two items combine into the next tier' },
  { key: 'collide',  label: 'Collision',  hint: 'items bump into each other' },
  { key: 'coin',     label: 'Coin',       hint: 'each coin of a payout shower' },
  { key: 'shoot',    label: 'Shoot',      hint: 'launching an item' },
  { key: 'gameOver', label: 'Game over',  hint: 'end of a run (except a new best)' },
  { key: 'best',     label: 'New best',   hint: 'the run beat this variant\'s high score' },
  { key: 'levelUp',  label: 'Level up',   hint: 'an XP level gained mid-run' },
];

const SOUND_LIB = {

// ============================ MERGE ============================

'merge-glass': {
  kind: 'merge', label: 'Glass pop',
  desc: 'The original: a rounded sine that bends up, with a glassy overtone. Pitch rises with tier.',
  play(a, out, o) {
    const t = o.when, tier = o.tier;
    const f = 220 * Math.pow(1.18, tier);
    const os = a.createOscillator(), g = a.createGain();
    os.type = 'sine'; os.frequency.setValueAtTime(f, t);
    os.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    os.connect(g).connect(out); os.start(t); os.stop(t + 0.25);

    const o2 = a.createOscillator(), g2 = a.createGain();
    o2.type = 'triangle'; o2.frequency.setValueAtTime(f * 2.5, t);
    g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o2.connect(g2).connect(out); o2.start(t); o2.stop(t + 0.32);
  }
},

'merge-bubble': {
  kind: 'merge', label: 'Broth bubble',
  desc: 'Warm bubbly "bloop" with a soft thump underneath — soup combining in a pot.',
  play(a, out, o) {
    const t = o.when, tier = o.tier;
    const f = 110 * Math.pow(1.15, tier);
    const os = a.createOscillator(), g = a.createGain();
    os.type = 'sine'; os.frequency.setValueAtTime(f * 1.4, t);
    os.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.18);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    os.connect(g).connect(out); os.start(t); os.stop(t + 0.3);

    const o2 = a.createOscillator(), g2 = a.createGain();
    o2.type = 'triangle'; o2.frequency.setValueAtTime(80 + tier * 12, t);
    o2.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g2.gain.setValueAtTime(0.18, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o2.connect(g2).connect(out); o2.start(t); o2.stop(t + 0.15);
  }
},

'merge-mochi': {
  kind: 'merge', label: 'Mochi squish',
  desc: 'Soft marimba tone with a low squish at the front — warm and wooden, no hard edges.',
  play(a, out, o) {
    const t = o.when;
    const base = 320 * Math.pow(1.13, o.tier);
    const os = a.createOscillator(), g = a.createGain();
    os.type = 'triangle'; os.frequency.setValueAtTime(base, t);
    os.frequency.exponentialRampToValueAtTime(base * 0.88, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    os.connect(g).connect(out); os.start(t); os.stop(t + 0.32);

    const o2 = a.createOscillator(), g2 = a.createGain();
    o2.type = 'sine'; o2.frequency.setValueAtTime(base * 2.0, t);
    g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.1, t + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o2.connect(g2).connect(out); o2.start(t); o2.stop(t + 0.2);

    sfxNoise(a, out, { when: t, dur: 0.03, vol: 0.18, type: 'lowpass', freq: 600, shape: 2 });
  }
},

'merge-arcane': {
  kind: 'merge', label: 'Arcane chime',
  desc: 'Bright bell sweeping upward with glassy overtones and a sparkle tail — a spell resolving.',
  play(a, out, o) {
    const t = o.when;
    const base = 520 * Math.pow(1.14, o.tier);
    const os = a.createOscillator(), g = a.createGain();
    os.type = 'sine'; os.frequency.setValueAtTime(base, t);
    os.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.24, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    os.connect(g).connect(out); os.start(t); os.stop(t + 0.55);

    const o2 = a.createOscillator(), g2 = a.createGain();
    o2.type = 'sine'; o2.frequency.setValueAtTime(base * 3.02, t);
    o2.frequency.exponentialRampToValueAtTime(base * 3.8, t + 0.12);
    g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.08, t + 0.015);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o2.connect(g2).connect(out); o2.start(t); o2.stop(t + 0.35);

    const o3 = a.createOscillator(), g3 = a.createGain();
    o3.type = 'triangle'; o3.frequency.setValueAtTime(base * 5.5, t + 0.04);
    o3.frequency.exponentialRampToValueAtTime(base * 7, t + 0.2);
    g3.gain.setValueAtTime(0.0001, t + 0.04); g3.gain.exponentialRampToValueAtTime(0.05, t + 0.07);
    g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o3.connect(g3).connect(out); o3.start(t + 0.04); o3.stop(t + 0.3);
  }
},

'merge-squeak': {
  kind: 'merge', label: 'Squeaker toy',
  desc: 'The classic plushie squeeze — nasal squeak bending up then down, over a stuffing poof.',
  play(a, out, o) {
    const t = o.when;
    const base = 700 * Math.pow(1.08, o.tier);
    const os = a.createOscillator(), g = a.createGain();
    const f = a.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(base * 1.5, t); f.Q.value = 3;
    os.type = 'triangle';
    os.frequency.setValueAtTime(base, t);
    os.frequency.exponentialRampToValueAtTime(base * 1.6, t + 0.07);
    os.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.16);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.26, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    os.connect(f).connect(g).connect(out); os.start(t); os.stop(t + 0.24);

    sfxNoise(a, out, { when: t, dur: 0.09, vol: 0.16, type: 'lowpass', freq: 500, shape: 2 });
  }
},

'merge-pluck': {
  kind: 'merge', label: 'Plucked string',
  desc: 'Ukulele / harp pluck. Higher tiers open the filter and ring longer, so big merges feel bigger.',
  play(a, out, o) {
    const t = o.when, tier = o.tier;
    const f = pentFreq(261.63, tier);   // C4 root
    const bright = 1 + tier * 0.12;
    const sustain = 0.5 + tier * 0.03;
    const os = a.createOscillator(), g = a.createGain();
    const lp = a.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 6 * bright, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.25);
    os.type = 'sawtooth'; os.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + sustain);
    os.connect(lp).connect(g).connect(out); os.start(t); os.stop(t + sustain + 0.05);

    const ob = a.createOscillator(), gb = a.createGain();
    ob.type = 'sine'; ob.frequency.setValueAtTime(f, t);
    gb.gain.setValueAtTime(0.0001, t);
    gb.gain.exponentialRampToValueAtTime(0.135, t + 0.01);
    gb.gain.exponentialRampToValueAtTime(0.0001, t + sustain * 0.9);
    ob.connect(gb).connect(out); ob.start(t); ob.stop(t + sustain);

    sfxNoise(a, out, { when: t, dur: 0.012, vol: 0.15 });
  }
},

'merge-china': {
  kind: 'merge', label: 'Porcelain ting',
  desc: 'A teaspoon tapped on a teacup: inharmonic china partials with a faint upward curl.',
  play(a, out, o) {
    const t = o.when;
    const base = 740 * Math.pow(1.09, o.tier);
    [[1, 1, 0.4], [2.53, 0.42, 0.25], [4.9, 0.15, 0.12]].forEach(([m, amp, dec]) => {
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'sine'; os.frequency.setValueAtTime(base * m, t);
      os.frequency.exponentialRampToValueAtTime(base * m * 1.015, t + dec);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2 * amp, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      os.connect(g).connect(out); os.start(t); os.stop(t + dec + 0.03);
    });
    sfxNoise(a, out, { when: t, dur: 0.008, vol: 0.1, type: 'highpass', freq: 3000, shape: 1.6 });
  }
},

'merge-sprout': {
  kind: 'merge', label: 'Sprout bloop',
  desc: 'Rounded sine bending upward like a crop popping out of the soil, plus a high sparkle.',
  play(a, out, o) {
    const t = o.when;
    const f = pentFreq(261.63, o.tier);   // C4 root
    const os = a.createOscillator(), g = a.createGain();
    os.type = 'sine';
    os.frequency.setValueAtTime(f * 0.6, t);
    os.frequency.exponentialRampToValueAtTime(f, t + 0.07);   // the "bloop" bend up
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    os.connect(g).connect(out); os.start(t); os.stop(t + 0.22);

    const o2 = a.createOscillator(), g2 = a.createGain();
    o2.type = 'sine'; o2.frequency.setValueAtTime(f * 4, t + 0.02);
    g2.gain.setValueAtTime(0.0001, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.05, t + 0.04);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o2.connect(g2).connect(out); o2.start(t + 0.02); o2.stop(t + 0.18);
  }
},

'merge-pastry-poof': {
  kind: 'merge', label: 'Pâtisserie poof',
  desc: 'Soft cream-puff squish with a powdered-sugar sparkle. The squishiest option.',
  play(a, out, o) {
    const t = o.when;
    const base = 250 * Math.pow(1.11, o.tier);
    const os = a.createOscillator(), g = a.createGain();
    os.type = 'sine'; os.frequency.setValueAtTime(base * 1.25, t);
    os.frequency.exponentialRampToValueAtTime(base * 0.85, t + 0.16);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.26, t + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    os.connect(g).connect(out); os.start(t); os.stop(t + 0.28);

    sfxNoise(a, out, { when: t, dur: 0.09, vol: 0.15, type: 'lowpass', freq: 750, shape: 1.6 });

    const o2 = a.createOscillator(), g2 = a.createGain();
    o2.type = 'sine'; o2.frequency.setValueAtTime(base * 6, t + 0.02);
    g2.gain.setValueAtTime(0.0001, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.05, t + 0.04);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o2.connect(g2).connect(out); o2.start(t + 0.02); o2.stop(t + 0.24);
  }
},

'merge-musette': {
  kind: 'merge', label: 'Musette accordion',
  desc: 'Three wet-tuned reeds with a swell instead of a pluck — instant Paris. Tiers climb F major.',
  play(a, out, o) {
    const t = o.when, tier = o.tier;
    const SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14];   // F major, 9 tiers
    const f = 349.23 * Math.pow(2, SCALE[Math.min(tier, SCALE.length - 1)] / 12);
    const dur = 0.28 + tier * 0.02;
    const g = a.createGain(), bp = a.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f * 2.2; bp.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.03);
    g.gain.setValueAtTime(0.16, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [0.988, 1, 1.012].forEach(det => {           // ~±20 cents — the musette shimmer
      const os = a.createOscillator();
      os.type = 'sawtooth'; os.frequency.setValueAtTime(f * det, t);
      os.connect(bp); os.start(t); os.stop(t + dur + 0.02);
    });
    bp.connect(g).connect(out);
  }
},

'merge-marimba': {
  kind: 'merge', label: 'Woody marimba',
  desc: 'Triangle tone plus marimba\'s signature 4th-harmonic knock. Warm, woody, cozy.',
  play(a, out, o) {
    const t = o.when;
    const f = pentFreq(261.63, o.tier);
    const os = a.createOscillator(), g = a.createGain();
    os.type = 'triangle'; os.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    os.connect(g).connect(out); os.start(t); os.stop(t + 0.44);

    const o2 = a.createOscillator(), g2 = a.createGain();
    o2.type = 'sine'; o2.frequency.setValueAtTime(f * 4, t);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.12, t + 0.006);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o2.connect(g2).connect(out); o2.start(t); o2.stop(t + 0.16);
  }
},

'merge-ocarina': {
  kind: 'merge', label: 'Ocarina bloom',
  desc: 'Breathy pennywhistle note with a soft attack — folk and pastoral. Cascades play a tune.',
  play(a, out, o) {
    const t = o.when, tier = o.tier;
    const f = pentFreq(261.63, tier);
    const dur = 0.26 + tier * 0.015;
    const g = a.createGain(), bp = a.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f * 1.5; bp.Q.value = 0.9;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.04);          // breathy swell, not a pluck
    g.gain.setValueAtTime(0.18, t + dur * 0.65);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [0.997, 1.003].forEach(det => {
      const os = a.createOscillator();
      os.type = 'triangle'; os.frequency.setValueAtTime(f * det, t);
      os.connect(bp); os.start(t); os.stop(t + dur + 0.02);
    });
    bp.connect(g).connect(out);
    sfxNoise(a, out, { when: t, dur: 0.05, vol: 0.05, type: 'highpass', freq: 2000, shape: 1.6 });
  }
},

'merge-musicbox': {
  kind: 'merge', label: 'Music box / celesta',
  desc: 'Sine fundamental plus bright inharmonic bell partials. Toy-like and twinkly.',
  play(a, out, o) {
    const t = o.when;
    const f = pentFreq(261.63, o.tier);
    [[1, 1, 0.7], [4.1, 0.28, 0.5], [6.7, 0.12, 0.35]].forEach(([mult, amp, dec]) => {
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'sine'; os.frequency.setValueAtTime(f * mult, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32 * amp, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      os.connect(g).connect(out); os.start(t); os.stop(t + dec + 0.05);
    });
  }
},

// ========================== COLLISION ==========================

'collide-glass': {
  kind: 'collide', label: 'Glass clink',
  desc: 'The original: four inharmonic partials plus a high tick. Bright and glassy.',
  play(a, out, o) {
    const t = o.when;
    const vol = Math.min(0.14, o.impact * 0.032);
    if (vol < 0.012) return;
    const base = 1800 + Math.random() * 1400;
    const partials = [1, 2.41, 3.88, 5.2];
    const decays   = [0.22, 0.16, 0.11, 0.08];
    partials.forEach((mult, i) => {
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'sine';
      os.frequency.setValueAtTime(base * mult, t);
      os.frequency.exponentialRampToValueAtTime(base * mult * 0.985, t + decays[i]);
      const pv = vol * (i === 0 ? 1 : 0.45 / i);
      g.gain.setValueAtTime(pv, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decays[i]);
      os.connect(g).connect(out);
      os.start(t); os.stop(t + decays[i] + 0.02);
    });
    const o2 = a.createOscillator(), g2 = a.createGain();
    o2.type = 'triangle'; o2.frequency.setValueAtTime(base * 6, t);
    g2.gain.setValueAtTime(vol * 0.5, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    o2.connect(g2).connect(out); o2.start(t); o2.stop(t + 0.025);
  }
},

'collide-wood-tok': {
  kind: 'collide', label: 'Wooden tok',
  desc: 'Hollow chopstick-on-bowl knock: two close partials with a clicky attack.',
  play(a, out, o) {
    const t = o.when;
    const vol = Math.min(0.18, o.impact * 0.04);
    if (vol < 0.014) return;
    const base = 380 + Math.random() * 220;
    [1, 1.55].forEach((mult, i) => {
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'sine';
      os.frequency.setValueAtTime(base * mult, t);
      os.frequency.exponentialRampToValueAtTime(base * mult * 0.92, t + 0.06);
      const pv = vol * (i === 0 ? 1 : 0.5);
      g.gain.setValueAtTime(pv, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      os.connect(g).connect(out);
      os.start(t); os.stop(t + 0.1);
    });
    sfxNoise(a, out, { when: t, dur: 0.025, vol: vol * 0.6, type: 'bandpass', freq: 900, q: 1.5 });
  }
},

'collide-soft-food': {
  kind: 'collide', label: 'Soft food bump',
  desc: 'Mochi/dango squishing together — a warm thud that drops in pitch, no hard edges.',
  play(a, out, o) {
    const t = o.when;
    const vol = Math.min(0.35, o.impact * 0.08);
    if (vol < 0.02) return;
    const base = 200 + Math.random() * 120;
    const os = a.createOscillator(), g = a.createGain();
    os.type = 'sine';
    os.frequency.setValueAtTime(base, t);
    os.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.1);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    os.connect(g).connect(out); os.start(t); os.stop(t + 0.2);
    sfxNoise(a, out, { when: t, dur: 0.07, vol: vol * 0.9, type: 'lowpass', freq: 900, shape: 1.5 });
  }
},

'collide-crystal': {
  kind: 'collide', label: 'Crystal tink',
  desc: 'Light glassy tink with a quick ring — the brightest collision in the game.',
  play(a, out, o) {
    const t = o.when;
    const vol = Math.min(0.13, o.impact * 0.03);
    if (vol < 0.012) return;
    const base = 2100 + Math.random() * 900;
    [1, 2.05].forEach((mult, i) => {
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'sine';
      os.frequency.setValueAtTime(base * mult, t);
      os.frequency.exponentialRampToValueAtTime(base * mult * 0.99, t + 0.09);
      const pv = vol * (i === 0 ? 1 : 0.4);
      g.gain.setValueAtTime(pv, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      os.connect(g).connect(out); os.start(t); os.stop(t + 0.14);
    });
  }
},

'collide-fabric': {
  kind: 'collide', label: 'Fabric poof',
  desc: 'The softest option: a muffled plush thump with a fabric brush and no attack at all.',
  play(a, out, o) {
    const t = o.when;
    const vol = Math.min(0.3, o.impact * 0.07);
    if (vol < 0.02) return;
    const base = 130 + Math.random() * 70;
    const os = a.createOscillator(), g = a.createGain();
    os.type = 'sine';
    os.frequency.setValueAtTime(base, t);
    os.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.11);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    os.connect(g).connect(out); os.start(t); os.stop(t + 0.18);
    sfxNoise(a, out, { when: t, dur: 0.08, vol: vol * 0.8, type: 'lowpass', freq: 650, shape: 1.8 });
  }
},

'collide-hollow-body': {
  kind: 'collide', label: 'Hollow body knock',
  desc: 'Tapping the side of a guitar: a warm low thud with a felt attack.',
  play(a, out, o) {
    const t = o.when;
    const vol = Math.min(0.16, o.impact * 0.035);
    if (vol < 0.013) return;
    const base = 220 + Math.random() * 160;
    [1, 1.5].forEach((mult, i) => {
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'sine';
      os.frequency.setValueAtTime(base * mult, t);
      os.frequency.exponentialRampToValueAtTime(base * mult * 0.9, t + 0.07);
      const pv = vol * (i === 0 ? 1 : 0.4);
      g.gain.setValueAtTime(pv, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      os.connect(g).connect(out); os.start(t); os.stop(t + 0.11);
    });
    sfxNoise(a, out, { when: t, dur: 0.02, vol: vol * 0.5, type: 'lowpass', freq: 700 });
  }
},

'collide-pastry': {
  kind: 'collide', label: 'Pastry bump',
  desc: 'A dusted thud — pastry landing on a plate, with powdered sugar on top.',
  play(a, out, o) {
    const t = o.when;
    const vol = Math.min(0.26, o.impact * 0.06);
    if (vol < 0.018) return;
    const base = 180 + Math.random() * 90;
    const os = a.createOscillator(), g = a.createGain();
    os.type = 'sine'; os.frequency.setValueAtTime(base, t);
    os.frequency.exponentialRampToValueAtTime(base * 0.6, t + 0.1);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    os.connect(g).connect(out); os.start(t); os.stop(t + 0.17);
    sfxNoise(a, out, { when: t, dur: 0.06, vol: vol * 0.7, type: 'lowpass', freq: 800, shape: 1.6 });
  }
},

'collide-dirt': {
  kind: 'collide', label: 'Dirt thud',
  desc: 'Earthy body drop with a soil crumble — produce settling into the bed.',
  play(a, out, o) {
    const t = o.when;
    const vol = Math.min(0.24, o.impact * 0.055);
    if (vol < 0.016) return;
    const base = 140 + Math.random() * 70;
    const os = a.createOscillator(), g = a.createGain();
    os.type = 'sine'; os.frequency.setValueAtTime(base, t);
    os.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.11);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    os.connect(g).connect(out); os.start(t); os.stop(t + 0.16);
    sfxNoise(a, out, { when: t, dur: 0.07, vol: vol * 0.85, type: 'lowpass', freq: 550, shape: 1.6 });
  }
},

'collide-saucer': {
  kind: 'collide', label: 'Saucer tick',
  desc: 'Delicate china tap — daintier and quieter than the glass clink.',
  play(a, out, o) {
    const t = o.when;
    const vol = Math.min(0.11, o.impact * 0.026);
    if (vol < 0.011) return;
    const base = 2600 + Math.random() * 1000;
    [[1, 0.08], [2.7, 0.05]].forEach(([m, dec], i) => {
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'sine'; os.frequency.setValueAtTime(base * m, t);
      g.gain.setValueAtTime(vol * (i === 0 ? 1 : 0.4), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      os.connect(g).connect(out); os.start(t); os.stop(t + dec + 0.02);
    });
  }
},

'collide-bed-frame': {
  kind: 'collide', label: 'Wooden frame knock',
  desc: 'Hitting the raised-bed frame: a drier, higher wooden knock with a click.',
  play(a, out, o) {
    const t = o.when;
    const vol = Math.min(0.2, o.impact * 0.045);
    if (vol < 0.014) return;
    const base = 300 + Math.random() * 140;
    [[1, 0.09], [2.8, 0.05]].forEach(([m, dec], i) => {
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'triangle'; os.frequency.setValueAtTime(base * m, t);
      g.gain.setValueAtTime(vol * (i === 0 ? 1 : 0.35), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      os.connect(g).connect(out); os.start(t); os.stop(t + dec + 0.02);
    });
    sfxNoise(a, out, { when: t, dur: 0.01, vol: vol * 0.4, type: 'highpass', freq: 2500, shape: 1.6 });
  }
},

// ============================ COIN ============================
// Coin voices get `index` — the coin's position in the CURRENT payout shower.
// audio.js restarts the count when a gap opens (see coinTick), so a voice can
// climb a run without keeping its own state.

'coin-blip': {
  kind: 'coin', label: 'Arcade blip',
  desc: 'The original two-step square blip. Same for every coin.',
  play(a, out, o) {
    const t = o.when;
    const os = a.createOscillator(), g = a.createGain();
    os.type = 'square'; os.frequency.setValueAtTime(1568, t);
    os.frequency.setValueAtTime(2093, t + 0.04);
    g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    os.connect(g).connect(out); os.start(t); os.stop(t + 0.13);
  }
},

'coin-pentatonic-run': {
  kind: 'coin', label: 'Pentatonic run',
  desc: 'Each coin plays the next step of a rising pentatonic run, then holds the top note — a payout pours in as a harp cascade.',
  play(a, out, o) {
    const t = o.when;
    const f = pentFreq(523.25, o.index);   // C5 root — sparkles above the merges
    const os = a.createOscillator(), g = a.createGain();
    os.type = 'triangle'; os.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    os.connect(g).connect(out); os.start(t); os.stop(t + 0.2);
    const o2 = a.createOscillator(), g2 = a.createGain();
    o2.type = 'sine'; o2.frequency.setValueAtTime(f * 2, t);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.028, t + 0.006);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o2.connect(g2).connect(out); o2.start(t); o2.stop(t + 0.13);
  }
},

'coin-shepard': {
  kind: 'coin', label: 'Endless rise (Shepard)',
  desc: 'Same pitch class stacked across octaves under a fixed bell curve — the run seems to climb forever, however long the payout runs.',
  play(a, out, o) {
    const t = o.when;
    const SHEP = [0, 2, 4, 7, 9];
    const frac = SHEP[((o.index % 5) + 5) % 5] / 12;
    const FMIN = 65.41, OCT = 7;                       // C2 .. C8
    const centerLog = Math.log2(1046.5), sigma = 1.4;  // bell anchored at C6
    for (let k = 0; k < OCT; k++) {
      const f = FMIN * Math.pow(2, frac + k);
      const w = Math.exp(-0.5 * Math.pow((Math.log2(f) - centerLog) / sigma, 2));
      if (w < 0.04) continue;
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'triangle'; os.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06 * w, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
      os.connect(g).connect(out); os.start(t); os.stop(t + 0.21);
    }
  }
},

'coin-bell': {
  kind: 'coin', label: 'Service bell',
  desc: 'Tiny counter-bell ding. A slight random pitch wobble keeps a fast shower from drilling.',
  play(a, out, o) {
    const t = o.when;
    const f = 2093 * (1 + (Math.random() - 0.5) * 0.05);
    [[1, 0.07, 0.22], [2.67, 0.025, 0.12]].forEach(([m, vol, dec]) => {
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'sine'; os.frequency.setValueAtTime(f * m, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      os.connect(g).connect(out); os.start(t); os.stop(t + dec + 0.02);
    });
  }
},

'coin-xylophone': {
  kind: 'coin', label: 'Wooden xylophone tick',
  desc: 'Bright wooden tick with a slight pitch wobble per coin.',
  play(a, out, o) {
    const t = o.when;
    const f = 1568 * (1 + (Math.random() - 0.5) * 0.04);
    const os = a.createOscillator(), g = a.createGain();
    os.type = 'triangle'; os.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    os.connect(g).connect(out); os.start(t); os.stop(t + 0.14);
    const o2 = a.createOscillator(), g2 = a.createGain();
    o2.type = 'sine'; o2.frequency.setValueAtTime(f * 4, t);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.02, t + 0.005);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o2.connect(g2).connect(out); o2.start(t); o2.stop(t + 0.08);
  }
},

'coin-chime': {
  kind: 'coin', label: 'Sparkle chime',
  desc: 'Glockenspiel sparkle — brighter and airier than the xylophone tick.',
  play(a, out, o) {
    const t = o.when;
    const f = 2093 * (1 + (Math.random() - 0.5) * 0.05);
    [[1, 0.06, 0.24], [3.5, 0.02, 0.12]].forEach(([m, vol, dec]) => {
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'sine'; os.frequency.setValueAtTime(f * m, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      os.connect(g).connect(out); os.start(t); os.stop(t + dec + 0.02);
    });
  }
},

// ============================ SHOOT ============================

'shoot-whoosh': {
  kind: 'shoot', label: 'Whoosh',
  desc: 'Filtered noise sweep plus a short rising tone — the launch.',
  play(a, out, o) {
    const t = o.when;
    const len = a.sampleRate * 0.15;
    const buf = a.createBuffer(1, len, a.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(2200, t + 0.12);
    const g = a.createGain();
    g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    src.connect(f).connect(g).connect(out); src.start(t);

    const os = a.createOscillator(), g2 = a.createGain();
    os.type = 'triangle'; os.frequency.setValueAtTime(320, t);
    os.frequency.exponentialRampToValueAtTime(520, t + 0.08);
    g2.gain.setValueAtTime(0.1, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    os.connect(g2).connect(out); os.start(t); os.stop(t + 0.14);
  }
},

// ========================== GAME OVER ==========================
// Tone target: "the café is closing", not "you failed" — this plays at the end
// of EVERY run, including great ones.

'over-gently-down': {
  kind: 'gameOver', label: 'Gently down',
  desc: 'Three warm descending notes (E5 C5 G4) landing on a soft low C.',
  play(a, out, o) {
    const t = o.when;
    [659.25, 523.25, 392.00].forEach((f, i) => {
      const st = t + i * 0.22, last = i === 2;
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'triangle'; os.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(last ? 0.16 : 0.14, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + (last ? 0.8 : 0.3));
      os.connect(g).connect(out); os.start(st); os.stop(st + (last ? 0.85 : 0.34));
    });
    const st = t + 0.44;
    const os = a.createOscillator(), g = a.createGain();
    os.type = 'sine'; os.frequency.setValueAtTime(130.81, st);
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.08, st + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, st + 0.9);
    os.connect(g).connect(out); os.start(st); os.stop(st + 0.95);
  }
},

'over-last-call': {
  kind: 'gameOver', label: 'Last-call bell',
  desc: 'Two mellow low tolls — "the bar is closing".',
  play(a, out, o) {
    const t = o.when;
    [0, 0.55].forEach((dt, n) => {
      const base = 392, vol = n === 0 ? 0.13 : 0.10;
      [[1, 1], [2.4, 0.35], [4.2, 0.12]].forEach(([m, amp]) => {
        const dec = 1.1 / Math.sqrt(m);
        const os = a.createOscillator(), g = a.createGain();
        os.type = 'sine'; os.frequency.setValueAtTime(base * m, t + dt);
        g.gain.setValueAtTime(0.0001, t + dt);
        g.gain.exponentialRampToValueAtTime(vol * amp, t + dt + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + dec);
        os.connect(g).connect(out); os.start(t + dt); os.stop(t + dt + dec + 0.03);
      });
    });
  }
},

'over-slide-plop': {
  kind: 'gameOver', label: 'Slide & plop',
  desc: 'Comedic slide-whistle deflate with a soft plop landing. The playful option.',
  play(a, out, o) {
    const t = o.when;
    const os = a.createOscillator(), g = a.createGain();
    os.type = 'triangle';
    os.frequency.setValueAtTime(950, t);
    os.frequency.exponentialRampToValueAtTime(340, t + 0.55);
    const lfo = a.createOscillator(), lg = a.createGain();   // slide-whistle warble
    lfo.frequency.value = 7; lg.gain.value = 14;
    lfo.connect(lg).connect(os.frequency); lfo.start(t); lfo.stop(t + 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    os.connect(g).connect(out); os.start(t); os.stop(t + 0.62);

    const tp = t + 0.6;
    const o2 = a.createOscillator(), g2 = a.createGain();
    o2.type = 'sine'; o2.frequency.setValueAtTime(180, tp);
    o2.frequency.exponentialRampToValueAtTime(55, tp + 0.1);
    g2.gain.setValueAtTime(0.2, tp);
    g2.gain.exponentialRampToValueAtTime(0.0001, tp + 0.13);
    o2.connect(g2).connect(out); o2.start(tp); o2.stop(tp + 0.15);
    sfxNoise(a, out, { when: tp, dur: 0.03, vol: 0.1, type: 'lowpass', freq: 500, shape: 1.6 });
  }
},

'over-bittersweet': {
  kind: 'gameOver', label: 'Bittersweet resolve',
  desc: 'A descending line landing on a warm low major chord — "well played, the table\'s closed".',
  play(a, out, o) {
    const t = o.when;
    [783.99, 659.25, 523.25].forEach((f, i) => {          // G5 E5 C5
      const st = t + i * 0.15;
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'triangle'; os.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.11, st + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.28);
      os.connect(g).connect(out); os.start(st); os.stop(st + 0.3);
    });
    const tc = t + 0.5;
    [261.63, 329.63, 392.00].forEach(f => {               // C4 E4 G4, soft swell
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'sine'; os.frequency.setValueAtTime(f, tc);
      g.gain.setValueAtTime(0.0001, tc);
      g.gain.linearRampToValueAtTime(0.07, tc + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, tc + 0.9);
      os.connect(g).connect(out); os.start(tc); os.stop(tc + 0.95);
    });
  }
},

// =========================== NEW BEST ===========================

'best-brass-fanfare': {
  kind: 'best', label: 'Brass fanfare',
  desc: 'A proper "ta-ta-ta-daaa!": trumpet triplet into a held C-major chord with vibrato and a sparkle tail.',
  play(a, out, o) {
    const t = o.when;
    const brass = (f, st, dur, vol, vib) => {
      const os = a.createOscillator(), g = a.createGain(), lp = a.createBiquadFilter();
      os.type = 'sawtooth'; os.frequency.setValueAtTime(f, st);
      lp.type = 'lowpass'; lp.Q.value = 1.2;
      lp.frequency.setValueAtTime(f * 1.5, st);
      lp.frequency.linearRampToValueAtTime(f * 4.5, st + 0.06);   // the brassy "blat"
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(vol, st + 0.025);
      g.gain.setValueAtTime(vol, st + Math.max(0.03, dur - 0.09));
      g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
      if (vib) {
        const lfo = a.createOscillator(), lg = a.createGain();
        lfo.frequency.value = 5.5; lg.gain.value = f * 0.014;
        lfo.connect(lg).connect(os.frequency);
        lfo.start(st + 0.18); lfo.stop(st + dur);
      }
      os.connect(lp).connect(g).connect(out);
      os.start(st); os.stop(st + dur + 0.02);
    };
    brass(784,  t + 0.00, 0.15, 0.15);
    brass(784,  t + 0.17, 0.15, 0.15);
    brass(784,  t + 0.34, 0.15, 0.15);
    brass(1047, t + 0.52, 1.00, 0.17, true);   // lead: C6, held with vibrato
    brass(659,  t + 0.52, 1.00, 0.07, true);   // harmony: E5
    brass(784,  t + 0.52, 1.00, 0.07, true);   // harmony: G5

    const ts = t + 0.62;
    const o3 = a.createOscillator(), g3 = a.createGain();
    o3.type = 'triangle';
    o3.frequency.setValueAtTime(2093, ts);
    o3.frequency.exponentialRampToValueAtTime(3136, ts + 0.20);   // sweep up to G7
    g3.gain.setValueAtTime(0.0001, ts);
    g3.gain.exponentialRampToValueAtTime(0.13, ts + 0.02);
    g3.gain.exponentialRampToValueAtTime(0.0001, ts + 0.45);
    o3.connect(g3).connect(out); o3.start(ts); o3.stop(ts + 0.48);
  }
},

'best-rising-bells': {
  kind: 'best', label: 'Rising bells',
  desc: 'The pre-2026-07-19 flourish: a rising major arpeggio with octaves under it and a sparkle sweep.',
  play(a, out, o) {
    const t = o.when;
    const notes = [1047, 1319, 1568, 2093];   // C6 E6 G6 C7
    notes.forEach((f, i) => {
      const st = t + i * 0.10;
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'triangle'; os.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.22, st + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.32);
      os.connect(g).connect(out); os.start(st); os.stop(st + 0.34);
      const o2 = a.createOscillator(), g2 = a.createGain();
      o2.type = 'sine'; o2.frequency.setValueAtTime(f * 0.5, st);
      g2.gain.setValueAtTime(0.0001, st);
      g2.gain.exponentialRampToValueAtTime(0.10, st + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0001, st + 0.24);
      o2.connect(g2).connect(out); o2.start(st); o2.stop(st + 0.26);
    });
    const ts = t + notes.length * 0.10;
    const o3 = a.createOscillator(), g3 = a.createGain();
    o3.type = 'triangle';
    o3.frequency.setValueAtTime(2093, ts);
    o3.frequency.exponentialRampToValueAtTime(3136, ts + 0.20);
    g3.gain.setValueAtTime(0.0001, ts);
    g3.gain.exponentialRampToValueAtTime(0.13, ts + 0.02);
    g3.gain.exponentialRampToValueAtTime(0.0001, ts + 0.45);
    o3.connect(g3).connect(out); o3.start(ts); o3.stop(ts + 0.48);
  }
},

'best-harp-run': {
  kind: 'best', label: 'Harp run + chord',
  desc: 'A fast pentatonic run up two octaves resolving on a bright major chord.',
  play(a, out, o) {
    const t = o.when;
    const harp = (f, st, vol) => {
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'triangle'; os.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(vol, st + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.5);
      os.connect(g).connect(out); os.start(st); os.stop(st + 0.55);
      const o2 = a.createOscillator(), g2 = a.createGain();
      o2.type = 'sine'; o2.frequency.setValueAtTime(f * 2, st);
      g2.gain.setValueAtTime(0.0001, st);
      g2.gain.exponentialRampToValueAtTime(vol * 0.3, st + 0.006);
      g2.gain.exponentialRampToValueAtTime(0.0001, st + 0.22);
      o2.connect(g2).connect(out); o2.start(st); o2.stop(st + 0.25);
    };
    const run = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    run.forEach((s, i) => harp(261.63 * Math.pow(2, s / 12), t + i * 0.05, 0.13));
    const tc = t + run.length * 0.05 + 0.04;
    [1047, 1319, 1568, 2093].forEach(f => harp(f, tc, 0.14));   // C6 E6 G6 C7
  }
},

'best-musicbox': {
  kind: 'best', label: 'Music-box sparkle',
  desc: 'The celesta timbre rising into a shimmering high chord. The gentlest celebration.',
  play(a, out, o) {
    const t = o.when;
    const box = (f, vol, st) => {
      [[1, 1, 0.7], [4.1, 0.28, 0.5], [6.7, 0.12, 0.35]].forEach(([mult, amp, dec]) => {
        const os = a.createOscillator(), g = a.createGain();
        os.type = 'sine'; os.frequency.setValueAtTime(f * mult, st);
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(vol * amp, st + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, st + dec);
        os.connect(g).connect(out); os.start(st); os.stop(st + dec + 0.05);
      });
    };
    const notes = [1047, 1319, 1568, 2093, 2637];   // C6 E6 G6 C7 E7
    notes.forEach((f, i) => box(f, 0.30, t + i * 0.11));
    [2093, 2637, 3136].forEach(f => box(f, 0.16, t + notes.length * 0.11 + 0.05));
  }
},

// =========================== LEVEL UP ===========================

'levelup-triad': {
  kind: 'levelUp', label: 'Ascending triad',
  desc: 'A quick bright C-E-G-C climb with a glass shimmer. Deliberately shorter and softer than any new-best flourish — it fires mid-play.',
  play(a, out, o) {
    const t = o.when;
    const notes = [523.25, 659.25, 783.99, 1046.5];   // C5 E5 G5 C6
    notes.forEach((f, i) => {
      const st = t + i * 0.065, last = i === notes.length - 1;
      const os = a.createOscillator(), g = a.createGain();
      os.type = 'triangle'; os.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(last ? 0.14 : 0.09, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + (last ? 0.45 : 0.18));
      os.connect(g).connect(out); os.start(st); os.stop(st + (last ? 0.5 : 0.22));
    });
    const ts = t + 0.22;
    const o2 = a.createOscillator(), g2 = a.createGain();
    o2.type = 'sine'; o2.frequency.setValueAtTime(2093, ts);
    o2.frequency.exponentialRampToValueAtTime(2637, ts + 0.16);
    g2.gain.setValueAtTime(0.0001, ts);
    g2.gain.exponentialRampToValueAtTime(0.05, ts + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.0001, ts + 0.3);
    o2.connect(g2).connect(out); o2.start(ts); o2.stop(ts + 0.32);
  }
},

};  // end SOUND_LIB

// Resolve "what does map X play for event Y" — the map's own pick, else the
// shared default. Used by audio.js at play time and by the sound lab's matrix,
// so both always agree. Falls back to the default voice if a map names an id
// that no longer exists (a renamed voice can never silence the game).
function soundIdFor(mapId, event) {
  const perMap = (typeof SOUND_MAP !== 'undefined' && SOUND_MAP[mapId]) || null;
  const id = (perMap && perMap[event]) || SOUND_MAP.default[event];
  return SOUND_LIB[id] ? id : SOUND_MAP.default[event];
}

function soundVoiceFor(mapId, event) {
  return SOUND_LIB[soundIdFor(mapId, event)];
}
