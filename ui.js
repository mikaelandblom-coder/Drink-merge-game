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
    aiming = true;
    updateAim(ptr(e, canvas), state.nextTier);
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
  document.getElementById('mute').onclick     = e => toggleMute(e.target);
  document.getElementById('musicBtn').onclick = e => toggleMusic(e.target);

  document.getElementById('again').onclick = () => {
    document.getElementById('over').style.display = 'none';
    resetState();
  };

  document.getElementById('menu').onclick = () => {
    document.getElementById('over').style.display = 'none';
    returnToMenu();
  };

  const confirmOverlay = document.getElementById('confirm-menu');
  document.getElementById('menuBtn').onclick = () => {
    confirmOverlay.style.display = 'flex';
  };
  document.getElementById('confirm-yes').onclick = () => {
    confirmOverlay.style.display = 'none';
    returnToMenu();
  };
  document.getElementById('confirm-no').onclick = () => {
    confirmOverlay.style.display = 'none';
  };
}

function showGameOver(state, mapId) {
  const result = saveScore(mapId, state.coinCount);
  const scores = getScores(mapId);

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
    `<div class="final-coins">You earned <strong>${state.coinCount.toLocaleString()}</strong> coins</div>
     ${scores.length ? `<div class="score-list"><div class="score-list-title">Top scores</div>${rowsHtml}</div>` : ''}`;

  document.getElementById('over').style.display = 'flex';
}

function triggerShake() {
  const stage = document.getElementById('stage');
  stage.classList.remove('shake');
  void stage.offsetWidth;
  stage.classList.add('shake');
}
