// HUD wiring and input handling.
// Depends on: W, H, persp, unpersp, makeDrink, rollNext, ITEMS, audio.js, scores.js

const LAUNCH = { x: W / 2, y: H - 60 };
let aiming = false, aimX = W / 2, aimY = H / 2;
let recoil = 0;

function ptr(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
  return { x: cx * (W / rect.width), y: cy * (H / rect.height) };
}

function updateAim(p, nextTier) {
  const sLaunch = persp(LAUNCH.x, LAUNCH.y);
  aimX = p.x; aimY = Math.min(p.y, sLaunch.y - 30);
  const margin = ITEMS[nextTier].physR + 14;
  LAUNCH.x += (Math.max(margin, Math.min(W - margin, p.x)) - LAUNCH.x) * 0.35;
}

function wireInput(canvas, state) {
  canvas.addEventListener('pointerdown', e => {
    // A tap on the table while a volume slider is open just dismisses it —
    // putting the slider away must never cost a shot.
    if (hideVolPop()) return;
    if (state.gameOver) return;
    initAudio();
    startMusic();
    const p = ptr(e, canvas);
    // Happy Hour: the strip behind the horizon belongs to the customers — a
    // tap there serves a lit order (or does nothing) but NEVER starts an aim,
    // so serving can't accidentally fire a shot. Drags that start on the field
    // and cross the line still aim normally (pointermove is untouched).
    if (HAPPY_HOUR && p.y < HORIZON) {
      const c = customerFrameHit(state.customers, p);
      if (c && orderAvailable(c.tier)) tryServeCustomer(c);
      return;
    }
    aiming = true;
    updateAim(p, state.nextTier);
  });

  canvas.addEventListener('pointermove', e => {
    if (aiming) updateAim(ptr(e, canvas), state.nextTier);
  });

  canvas.addEventListener('pointerup', e => {
    if (!aiming) return;
    aiming = false;
    if (state.gameOver || !state.canShoot) return;
    const target = unpersp(aimX, aimY);
    const dx = target.x - LAUNCH.x, dy = target.y - LAUNCH.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    if (dy > -10) return;
    const d = makeDrink(LAUNCH.x, LAUNCH.y - ITEMS[state.nextTier].physR - 4, state.nextTier, true);
    const speed = 27;
    Body.setVelocity(d, { x: dx / len * speed, y: dy / len * speed });
    BUGLOG.shot(d);   // bug-report ring: shot + the board it flew into
    state.combo = 0;  // each throw starts a fresh combo chain
    shoot();
    recoil = 6;
    state.canShoot = false;
    setTimeout(() => { rollNext(); state.canShoot = true; }, 500);
  });

  canvas.addEventListener('pointercancel', () => { aiming = false; });
}

function wireHUD(state) {
  // Tap toggles, press-and-hold opens the volume slider (see wireSoundBtn).
  wireSoundBtn('mute', 'sfx');
  wireSoundBtn('musicBtn', 'music');
  // currentTarget, not target: clicks can land on the buttons' SVG icons.
  document.getElementById('xrayBtn').onclick  = e => toggleXray(e.currentTarget);

  const over = document.getElementById('over');
  const peek = document.getElementById('over-peek');

  document.getElementById('again').onclick = () => {
    over.style.display = 'none';
    peek.style.display = 'none';
    resetState();
  };

  document.getElementById('menu').onclick = () => {
    over.style.display = 'none';
    peek.style.display = 'none';
    returnToMenu();
  };

  // ✕ hides the results so the final pile can be inspected; the pill restores them.
  document.getElementById('over-close').onclick = () => {
    over.style.display = 'none';
    peek.style.display = 'block';
  };
  peek.onclick = () => {
    peek.style.display = 'none';
    over.style.display = 'flex';
  };

  const confirmOverlay = document.getElementById('confirm-menu');
  document.getElementById('menuBtn').onclick = () => {
    confirmOverlay.style.display = 'flex';
  };
  document.getElementById('confirm-yes').onclick = () => {
    confirmOverlay.style.display = 'none';
    peek.style.display = 'none';
    returnToMenu();
  };
  document.getElementById('confirm-no').onclick = () => {
    confirmOverlay.style.display = 'none';
  };

  // Bug report (🐞): show the MMB1. code for the current run's last shots.
  // Regenerated on every open so it always reflects "just now".
  const bugPanel = document.getElementById('bug-panel');
  const bugCode  = document.getElementById('bug-code');
  const bugStat  = document.getElementById('bug-status');
  const bugDiag = document.getElementById('bug-audio-diag');
  const refreshDiag = () => audioDiag(line => { bugDiag.textContent = line; });
  document.getElementById('bugBtn').onclick = () => {
    bugCode.value = BUGLOG.code();
    bugStat.textContent = '';
    bugPanel.style.display = 'flex';
    refreshDiag();
  };
  document.getElementById('bug-beep1').onclick = () => { audioTestBeep('direct');  refreshDiag(); };
  document.getElementById('bug-beep2').onclick = () => { audioTestBeep('element'); refreshDiag(); };
  // Manual rebuild of the SFX route, for when sound is silent after coming
  // back to a run — no reload, so the run survives. Beeps to confirm.
  document.getElementById('bug-fixsound').onclick = () => {
    repairAudio();
    setTimeout(() => { if (!muted) coinTick(); }, 120);  // audible "it's back"
    refreshDiag();
  };
  document.getElementById('bug-copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(bugCode.value);
      bugStat.textContent = 'Copied! Now paste it in a message to Mikael.';
    } catch {
      // Clipboard API needs a secure context / permission — fall back to
      // selecting the text so a manual copy works (same as backup codes).
      bugCode.focus(); bugCode.select();
      bugStat.textContent = 'Long-press (or Ctrl+C) the selected code to copy it.';
    }
  };
  document.getElementById('bug-close').onclick = () => {
    bugPanel.style.display = 'none';
  };

  document.getElementById('vol-range').addEventListener('input', onVolInput);
  // Anything else the player touches puts the slider away. The canvas is
  // excluded on purpose: its own handler dismisses it (and swallows the tap),
  // and closing from here first would let that same tap fire a shot.
  document.addEventListener('pointerdown', e => {
    if (!volPopOpen()) return;
    if (e.target.closest && e.target.closest('#vol-pop, #mute, #musicBtn, #c')) return;
    hideVolPop();
  }, true);
}

