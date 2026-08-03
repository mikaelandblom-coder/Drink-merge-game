// Audio PLUMBING: output routing (incl. the iOS workarounds), mute/music
// toggles, and the thin dispatch from a game event to the sound assigned to the
// active map.
//
// The sounds themselves are NOT here — they live in config/sounds.js
// (SOUND_LIB), and config/soundmap.js says which one each map plays for each
// event. tools/sound-lab.html loads those same two files, so what you audition
// in the lab is literally what the game plays, and swapping a map's sound is a
// one-line data change instead of a code port.

let actx = null;
let muted = false;
let soundMapId = 'default';   // active map id; picks the voice set (see setMapSounds)

// Called by startGame() when a map loads. Unknown ids are harmless: every
// lookup falls back to SOUND_MAP.default.
function setMapSounds(mapId) {
  soundMapId = mapId || 'default';
  coinRunIdx = 0; coinRunLastMs = 0;
}

// Master SFX output bus. On iOS, ctx.destination is tied to the RINGER/alerts
// channel — with that channel muted or at zero volume, every synth sound is
// silent while <audio> music plays on the media channel (diagnosed on Mai's
// iPad 2026-07-20: context state running, render clock advancing, direct beep
// inaudible, MediaStream-routed beep audible). So on iOS the bus feeds a
// MediaStreamDestination piped into an <audio> element — same channel as the
// music. Everywhere else it connects straight to ctx.destination.
// This is also why no voice in config/sounds.js may touch ctx.destination
// itself: they are handed sfxBus and must render into it.
let sfxBus = null, sfxEl = null, sfxDest = null;
let SFX_VIA_ELEMENT = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS reports as Mac

// Recovery state for the "came back to the tab and SFX are gone" bug (Mai's
// iPad, 2026-07-26). Backgrounding the page KILLS the MediaStream carrier
// above: iOS ends the stream track, and neither resume() nor play() ever
// revives it — the element keeps reporting paused:false while the stream
// behind it is dead, so nothing even looks wrong. The ONLY cure is a fresh
// MediaStreamDestination + <audio> (which is why a page reload used to be the
// only fix, costing her the run). So: mark the route stale whenever we lose
// the foreground or the context stops running, and rebuild it on the next
// user gesture. Separately, a context can come back reporting 'running' with
// a STALLED render clock — that one needs the whole context recreated
// (needHardReset), also done inside a gesture because iOS prefers it.
let sfxStale = false, needHardReset = false, healthTimer = 0;

function routeSfx() {
  if (!SFX_VIA_ELEMENT) { sfxBus.connect(actx.destination); return; }
  sfxDest = actx.createMediaStreamDestination();
  sfxBus.connect(sfxDest);
  sfxEl = document.createElement('audio');
  sfxEl.setAttribute('playsinline', '');
  sfxEl.srcObject = sfxDest.stream;
  sfxEl.play().catch(() => {});   // ac() runs inside a tap gesture
}

function teardownSfxRoute() {
  if (sfxBus) { try { sfxBus.disconnect(); } catch {} }
  if (sfxEl)  { try { sfxEl.pause(); } catch {} sfxEl.srcObject = null; }
  if (sfxDest) { try { sfxDest.stream.getTracks().forEach(t => t.stop()); } catch {} }
  sfxEl = null; sfxDest = null;
}

// Swap in a brand-new carrier without touching the AudioContext. Cheap (one
// node + one element) and inaudible: nothing is playing at wake-up time.
function rebuildSfxRoute() {
  if (!actx) return;
  teardownSfxRoute();
  routeSfx();
}

// Last resort: throw the whole context away and build a fresh one. Safe
// because every voice grabs ac()/sfxBus at call time — nothing caches nodes
// across calls except the bug panel's diag pair, cleared here too.
function hardResetAudio() {
  needHardReset = false; sfxStale = false;
  const old = actx;
  teardownSfxRoute();
  actx = null; sfxBus = null; diagEl = null; diagDest = null;
  if (old) { try { old.close(); } catch {} }
  ac();
  if (actx.state !== 'running') actx.resume().catch(() => {});
}

function ac() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    // iOS Safari parks the context in 'interrupted'/'suspended' after a screen
    // lock, app switch or Siri; the bgm <audio> element recovers on its own,
    // but synth SFX stay silent until the context is explicitly resumed.
    actx.onstatechange = () => {
      if (actx && actx.state !== 'running') sfxStale = true;
      if (!document.hidden) resumeCtx();
    };
    sfxBus = actx.createGain();
    applySfxVol();   // the bus is new — re-apply the user's level (see "volume")
    routeSfx();
  }
  return actx;
}

