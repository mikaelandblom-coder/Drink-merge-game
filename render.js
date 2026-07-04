// All canvas drawing. Depends on: ctx, W, H, ITEMS, persp, ACTIVE_MAP.

const COIN_IMG = new Image(); COIN_IMG.src = 'assets/images/coin.png';
const BAG_IMG  = new Image(); BAG_IMG.src  = 'assets/images/moneybag.png';
const bgImg    = new Image();

// The background never changes during play, but it's a large source image.
// Rescaling it every frame with high-quality smoothing is a big, needless GPU
// cost (a major heat source on mobile). Instead we pre-scale it once into an
// offscreen canvas at the exact backing resolution, then blit that 1:1 each
// frame — no per-frame resampling.
const bgCanvas = document.createElement('canvas');
const bgCtx    = bgCanvas.getContext('2d');
let bgCacheReady = false;

function rebuildBgCache() {
  if (!(bgImg.complete && bgImg.naturalWidth) || !canvas.width) { bgCacheReady = false; return; }
  bgCanvas.width  = canvas.width;
  bgCanvas.height = canvas.height;
  bgCtx.imageSmoothingEnabled = true;
  bgCtx.imageSmoothingQuality = 'high';
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  bgCtx.drawImage(bgImg, 0, 0, bgCanvas.width, bgCanvas.height);
  bgCacheReady = true;
}
bgImg.onload = rebuildBgCache;

function loadMapAssets(map) {
  bgImg.src = map.bg;  // called once from game.js after DOM is ready
  if (bgImg.complete && bgImg.naturalWidth) rebuildBgCache();  // already cached by browser
}

function drawBackground() {
  if (bgCacheReady) {
    // bgCanvas is already backing-sized, so drawing it to the world rect under
    // the active transform maps it 1:1 to device pixels — a plain blit with no
    // resampling (and no per-frame rescale of the large source image).
    ctx.drawImage(bgCanvas, 0, 0, W, H);
  } else if (bgImg.complete && bgImg.naturalWidth) {
    ctx.drawImage(bgImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#7a4d26'; ctx.fillRect(0, 0, W, H);
  }
}

function drawDangerLine(dangerWY) {
  const dl = persp(0, dangerWY), dr = persp(W, dangerWY);
  ctx.setLineDash([8, 9]);
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(dl.x, dl.y); ctx.lineTo(dr.x, dr.y); ctx.stroke();
  ctx.setLineDash([]);
}

function drawAimLine(aiming, gameOver, launchScreen, aimX, aimY) {
  if (!aiming || gameOver) return;
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(launchScreen.x, launchScreen.y); ctx.lineTo(aimX, aimY); ctx.stroke();
  ctx.beginPath(); ctx.arc(aimX, aimY, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill();
}

function drawDrink(sx, sy, tier, scale, wobble) {
  const item = ITEMS[tier];
  const r = item.r * scale;
  ctx.save(); ctx.translate(sx, sy);
  ctx.rotate(Math.sin(wobble) * 0.02);

  // shadow
  ctx.save();
  ctx.translate(0, r * 0.68); ctx.scale(1, 0.28);
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.72);
  sh.addColorStop(0, 'rgba(60,30,5,.22)');
  sh.addColorStop(0.7, 'rgba(60,30,5,.10)');
  sh.addColorStop(1, 'rgba(60,30,5,0)');
  ctx.fillStyle = sh;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (item.img.complete && item.img.naturalWidth) {
    const dispH = r * 2.4;
    const dispW = dispH * (item.img.naturalWidth / item.img.naturalHeight);
    ctx.drawImage(item.img, -dispW / 2, r * 0.75 - dispH, dispW, dispH);
  } else {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = item.liq; ctx.fill();
  }
  ctx.restore();
}

function drawNextPreview(queuedTier) {
  const nb = { x: W - 46, y: 52, r: 34 };
  ctx.fillStyle = 'rgba(255,243,224,.92)';
  ctx.beginPath(); ctx.arc(nb.x, nb.y, nb.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c89b5a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(nb.x, nb.y, nb.r, 0, Math.PI * 2); ctx.stroke();
  const qi = ITEMS[queuedTier].img;
  if (qi.complete && qi.naturalWidth) {
    const ph = 48, pw = ph * (qi.naturalWidth / qi.naturalHeight);
    ctx.drawImage(qi, nb.x - pw / 2, nb.y - ph / 2, pw, ph);
  }
  ctx.fillStyle = '#fff3e0'; ctx.font = 'bold 12px Georgia';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.strokeStyle = 'rgba(20,12,6,.7)'; ctx.lineWidth = 3;
  ctx.strokeText('NEXT', nb.x, nb.y + nb.r + 5);
  ctx.fillText('NEXT', nb.x, nb.y + nb.r + 5);
}

function drawParticles(particles, dt) {
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.12 * dt; p.life -= 0.03 * dt;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.01, p.size * p.life), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function burst(x, y, color, r, particles) {
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 1, color, size: 2 + Math.random() * r * 0.12 });
  }
}