// ---------- volume sliders (press-and-hold a sound HUD button) ----------
// Mai's ask (2026-08-03): she likes the BGM but it drowns the game. A tap on the
// sound / music button still does exactly what it always did — hold one for
// VOL_HOLD_MS and its slider slides out underneath. The levels themselves live
// in audio.js (getVolume/setVolume) and persist in localStorage.
const VOL_HOLD_MS = 380;    // comfortably longer than a deliberate tap
const VOL_IDLE_MS = 3200;   // auto-dismiss, so there is no close button to find
let volKind = null, volBtn = null, volIdleTimer = 0, volAuditionMs = 0;

function volPopOpen() { return !document.getElementById('vol-pop').hidden; }

// Returns whether it actually closed something, so callers can swallow the tap.
function hideVolPop() {
  const pop = document.getElementById('vol-pop');
  if (pop.hidden) return false;
  pop.hidden = true;
  clearTimeout(volIdleTimer); volIdleTimer = 0;
  volKind = null; volBtn = null;
  return true;
}

function volIdleReset() {
  clearTimeout(volIdleTimer);
  volIdleTimer = setTimeout(hideVolPop, VOL_IDLE_MS);
}

function showVolPop(btn, kind) {
  const pop = document.getElementById('vol-pop');
  const range = document.getElementById('vol-range');
  volKind = kind; volBtn = btn;
  document.getElementById('vol-kind').textContent = kind === 'music' ? 'Music' : 'Effects';
  range.value = Math.round(getVolume(kind) * 100);
  setVolPct(+range.value);
  pop.hidden = false;
  // Right-aligned under the HUD row (which sits at right:8px), NOT centred on
  // the button: #stage is sized from its height, so on a narrow screen it
  // overflows the viewport and a centre-anchor would hang off the edge. Sharing
  // the row's alignment makes the slider exactly as reachable as the buttons
  // themselves. Which channel it is comes from the label, not the position.
  const sr = document.getElementById('stage').getBoundingClientRect();
  pop.style.top = (btn.getBoundingClientRect().bottom - sr.top + 8) + 'px';
  // We are inside the hold gesture, so this is the moment the effects slider is
  // allowed to build/repair the AudioContext it needs to audition into.
  if (kind === 'sfx') initAudio();
  volIdleReset();
}

function setVolPct(pct) {
  document.getElementById('vol-pct').textContent = pct + '%';
}

function onVolInput(e) {
  if (!volKind) return;
  const pct = +e.target.value, v = pct / 100;
  setVolume(volKind, v);
  setVolPct(pct);
  // Zero IS off, in both directions — otherwise the icon claims sound is on
  // while nothing can be heard, and the mute button becomes a no-op.
  if (isSoundEnabled(volKind) !== (v > 0)) {
    setSoundEnabled(volKind, v > 0);
    setToggleBtn(volBtn, v > 0);
  }
  // Music auditions itself (it's playing); effects need a sample to judge.
  // impact 6 saturates every collide voice's volume curve, so what she hears is
  // a full-strength hit at the level she just picked.
  if (volKind === 'sfx' && v > 0) {
    const now = performance.now();
    if (now - volAuditionMs > 140) { volAuditionMs = now; clink(6); }
  }
  volIdleReset();
}

