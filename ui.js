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

// ---------- rapid fire: the self-firing launcher ----------
// The cannon CHASES the finger, and the residual offset between the two IS the
// shot angle. That is not a new mechanic — it is the aim model this game has
// always had, made explicit and continuous. updateAim() above lerps LAUNCH
// toward the finger at 0.35/frame and then fires along (finger - LAUNCH), so
// classic play already aims by releasing during the catch-up transient. Rapid
// simply never stops, and the release no longer fires.
//
// One rule gives all three behaviours the mode needs:
//   moving fast   -> the carriage lags behind the finger -> a tilted shot
//   held still    -> it catches up, the offset decays    -> straight up
//   pushed to the -> the carriage clamps at the table edge while the finger
//   table edge       does not, so the offset PERSISTS -> a held angle, exactly
//                    where a player most wants one (firing into the far corner)
//
// That third case is why pointer capture matters below: the finger has to be
// able to travel outside the canvas, or edge tilt caps at the launcher's own
// margin and the one place you need a sustained angle is the one place you
// cannot get one.
const RF_ACCEL       = 0.028;  // px/frame^2 per px of offset (spring to finger)
const RF_FRICTION    = 0.86;   // per-frame decay -> ~14px/frame carriage top speed
const RF_TILT_MAX    = 0.70;   // rad (~40 deg) from vertical — the hard bound
const RF_TILT_PER_PX = 0.010;  // rad of tilt per px of finger-to-cannon offset
const RF_TILT_LERP   = 0.22;   // per-frame easing toward the offset's tilt
const RF_FINGER_MAX  = 90;     // px the finger may track beyond the world edge

const CANNON = { vx: 0, tilt: 0, fingerX: W / 2, dragging: false };

function resetCannon() {
  CANNON.vx = 0; CANNON.tilt = 0; CANNON.fingerX = W / 2; CANNON.dragging = false;
}

// Clamped so a pointer flung far off-screen can't wind the spring up absurdly.
// The tilt is bounded either way; this bounds the ACCELERATION too.
function setCannonFinger(x) {
  CANNON.fingerX = Math.max(-RF_FINGER_MAX, Math.min(W + RF_FINGER_MAX, x));
}

function startCannonDrag(p, e, canvas) {
  CANNON.dragging = true;
  setCannonFinger(p.x);
  // See the edge-tilt note above — without capture the finger stops steering
  // the moment it leaves the canvas.
  if (e.pointerId !== undefined && canvas.setPointerCapture) {
    try { canvas.setPointerCapture(e.pointerId); } catch {}
  }
}

// One 60Hz frame of steering. Called from stepPhysics (game.js) so live play
// and TT.step advance the launcher identically — the same contract loop() and
// test mode already share for the physics itself.
// The carriage's edge limit must NOT depend on the tier currently loaded, or it
// would twitch sideways every time the queue deals a different-sized item —
// which in rapid is every shot, with the carriage often parked against an edge.
// Pinning it to the widest item the mode can deal keeps the reachable span
// constant for a whole run. (Classic's updateAim keeps its per-tier margin: it
// only matters while a finger is down, and it is verified unchanged.)
function cannonMargin() {
  let r = LAUNCHER_HALF_W;   // the cradle is wider than anything it can hold
  for (let t = 0; t < dropMax(); t++) r = Math.max(r, ITEMS[t].physR);
  return r + 14;
}

function updateCannon() {
  const margin = cannonMargin();
  if (CANNON.dragging) CANNON.vx += (CANNON.fingerX - LAUNCH.x) * RF_ACCEL;
  CANNON.vx *= RF_FRICTION;   // released, the carriage GLIDES to a stop
  LAUNCH.x  += CANNON.vx;
  // The table edge stops the carriage dead. The finger may keep going, and the
  // offset that leaves behind is what holds an angle there.
  if (LAUNCH.x < margin)     { LAUNCH.x = margin;     if (CANNON.vx < 0) CANNON.vx = 0; }
  if (LAUNCH.x > W - margin) { LAUNCH.x = W - margin; if (CANNON.vx > 0) CANNON.vx = 0; }
  // Not dragging -> no offset -> the tilt eases back to vertical rather than
  // snapping, so a flick's angle outlives the flick by a beat or so.
  const off  = CANNON.dragging ? CANNON.fingerX - LAUNCH.x : 0;
  const want = Math.max(-RF_TILT_MAX, Math.min(RF_TILT_MAX, off * RF_TILT_PER_PX));
  CANNON.tilt += (want - CANNON.tilt) * RF_TILT_LERP;
}

// Fire along the current tilt. Straight up is tilt 0, and RF_TILT_MAX keeps the
// vertical component at cos(0.70) = 0.76 of the speed — so a rapid shot can
// never be horizontal or backwards however hard the player swipes. (The classic
// path's `dy > -10` guard is unreachable from here; it stays as a backstop.)
function fireCannon() {
  fireShot(state, Math.sin(CANNON.tilt), -Math.cos(CANNON.tilt));
}

