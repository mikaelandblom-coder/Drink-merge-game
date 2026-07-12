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

  document.getElementById('finalScore').innerHTML =
    `${banner}
     <div class="final-coins">You earned <strong>${score.toLocaleString()}</strong> coins</div>
     ${scores.length ? `<div class="score-list"><div class="score-list-title">Top scores</div>${rowsHtml}</div>` : ''}`;

  document.getElementById('over-peek').style.display = 'none';
  document.getElementById('over').style.display = 'flex';
}

function triggerShake() {
  const stage = document.getElementById('stage');
  stage.classList.remove('shake');
  void stage.offsetWidth;
  stage.classList.add('shake');
}