function wireSoundBtn(id, kind) {
  const btn = document.getElementById(id);
  let holdTimer = 0, held = false;

  btn.addEventListener('pointerdown', () => {
    held = false;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => { held = true; showVolPop(btn, kind); }, VOL_HOLD_MS);
  });
  const dropHold = () => { clearTimeout(holdTimer); holdTimer = 0; };
  btn.addEventListener('pointerup', dropHold);
  btn.addEventListener('pointerleave', dropHold);
  btn.addEventListener('pointercancel', () => { dropHold(); held = false; });
  // Android pops a context menu on a long press, which would cancel the gesture
  // and land a menu on top of the slider.
  btn.addEventListener('contextmenu', e => e.preventDefault());

  // currentTarget, not target: clicks can land on the buttons' SVG icons.
  btn.onclick = e => {
    if (held) { held = false; return; }   // the hold already opened the slider
    hideVolPop();
    if (kind === 'music') toggleMusic(e.currentTarget); else toggleMute(e.currentTarget);
  };
}

function showGameOver(state, key) {
  const score = state.coinCount;
  const prevBest = getScores(key)[0]?.score ?? 0;   // best on this variant BEFORE this run
  const result = saveScore(key, score);
  const scores = getScores(key);

  // Celebrate topping the board: a beaten record, or the very first score set.
  // A new best gets the fanfare; every other run ends on the soft gameOver()
  // chime instead (never both — they'd clash).
  let banner = '';
  if (score > 0 && score > prevBest && prevBest > 0) {
    banner = `<div class="new-best">🏆 New high score!
      <span class="nb-sub">You topped the previous best of ${prevBest.toLocaleString()}</span>
    </div>`;
    fanfare();
    spawnConfetti(document.getElementById('over'));
  } else {
    if (score > 0 && prevBest === 0 && result.rank === 1) {
      banner = `<div class="new-best subtle">✨ First score on the board!</div>`;
    }
    gameOver();
  }

  const rowsHtml = scores.map((e, i) => {
    const highlight = result.inTop && i === result.rank - 1;
    return `<div class="score-row${highlight ? ' this-round' : ''}">
      <span class="sr-rank">${i + 1}</span>
      <span class="sr-name">${e.name}</span>
      <span class="sr-val">${e.score.toLocaleString()}</span>
      ${highlight ? '<span class="sr-you">you</span>' : ''}
    </div>`;
  }).join('');

  // Quiet XP recap — level-ups already celebrated live on the in-game bar, so
  // this never competes with the new-best fanfare above.
  const xpInfo = Progress.info(ACTIVE_MAP.id);
  const xpLine = state.runXp
    ? `<div class="over-xp">+${state.runXp} XP · Level ${xpInfo.level}
         (${xpInfo.into} / ${xpInfo.need})</div>`
    : '';

  document.getElementById('finalScore').innerHTML =
    `${banner}
     <div class="final-coins">You earned <strong>${score.toLocaleString()}</strong> coins</div>
     ${xpLine}
     ${scores.length ? `<div class="score-list"><div class="score-list-title">Top scores</div>${rowsHtml}</div>` : ''}`;

  document.getElementById('over-peek').style.display = 'none';
  document.getElementById('over').style.display = 'flex';
}