// One shot from the launcher, in a given direction. Shared by the classic
// release-to-shoot gesture and by rapid fire's cadence, so the two can never
// disagree about what a shot IS — only about when one happens.
function fireShot(state, dirX, dirY) {
  const len = Math.max(1e-6, Math.hypot(dirX, dirY));
  const d = makeDrink(LAUNCH.x, loadedDrinkWY(state.nextTier), state.nextTier, true);
  const speed = 27;
  Body.setVelocity(d, { x: dirX / len * speed, y: dirY / len * speed });
  BUGLOG.shot(d);   // bug-report ring: shot + the board it flew into
  // Classic: each throw starts a fresh combo chain. Rapid: it must NOT. Shots
  // land every 0.35-2.2s and COMBO_WINDOW is 1.4s, so resetting per throw would
  // stop a chain surviving even ONE shot — the mode's forced combos would be
  // very nearly inert. Letting the 1.4s window alone govern it is what turns
  // the cadence into something that sustains a streak instead of killing it.
  if (!RAPID_FIRE) state.combo = 0;
  shoot();
  recoil = 6;
  if (RAPID_FIRE) {
    // Empty the cradle and let stepPhysics roll the next tier in when the
    // reload lands. Rolling HERE — which the first build did, on the grounds
    // that the cadence is the only rate limit rapid needs — put the next drink
    // in the cradle on the very frame the last one left it, so the shot never
    // appeared to come OUT of the launcher.
    state.canShoot = false;
    state.rfReload = rfReloadMs();
  } else {
    state.canShoot = false;
    setTimeout(() => { rollNext(); state.canShoot = true; }, 500);
  }
}

// A press that STARTED on the coin readout and hasn't travelled far enough to
// be a drag. The score sits in a corner that is also a legal aim direction, so
// the panel is claimed by a tap only: move past the slop and this clears, the
// aim starts from where the finger is, and the shot fires as it always did.
let bagTap = null;
const BAG_TAP_SLOP = 12;   // screen px (world units) before a tap becomes a drag

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
    const inStrip = HAPPY_HOUR && p.y < HORIZON;
    // An order frame is tested BEFORE the coin readout: on a deep-horizon map
    // (Hawaii, Kyoto, Plushie, Farm) the leftmost bubble overlaps the readout's
    // box, and serving the customer is unambiguously what a tap there means.
    if (inStrip) {
      const c = customerFrameHit(state.customers, p);
      if (c) {
        if (orderAvailable(c.tier)) tryServeCustomer(c);
        return;
      }
    }
    // No updateAim here: LAUNCH would visibly slide toward the corner just from
    // touching the score. A drag out of the box picks the aim up on the way —
    // except inside the strip, where nothing may ever start an aim.
    if (bagHit(p)) { bagTap = { x: p.x, y: p.y, strip: inStrip }; return; }
    if (inStrip) return;
    // Rapid: a press steers the carriage, it never arms a shot — the cadence
    // owns firing. Everything above (volume popover, score readout) is
    // deliberately unchanged, so the mode inherits those gestures intact.
    if (RAPID_FIRE) { startCannonDrag(p, e, canvas); return; }
    aiming = true;
    updateAim(p, state.nextTier);
  });

  canvas.addEventListener('pointermove', e => {
    const p = ptr(e, canvas);
    if (bagTap) {
      if (Math.hypot(p.x - bagTap.x, p.y - bagTap.y) < BAG_TAP_SLOP) return;
      // Travelled: this was an aim that started on the readout — unless it
      // started inside the Happy Hour strip, which never yields a shot.
      const strip = bagTap.strip;
      bagTap = null;
      if (strip) return;
      if (RAPID_FIRE) startCannonDrag(p, e, canvas);
      else aiming = true;
    }
    if (RAPID_FIRE) { if (CANNON.dragging) setCannonFinger(p.x); return; }
    if (aiming) updateAim(p, state.nextTier);
  });

  canvas.addEventListener('pointerup', e => {
    if (bagTap) { bagTap = null; showScorePanel(state); return; }
    // Rapid: letting go hands the carriage back to its own momentum (it glides
    // to a stop, the tilt eases to vertical). It does not fire — that is the
    // whole mode.
    if (RAPID_FIRE) { CANNON.dragging = false; return; }
    if (!aiming) return;
    aiming = false;
    if (state.gameOver || !state.canShoot) return;
    const target = unpersp(aimX, aimY);
    const dx = target.x - LAUNCH.x, dy = target.y - LAUNCH.y;
    if (dy > -10) return;
    fireShot(state, dx, dy);
  });

  canvas.addEventListener('pointercancel', () => {
    aiming = false; bagTap = null; CANNON.dragging = false;
  });
}