// `gesture` = we are inside a user tap, so it is safe to rebuild the carrier
// (a new <audio> may need a gesture to play) or recreate the context.
function resumeCtx(gesture) {
  if (!actx) return;
  if (gesture && needHardReset) { hardResetAudio(); return; }
  if (actx.state !== 'running') actx.resume().catch(() => {});
  // Only the iOS element route rots this way; on the direct route a rebuild
  // would just churn (and briefly cut whatever is playing) for nothing.
  if (gesture && sfxStale) { sfxStale = false; if (SFX_VIA_ELEMENT) rebuildSfxRoute(); }
  // iOS pauses media elements on background — the SFX carrier included.
  if (sfxEl && sfxEl.paused) sfxEl.play().catch(() => {});
  checkAudioHealth();
}

// Sample the render clock a moment later: a context that isn't advancing it is
// producing silence no matter what state it reports. Flag it for the hard
// reset the next tap will perform.
function checkAudioHealth() {
  if (!actx || healthTimer) return;
  const t0 = actx.currentTime;
  healthTimer = setTimeout(() => {
    healthTimer = 0;
    if (!actx || document.hidden) return;
    if (actx.state !== 'running' || actx.currentTime === t0) needHardReset = true;
  }, 400);
}

// Called from game.js when the page goes to the background: assume iOS has
// killed the carrier, so the next tap rebuilds it.
function markAudioInterrupted() {
  sfxStale = true;
}

function initAudio() {
  // Called on every pointerdown (ui.js) — creates the AudioContext on the
  // first gesture, and inside a gesture thereafter resumes it and repairs the
  // iOS SFX route if a background/interruption killed it.
  ac();
  resumeCtx(true);
}

// Restored from the back/forward cache (iOS does this via the app switcher):
// the context and its carrier are usually dead, and no visibilitychange may
// have fired. Treat it exactly like a background return.
window.addEventListener('pageshow', e => {
  if (!e.persisted) return;
  sfxStale = true;
  resumeCtx();
});

// ---------- event dispatch ----------
// One line per game event: look up the voice the active map assigned to it and
// render it into the SFX bus. Nothing here knows what any sound is made of.

function playSound(event, opts) {
  if (muted) return;
  const voice = soundVoiceFor(soundMapId, event);
  if (!voice) return;
  const a = ac();
  const o = opts || {};
  o.when = a.currentTime;
  voice.play(a, sfxBus, o);
}

function pop(tier)      { playSound('merge',   { tier, tiers: ITEMS.length }); }
function clink(impact)  { playSound('collide', { impact }); }
function shoot()        { playSound('shoot',   {}); }
function fanfare()      { playSound('best',    {}); }
function levelUp()      { playSound('levelUp', {}); }
function gameOver()     { playSound('gameOver', {}); }

// Coins pour in ~110ms apart. Voices that climb a run (the pentatonic/Shepard
// ones) need to know where in the shower each coin sits, so the run is counted
// HERE and passed in — that keeps every coin voice stateless. A gap of >350ms
// means a new payout started, so the run restarts from the bottom.
let coinRunIdx = 0, coinRunLastMs = 0;
function coinTick() {
  const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  if (now - coinRunLastMs > 350) coinRunIdx = 0;
  coinRunLastMs = now;
  playSound('coin', { index: coinRunIdx++ });
}

// ---------- music ----------
let musicOn = true, musicStarted = false;
let bgmEl = null;

function initMusic(audioEl, volume, src) {
  bgmEl = audioEl;
  mapBgmVol = volume;
  applyMusicVol();   // map level x the user's slider (see "volume")
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
  // Before the track has started, the first press IS "turn it on" (autoplay
  // needs a gesture) — it must never read as a toggle-off. This still goes
  // through setSoundEnabled so the zero-volume restore applies here too: the
  // branch used to force the icon on while leaving musicOn false and the
  // slider at 0, i.e. an "on" button playing nothing.
  setSoundEnabled('music', musicStarted ? !musicOn : true);
  startMusic();   // no-op once started
  setToggleBtn(btn, musicOn);
}

function toggleMute(btn) {
  setSoundEnabled('sfx', muted);
  setToggleBtn(btn, !muted);
}

// ---------- volume ----------
// Two user multipliers, remembered forever (Mai likes the BGM but it drowns the
// game, 2026-08-03). Deliberately NOT a mute replacement: the buttons still
// toggle, and a long-press on either opens its slider (ui.js).
//
// Music is a multiplier over the map's authored `bgmVol` (config/maps.js) so
// per-map mixing survives — a track balanced quieter stays quieter relative to
// the others. SFX is the master bus gain, which is why applySfxVol() has to run
// again every time the bus is rebuilt (hardResetAudio -> ac()).
const VOL_KEYS = { music: 'mm_vol_music_v1', sfx: 'mm_vol_sfx_v1' };
const VOL_RESUME = 0.5;   // level a toggle-back-on returns to when the slider sits at 0

let musicVol = loadVol('music'), sfxVol = loadVol('sfx');
let mapBgmVol = 0.35;     // the active map's authored level; set by initMusic()