// ---------- debug: hitbox overlay ----------
// Draws every physics body's actual collision shape, projected through persp()
// so it aligns with the rendered scene. Static walls in magenta, item bodies in
// cyan. Toggle with the 'h' key or ?hitbox in the URL.
function drawHitboxes() {
  const bodies = Matter.Composite.allBodies(engine.world);
  ctx.save();
  ctx.lineWidth = 1.5;
  for (const b of bodies) {
    const wall = b.isStatic;
    ctx.strokeStyle = wall ? 'rgba(255,60,220,.95)' : 'rgba(70,220,255,.95)';
    ctx.fillStyle   = wall ? 'rgba(255,60,220,.16)' : 'rgba(70,220,255,.13)';
    ctx.beginPath();
    b.vertices.forEach((v, i) => {
      const p = persp(v.x, v.y);
      if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- coins ----------
const BAG_POS = { x: 40, y: 40 };
let coinPop = 0;

function spawnCoins(x, y, n, coins, stagger = 0.10) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = 14 + Math.random() * 30;
    coins.push({
      sx: x + Math.cos(a) * d,       sy: y + Math.sin(a) * d,
      cx: x + Math.cos(a) * d * 1.8, cy: y + Math.sin(a) * d * 1.8 - 70,
      t: -(i * stagger),
      spin: Math.random() * 6,
    });
  }
}

// ---------- floating combo text ----------
function spawnTextPop(x, y, text, color, pops) {
  pops.push({ x, y, text, color, life: 1, vy: -0.7 });
}

function drawTextPops(pops, dt) {
  for (const p of pops) {
    p.y  += p.vy * dt;
    p.vy *= Math.pow(0.94, dt);      // ease the rise to a stop
    p.life -= 0.016 * dt;
    const alpha = Math.max(0, Math.min(1, p.life * 1.5));
    const pop   = p.life > 0.8 ? (1 - p.life) * 5 : 1;   // quick scale-in at spawn
    const scale = (0.7 + pop * 0.5) + (1 - p.life) * 0.35;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale);
    ctx.font = 'bold 22px Georgia';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = p.color; ctx.shadowBlur = 18;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(18,10,28,.85)';
    ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
}

function updateCoins(coins, dt, onCoinLand) {
  for (const c of coins) {
    c.t += 0.010 * dt;
    if (c.t < 0) continue;
    if (c.t >= 1) { coinPop = 0.35; onCoinLand(); }
  }
  return coins.filter(c => c.t < 1);
}

function drawCoin(x, y, r, spin) {
  const sq = Math.max(0.15, Math.abs(Math.cos(spin)));
  ctx.save(); ctx.translate(x, y); ctx.scale(sq, 1);
  const d = r * 2.2;
  if (COIN_IMG.complete && COIN_IMG.naturalWidth) {
    ctx.drawImage(COIN_IMG, -d / 2, -d / 2, d, d);
  } else {
    ctx.fillStyle = '#ffc83d'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawCoins(coins) {
  for (const c of coins) {
    if (c.t < 0) continue;
    const t = c.t, u = 1 - t;
    const x = u * u * c.sx + 2 * u * t * c.cx + t * t * BAG_POS.x;
    const y = u * u * c.sy + 2 * u * t * c.cy + t * t * (BAG_POS.y + 8);
    drawCoin(x, y, 11, c.spin + t * 5);
  }
}

function drawBag(coinCount, dt) {
  coinPop *= Math.pow(0.85, dt);
  const s2 = 1 + coinPop;
  const d = 64;
  ctx.save(); ctx.translate(BAG_POS.x, BAG_POS.y); ctx.scale(s2, s2);
  if (BAG_IMG.complete && BAG_IMG.naturalWidth) {
    ctx.drawImage(BAG_IMG, -d / 2, -d / 2 + 6, d, d * (BAG_IMG.naturalHeight / BAG_IMG.naturalWidth));
  } else {
    ctx.fillStyle = '#8a5a2e'; ctx.beginPath(); ctx.arc(0, 4, 18, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(20,12,6,.55)';
  ctx.beginPath(); ctx.roundRect(BAG_POS.x + 24, BAG_POS.y - 12, 64, 24, 12); ctx.fill();
  ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 15px Georgia';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(coinCount, BAG_POS.x + 34, BAG_POS.y + 1);
}