// ---------- in-game score panel (tap the coin bag) ----------
// Mikael's ask, 2026-08-15: mid-run there was no way to know what score you were
// chasing. The gap itself lives permanently under the coin pill (render.js
// drawBag); this panel is the full board behind a tap on that readout.
//
// The run FREEZES while it is open (setPaused in game.js) — see the comment
// there for why that is not optional.
function showScorePanel(state) {
  const key    = currentScoreKey();
  const scores = getScores(key);
  const best   = scores[0]?.score ?? 0;
  const score  = state.coinCount;
  // Ties rank BELOW the sitting entry, matching how saveScore() sorts a new
  // score in — so the rank shown here is the one this run would actually get.
  const rank   = scores.filter(e => e.score >= score).length + 1;

  // Which board this is. Reuses the menu's own variant labels so the two can't
  // describe the same run differently (welcome.js is loaded by the time any
  // panel can open).
  const variant = mapVariants(ACTIVE_MAP).find(v => v.key === key);
  document.getElementById('sp-variant').textContent =
    ACTIVE_MAP.label + (variant ? ' · ' + variant.label : '');

  const gapEl = document.getElementById('sp-gap');
  if (!best) {
    gapEl.className = '';
    gapEl.textContent = 'No score on this board yet — whatever you bank sets the record.';
  } else if (score > best) {
    gapEl.className = 'ahead';
    gapEl.innerHTML = `🏆 You're <strong>${fmtScore(score - best)}</strong> past the record`;
  } else {
    gapEl.className = '';
    gapEl.innerHTML = `<strong>${fmtScore(best - score)}</strong> more to beat
      ${fmtScore(best)}`;
  }

  // The live run is shown as a row IN the board, at the place it currently
  // stands — "you'd be 4th" is the thing a bare list can't say. Past the bottom
  // of the board it becomes a footer line instead of silently vanishing.
  const rows = scores.map(e => ({ name: e.name, score: e.score }));
  const onBoard = rank <= SCORE_MAX;
  if (onBoard) rows.splice(rank - 1, 0, { name: 'this run', score, live: true });
  const rowsHtml = rows.slice(0, SCORE_MAX).map((e, i) => `
    <div class="score-row${e.live ? ' this-round' : ''}">
      <span class="sr-rank">${i + 1}</span>
      <span class="sr-name">${e.name}</span>
      <span class="sr-val">${fmtScore(e.score)}</span>
    </div>`).join('');

  document.getElementById('sp-list').innerHTML = rowsHtml;
  document.getElementById('sp-foot').textContent = onBoard
    ? '' : 'This run: ' + fmtScore(score) + ' — not on the board yet';

  setPaused(true);
  document.getElementById('score-panel').style.display = 'flex';
}

// Safe to call at any time — game.js leans on that (backgrounding, startGame).
function hideScorePanel() {
  const el = document.getElementById('score-panel');
  if (el) el.style.display = 'none';
  setPaused(false);
}

function wireHUD(state) {
  // Tap toggles, press-and-hold opens the volume slider (see wireSoundBtn).
  wireSoundBtn('mute', 'sfx');
  wireSoundBtn('musicBtn', 'music');
  // The markup hardcodes the "on" icon, but the VOLUMES are persisted while
  // muted/musicOn are not — so a slider left at 0 last session would otherwise
  // show an "on" button over silence.
  syncSoundBtns();
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

  // Score panel (tap the coin bag). Closing also unfreezes the run, so both
  // routes out go through hideScorePanel — the button and the backdrop, since
  // the panel covers the HUD and there is nothing else to reach.
  const scorePanel = document.getElementById('score-panel');
  document.getElementById('sp-close').onclick = hideScorePanel;
  scorePanel.addEventListener('pointerdown', e => {
    if (e.target === scorePanel) hideScorePanel();
  });

  // The quit confirm FREEZES the run, like the score panel does. It was left
  // running on the grounds that it is "rare or terminal" — but it is neither:
  // it is the only pause this game has, and people use it as one when they need
  // to put the phone down for a moment (Mikael, 2026-08-23). In rapid that
  // reasoning was actively wrong, since the cannon keeps firing on its own and
  // a run would die behind the overlay; in every other mode checkOver's
  // danger-line grace keeps counting just the same.
  const confirmOverlay = document.getElementById('confirm-menu');
  document.getElementById('menuBtn').onclick = () => {
    confirmOverlay.style.display = 'flex';
    setPaused(true);
  };
  document.getElementById('confirm-yes').onclick = () => {
    confirmOverlay.style.display = 'none';
    peek.style.display = 'none';
    // Unfreeze BEFORE leaving: `paused` outliving the run would freeze the next
    // one at birth. (startGame's hideScorePanel() clears it too — belt and
    // braces, same as that path.)
    setPaused(false);
    returnToMenu();
  };
  document.getElementById('confirm-no').onclick = () => {
    confirmOverlay.style.display = 'none';
    setPaused(false);
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
      <span class="nb-sub">You topped the previous best of ${fmtScore(prevBest)}</span>
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
      <span class="sr-val">${fmtScore(e.score)}</span>
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
     <div class="final-coins">You earned <strong>${fmtScore(score)}</strong> coins</div>
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