// Confetti rain over the game-over results when a record is beaten — drawn on
// ONE small canvas inside #over, rAF-driven. This is the third rendering of
// this effect, and it exists because iPadOS WebKit repeatedly failed to paint
// the composited versions: CSS keyframes skipped after the game-over stall,
// then WAAPI pieces (70 individually composited 3D layers) blanked out
// all-at-once mid-fall — same family as the XP bar's composited border-image
// bug. A single canvas never touches the compositor's problem paths, and
// positions derive from elapsed TIME, so even a main-thread stall just drops
// frames — the burst can neither vanish nor teleport. One rAF loop for ~5s
// once per game-over is nothing next to the live render loop's budget.
// Everything lives inside #over, so closing the overlay takes it along.
function spawnConfetti(host) {
  const old = document.getElementById('confetti');
  if (old) old.remove();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.id = 'confetti';
  host.appendChild(cv);
  // Size from #stage, NOT from the canvas's own box: we run before
  // showGameOver() flips #over to display:flex, so everything inside the
  // overlay still measures 0×0. #over is inset:0 of #stage — same box.
  const stage = document.getElementById('stage');
  const cw = stage.clientWidth, ch = stage.clientHeight;
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(cw * pr); cv.height = Math.round(ch * pr);
  const c = cv.getContext('2d');
  c.scale(pr, pr);

  const colors = ['#ffd35c', '#ff7ab4', '#7ae0ff', '#9dff8a', '#ffb35c', '#d79aff'];
  const fall = ch + 44;                              // exits the box before it ends
  const pieces = [];
  for (let i = 0; i < 70; i++) {
    pieces.push({
      x: Math.random() * cw, w: 6 + Math.random() * 6, h: 9 + Math.random() * 8,
      color: colors[i % colors.length],
      dx: Math.random() * 140 - 70,                  // sideways drift over the fall
      rz: (Math.random() * 900 - 450) * Math.PI / 180,
      // rotateX tumble is faked with a scaleY flutter — full 3D per-piece
      // layers are exactly what iOS choked on
      flut: (2 + Math.random() * 3) * Math.PI, phase: Math.random() * Math.PI,
      delay: Math.random() * 700, dur: 2200 + Math.random() * 1800,
    });
  }

  const start = performance.now();
  (function frame(now) {
    if (!cv.isConnected) return;                     // overlay closed mid-burst
    const elapsed = now - start;
    c.clearRect(0, 0, cw, ch);
    let live = false;
    for (const p of pieces) {
      const t = (elapsed - p.delay) / p.dur;         // 0..1 along the fall
      if (t >= 1) continue;
      live = true;
      if (t < 0) continue;                           // still waiting above the box
      c.save();
      c.translate(p.x + p.dx * t, -22 + fall * t);
      c.rotate(p.rz * t);
      c.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(p.phase + p.flut * t)));
      c.globalAlpha = 0.95 - 0.1 * t;
      c.fillStyle = p.color;
      c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      c.restore();
    }
    if (live) requestAnimationFrame(frame); else cv.remove();
  })(start);
}

function triggerShake() {
  const stage = document.getElementById('stage');
  stage.classList.remove('shake');
  void stage.offsetWidth;
  stage.classList.add('shake');
}

// ---------- XP bar (progress.js) ----------
// A DOM overlay, not canvas work — the render loop never pays for it.
// Orientation: 'h' = horizontal along the bottom (default — Mikael's pick,
// 2026-07-17), 'v' = slim vertical bar on the left edge; ?xpbar=v to compare.
const XP_BAR_ORIENT = /[?&]xpbar=v\b/.test(location.search) ? 'v' : 'h';

// Called from startGame() once the map (and its HORIZON) is known.
function initXpBar() {
  const bar = document.getElementById('xp-bar');
  bar.className = XP_BAR_ORIENT;
  // Vertical: run from the bottom edge up to the map's horizon, so the bar
  // never reaches into the customers' strip on Happy Hour.
  bar.style.top = XP_BAR_ORIENT === 'v' ? (HORIZON / H * 100) + '%' : '';
  updateXpBar();
}

// Both fill variables in one place: --xp-pct (a length, drives the vertical
// bar's height) and --xp-frac (unitless 0..1, drives the horizontal bar's
// scaleX — transforms can't consume percentages from a custom property).
function setXpFill(pct) {
  const bar = document.getElementById('xp-bar');
  bar.style.setProperty('--xp-pct', pct.toFixed(2) + '%');
  bar.style.setProperty('--xp-frac', (pct / 100).toFixed(4));
}

// Write-only-on-change: this runs on EVERY shot, and even a same-value
// textContent assignment replaces the text node — dirtying the medal / frame
// paint and (on iOS, where purged image decodes redraw late) blinking the art.
function setTextIfChanged(id, text) {
  const el = document.getElementById(id);
  if (el.textContent !== text) el.textContent = text;
}

function updateXpBar() {
  const info = Progress.info(ACTIVE_MAP.id);
  setTextIfChanged('xp-level', String(info.level));
  setTextIfChanged('xp-frac', info.into + ' / ' + info.need);
  setXpFill(info.into / info.need * 100);
}

// 1 XP per shot — called from makeDrink's shot path (game.js), which covers
// both live pointer shots and test-mode TT.shoot.
function xpOnShot(state) {
  state.runXp++;
  const r = Progress.addXp(ACTIVE_MAP.id, 1);
  if (r.leveled) levelUpFx(); else updateXpBar();
}

// Live level-up: fill to the brim, medal pulse + chime, then the liquid
// "drains" (transition suppressed) and starts pouring toward the next level.
function levelUpFx() {
  const fill = document.getElementById('xp-fill');
  const medal = document.getElementById('xp-medal');
  setXpFill(100);
  // The new level shows the moment the medal pulses — the drain to the new
  // remainder follows once the fill-to-the-brim has been seen.
  document.getElementById('xp-level').textContent = Progress.level(ACTIVE_MAP.id);
  medal.classList.remove('pulse');
  void medal.offsetWidth;
  medal.classList.add('pulse');
  levelUp();
  setTimeout(() => {
    fill.style.transition = 'none';
    setXpFill(0);
    void fill.offsetWidth;
    fill.style.transition = '';
    updateXpBar();
  }, 480);
}
