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
    state.combo = 0;  // each throw starts a fresh combo chain
    shoot();
    recoil = 6;
    state.canShoot = false;
    setTimeout(() => { rollNext(); state.canShoot = true; }, 500);
  });

  canvas.addEventListener('pointercancel', () => { aiming = false; });
}

function wireHUD(state) {
  // currentTarget, not target: clicks can land on the buttons' SVG icons.
  document.getElementById('mute').onclick     = e => toggleMute(e.currentTarget);
  document.getElementById('musicBtn').onclick = e => toggleMusic(e.currentTarget);

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
}

function showGameOver(state, key) {
  const score = state.coinCount;
  const prevBest = getScores(key)[0]?.score ?? 0;   // best on this variant BEFORE this run
  const result = saveScore(key, score);
  const scores = getScores(key);

  // Celebrate topping the board: a beaten record, or the very first score set.
  let banner = '';
  if (score > 0 && score > prevBest && prevBest > 0) {
    banner = `<div class="new-best">🏆 New high score!
      <span class="nb-sub">You topped the previous best of ${prevBest.toLocaleString()}</span>
    </div>`;
    fanfare();
    spawnConfetti(document.getElementById('over'));
  } else if (score > 0 && prevBest === 0 && result.rank === 1) {
    banner = `<div class="new-best subtle">✨ First score on the board!</div>`;
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

// Confetti rain over the game-over results when a record is beaten. DOM pieces
// with one-shot transform keyframes — compositor-only work, so the burst never
// touches the render-loop heat budget. Everything lives inside #over, so
// closing/hiding the overlay takes the confetti with it.
function spawnConfetti(host) {
  const old = document.getElementById('confetti');
  if (old) old.remove();
  const box = document.createElement('div');
  box.id = 'confetti';
  const colors = ['#ffd35c', '#ff7ab4', '#7ae0ff', '#9dff8a', '#ffb35c', '#d79aff'];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i');
    p.style.left = (Math.random() * 100) + '%';
    p.style.background = colors[i % colors.length];
    p.style.width  = (6 + Math.random() * 6) + 'px';
    p.style.height = (9 + Math.random() * 8) + 'px';
    p.style.setProperty('--dx', (Math.random() * 140 - 70).toFixed(0) + 'px');
    p.style.setProperty('--rz', (Math.random() * 900 - 450).toFixed(0) + 'deg');
    p.style.setProperty('--rx', (360 + Math.random() * 540).toFixed(0) + 'deg');
    p.style.animationDuration = (2.2 + Math.random() * 1.8).toFixed(2) + 's';
    p.style.animationDelay = (Math.random() * 0.7).toFixed(2) + 's';
    box.appendChild(p);
  }
  host.appendChild(box);
  setTimeout(() => box.remove(), 5200);  // past the longest duration + delay
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

function updateXpBar() {
  const info = Progress.info(ACTIVE_MAP.id);
  document.getElementById('xp-level').textContent = info.level;
  document.getElementById('xp-frac').textContent  = info.into + ' / ' + info.need;
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