function loadVol(kind) {
  try {
    const v = parseFloat(localStorage.getItem(VOL_KEYS[kind]));
    return (v >= 0 && v <= 1) ? v : 1;   // NaN fails both comparisons -> full
  } catch { return 1; }
}

function getVolume(kind) { return kind === 'music' ? musicVol : sfxVol; }

function setVolume(kind, v) {
  v = Math.max(0, Math.min(1, v));
  if (kind === 'music') { musicVol = v; applyMusicVol(); }
  else { sfxVol = v; applySfxVol(); }
  try { localStorage.setItem(VOL_KEYS[kind], String(v)); } catch {}
}

function applyMusicVol() { if (bgmEl) bgmEl.volume = mapBgmVol * musicVol; }
function applySfxVol()   { if (sfxBus) sfxBus.gain.value = sfxVol; }

// The single door for "is this channel on", used by BOTH the toggle buttons and
// the sliders — a slider dragged to zero is off, and the icon must say so, or it
// claims sound is on while nothing can be heard.
function isSoundEnabled(kind) { return kind === 'music' ? musicOn : !muted; }

function setSoundEnabled(kind, on) {
  // Coming back on at zero would be a silent "on" — restore something audible.
  if (on && getVolume(kind) === 0) setVolume(kind, VOL_RESUME);
  if (kind === 'music') {
    musicOn = on;
    if (bgmEl) { if (on) bgmEl.play().catch(() => {}); else bgmEl.pause(); }
  } else {
    muted = !on;
    // Turning sound back on force-rebuilds the iOS route, so a stuck-silent
    // context can be fixed mid-run with two taps instead of a run-destroying
    // page reload.
    if (on) repairAudio();
  }
}

// Unconditional repair, for the manual escape hatches (sound button, bug
// panel). Always runs inside a tap, so both rebuild paths are allowed.
function repairAudio() {
  if (!actx) { initAudio(); return; }
  if (needHardReset) { hardResetAudio(); return; }
  if (actx.state !== 'running') actx.resume().catch(() => {});
  if (SFX_VIA_ELEMENT) { sfxStale = false; rebuildSfxRoute(); }
  checkAudioHealth();
}

// HUD toggle buttons show their state via icon swap (.off class), not text.
function setToggleBtn(btn, on) {
  btn.classList.toggle('off', !on);
  btn.setAttribute('aria-pressed', String(on));
}

// ---------- audio self-test (bug panel) ----------
// Isolates WHERE iPad "SFX silent, music fine" happens. Two beeps:
//   beep 1: oscillator -> ctx.destination — the normal SFX path.
//   beep 2: oscillator -> MediaStreamDestination -> <audio> element — the BGM
//           path, which is known to work on the affected device.
// Hearing 2 but not 1 = the context renders fine but Web Audio's OUTPUT
// channel is muted/misrouted (e.g. iOS ties it to the ringer volume, a
// separate slider from media volume). Hearing neither = the context itself
// is dead. The diag line reports whether the render clock even advances.
let diagEl = null, diagDest = null;

function audioTestBeep(via) {
  const a = ac(); resumeCtx(true);
  let dest = a.destination;
  if (via === 'element') {
    // Built fresh every beep: a carrier cached across a background is dead for
    // the same reason the real SFX route is, which would report a false
    // "element path broken too".
    if (diagEl) { try { diagEl.pause(); } catch {} diagEl.srcObject = null; }
    diagDest = a.createMediaStreamDestination();
    diagEl = document.createElement('audio');
    diagEl.setAttribute('playsinline', '');
    diagEl.srcObject = diagDest.stream;
    diagEl.play().catch(() => {});   // inside the tap gesture — autoplay-safe
    dest = diagDest;
  }
  const t = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(via === 'element' ? 440 : 660, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(g).connect(dest); o.start(t); o.stop(t + 0.55);
}

function audioDiag(cb) {
  const a = actx;
  if (!a) { cb('no AudioContext yet - tap the table once, then reopen'); return; }
  const t0 = a.currentTime;
  setTimeout(() => {
    const tr = sfxEl && sfxEl.srcObject && sfxEl.srcObject.getAudioTracks()[0];
    cb('state:' + a.state +
       ' rate:' + a.sampleRate +
       ' clock:' + (a.currentTime > t0 ? 'ok' : 'STALLED') +
       ' out:' + (SFX_VIA_ELEMENT ? 'element' + (sfxEl && !sfxEl.paused ? '(playing)' : '(PAUSED)') : 'direct') +
       // track tells apart "carrier looks fine" from the silent-killer case:
       // element playing, stream ended (see rebuildSfxRoute).
       ' track:' + (tr ? tr.readyState + (tr.muted ? '/muted' : '') : 'none') +
       ' stale:' + sfxStale + ' reset:' + needHardReset +
       ' sfxMuted:' + muted + ' musicOn:' + musicOn);
  }, 300);
}
