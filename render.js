// All canvas drawing. Depends on: ctx, W, H, ITEMS, persp, ACTIVE_MAP.

const COIN_IMG = new Image(); COIN_IMG.src = 'assets/images/coin.png';
const BAG_IMG  = new Image(); BAG_IMG.src  = 'assets/images/moneybag.png';

// The map background lives in a DOM layer (#stage-bg) UNDER a transparent
// canvas, not on the canvas itself: the compositor rasters the image once and
// caches it, so the render loop never touches those ~2.7M pixels again — it
// just clears and draws the dynamic content. (Previously the background was
// blitted full-frame every frame, the single largest per-frame pixel cost.)
function loadMapAssets(map, bgSrc) {
  // bgSrc lets startGame pick a size variant (map.sizes); falls back to map.bg.
  // background-size 100% 100% matches the old drawImage(0,0,W,H) stretch.
  document.getElementById('stage-bg').style.backgroundImage =
    `url('${bgSrc || map.bg}')`;
  // Coin & bag art are shared by default; a map may override either with its own
  // (e.g. Melody Lane's note-coin + instrument-case bag). Falls back to shared.
  COIN_IMG.src = map.coin || 'assets/images/coin.png';
  BAG_IMG.src  = map.bag  || 'assets/images/moneybag.png';
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

// The circular drink shadow is the same radial gradient for every item — only
// its radius differs. Creating a gradient per drink per frame is a canvas slow
// path (30 gradient rasterizations/frame on a full board), so render it once
// into a sprite and blit it scaled instead. 256px is plenty: it's a soft blur,
// so upscaling to the largest tiers is invisible.
// Downward shadow nudge as a fraction of physR — makes the shadow peek out
// under the item so it reads as resting on top of it (applied identically to
// circle and capsule shadows in drawDrink).
const SHADOW_DROP = 0.40;

const SHADOW_SPRITE = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0,    'rgba(28,15,4,.36)');
  g.addColorStop(0.72, 'rgba(28,15,4,.20)');
  g.addColorStop(1,    'rgba(28,15,4,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  return cv;
})();

// Capsule items get the SAME shadow profile as circles (0→.36, .72→.20, 1→0),
// extruded along the stadium's long axis instead of a hard-edged flat fill —
// so shadows read identically across maps. Baked once per item on first draw
// (per-pixel distance-to-segment; canvas gradients can't do stadium falloff)
// and blitted scaled every frame, same perf model as SHADOW_SPRITE.
function makeCapsuleShadowSprite(hw, hh) {
  const rad = Math.min(hw, hh);          // stadium cap radius
  const SS  = 64 / rad;                  // short half-extent → 64px
  const w = Math.ceil(hw * 2 * SS), h = Math.ceil(hh * 2 * SS);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  const img = c.createImageData(w, h);
  const horiz = hw >= hh;
  const halfLen = Math.abs(hw - hh) * SS, radPx = rad * SS;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2;
    const ax = horiz ? Math.max(Math.abs(px) - halfLen, 0) : Math.abs(px);
    const ay = horiz ? Math.abs(py) : Math.max(Math.abs(py) - halfLen, 0);
    const t = Math.hypot(ax, ay) / radPx;
    const a = t >= 1 ? 0
            : t <= 0.72 ? 0.36 - 0.16 * (t / 0.72)
            : 0.20 * (1 - (t - 0.72) / 0.28);
    const i = (y * w + x) * 4;
    img.data[i] = 28; img.data[i + 1] = 15; img.data[i + 2] = 4;
    img.data[i + 3] = Math.round(a * 255);
  }
  c.putImageData(img, 0, 0);
  return cv;
}

// item is the full item object (from ITEMS or RECEIPT_ITEMS) — bodies carry
// theirs on plugin.item, so drinks and Happy Hour receipts share this path.
function drawDrink(sx, sy, item, scale, wobble) {
  const r = item.r * scale;
  ctx.save(); ctx.translate(sx, sy);
  ctx.rotate(Math.sin(wobble) * 0.02);

  // Shadow drawn ON the collision circle (origin = body centre here), sized to
  // physR — so it reads as grounded at its actual hitbox instead of floating
  // above a detached puddle, and follows any hitbox tuned in the editor.
  // Nudged down a little so it peeks out beneath the item (light-from-above
  // grounding cue); same physR fraction for circles and capsules so every map
  // gets the identical treatment.
  const pr = item.physR * scale;
  ctx.save();
  ctx.translate(0, pr * SHADOW_DROP);
  ctx.scale(1, 0.82);
  if (item.cap) {
    // Stadium shadow matching the elongated (capsule) hitbox, orientation-aware
    // and rotated to the capsule's fixed authored angle. Soft sprite baked on
    // first use — same falloff as SHADOW_SPRITE so all maps' shadows match.
    const hw = item.cap.hw * scale, hh = item.cap.hh * scale;
    ctx.rotate(item.cap.rot);
    const spr = item.cap.shadow ||
      (item.cap.shadow = makeCapsuleShadowSprite(item.cap.hw, item.cap.hh));
    ctx.drawImage(spr, -hw, -hh, hw * 2, hh * 2);
  } else {
    ctx.drawImage(SHADOW_SPRITE, -pr, -pr, pr * 2, pr * 2);
  }
  ctx.restore();

  // The collision circle may be offset from the sprite anchor (set in the
  // hitbox editor); the body IS the circle, so shift the art the other way.
  ctx.translate(-item.hbOffX * r, -item.hbOffY * r);

  if (item.img.complete && item.img.naturalWidth) {
    // vis (default 1) scales the drawn sprite only; r*0.75-dispH keeps the sprite
    // BOTTOM at ~0.75r so it stays grounded on the shadow (identical to the old
    // placement when vis===1, so other maps are unchanged).
    const dispH = r * 2.4 * (item.vis || 1);
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
  const qItem = ITEMS[queuedTier], qi = qItem.img;
  if (qi.complete && qi.naturalWidth) {
    // apply the item's vis scale, then shrink to fit inside the bubble so wide
    // shapes (e.g. the harmonica) don't overflow it
    let ph = 48 * (qItem.vis || 1), pw = ph * (qi.naturalWidth / qi.naturalHeight);
    const fit = (nb.r * 1.7) / Math.max(pw, ph);
    if (fit < 1) { pw *= fit; ph *= fit; }
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

// ---------- Happy Hour: customers behind the horizon ----------
// One shared cast for every map (like the default coin/bag art). Sprites are
// preloaded once here; game.js picks a random art index per customer.
const CUSTOMER_IMGS = [
  'customer-granny',  'customer-girl',      'customer-sailor',
  'customer-student', 'customer-artist',    'customer-businessman',
  'customer-surfer',  'customer-professor', 'customer-tourist',
].map(n => { const i = new Image(); i.src = 'assets/images/' + n + '.png'; return i; });

// Layout is proportional to the per-map HORIZON so customers always fit in the
// strip behind the line regardless of map framing. Shared by drawCustomers and
// the pointerdown hit-test in ui.js (customerFrameHit) so taps land exactly on
// what's drawn.
function customerLayout(slot) {
  // Slot spacing/sizing leaves the top HUD corners clear: the coin pill on the
  // left and the NEXT preview on the right both sit above/outside the bubbles.
  const cx = W * (0.24 + 0.26 * slot);       // three slots across the horizon strip
  const ch = HORIZON * 0.46;                 // customer sprite height
  const fs = Math.min(44, HORIZON * 0.26);   // order-frame (speech bubble) size
  const cBottom = HORIZON + 2;
  return { cx, ch, cBottom,
           frame: { x: cx - fs / 2, y: cBottom - ch - fs - 6, w: fs, h: fs } };
}

// Returns the customer whose order frame contains the point (canvas coords),
// or null. Ignores customers already walking out.
function customerFrameHit(customers, p) {
  for (const c of customers) {
    if (c.leaveAt) continue;
    const f = customerLayout(c.slot).frame;
    // A little slop around the bubble so finger taps don't need to be exact.
    const pad = 6;
    if (p.x >= f.x - pad && p.x <= f.x + f.w + pad &&
        p.y >= f.y - pad && p.y <= f.y + f.h + pad) return c;
  }
  return null;
}

function drawCustomers(customers, wob) {
  const now = performance.now();
  for (const c of customers) {
    const L = customerLayout(c.slot);
    // Walk-in: fade + drop into place. Walk-out (after serving): fade + rise.
    const tIn  = Math.min(1, (now - c.bornAt) / 400);
    const easeIn = 1 - (1 - tIn) * (1 - tIn);
    let alpha = easeIn, dy = (1 - easeIn) * -18;
    if (c.leaveAt) {
      const tOut = Math.min(1, (now - c.leaveAt) / 400);
      alpha = 1 - tOut; dy = -14 * tOut;
    }
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha;

    const img = CUSTOMER_IMGS[c.art];
    if (img.complete && img.naturalWidth) {
      const h = L.ch, w = h * (img.naturalWidth / img.naturalHeight);
      ctx.drawImage(img, L.cx - w / 2, L.cBottom - h + dy, w, h);
    }

    // Order bubble: same parchment style as the NEXT preview; green when the
    // ordered tier is on the field (tap to serve). The pulse is a plain alpha
    // wave — no shadowBlur in the frame loop (heat).
    const f = L.frame;
    const avail = !c.leaveAt && orderAvailable(c.tier);
    ctx.fillStyle = avail ? 'rgba(230,255,238,.95)' : 'rgba(255,243,224,.92)';
    ctx.beginPath(); ctx.roundRect(f.x, f.y + dy, f.w, f.h, 9); ctx.fill();
    if (avail) {
      ctx.strokeStyle = 'rgba(46,190,100,' + (0.75 + 0.25 * Math.sin(wob * 3)) + ')';
      ctx.lineWidth = 3.5;
    } else {
      ctx.strokeStyle = '#c89b5a';
      ctx.lineWidth = 2.5;
    }
    ctx.beginPath(); ctx.roundRect(f.x, f.y + dy, f.w, f.h, 9); ctx.stroke();
    // Bubble tail pointing at the customer's head.
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(L.cx - 5, f.y + f.h + dy);
    ctx.lineTo(L.cx + 5, f.y + f.h + dy);
    ctx.lineTo(L.cx, f.y + f.h + 6 + dy);
    ctx.closePath(); ctx.fill();

    // The ordered drink, fitted inside the bubble (vis-aware, like the NEXT
    // preview, so wide sprites don't overflow).
    const it = ITEMS[c.tier], oi = it.img;
    if (oi.complete && oi.naturalWidth) {
      let ph = f.h * 0.78 * (it.vis || 1), pw = ph * (oi.naturalWidth / oi.naturalHeight);
      const fit = (f.w * 0.82) / Math.max(pw, ph);
      if (fit < 1) { pw *= fit; ph *= fit; }
      ctx.drawImage(oi, f.x + f.w / 2 - pw / 2, f.y + f.h / 2 - ph / 2 + dy, pw, ph);
    }
    ctx.globalAlpha = 1;
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
// The glow (shadowBlur) is a per-draw gaussian blur — the most expensive canvas
// operation — and the text never changes after spawn. So render each pop ONCE
// into its own small canvas here, and the per-frame draw is a plain scaled
// blit. Supersampled 3x so the late-life scale-up (~1.55x) plus the backing
// resolution (~3.2x world units) stays crisp.
const POP_SS  = 3;
const POP_PAD = 22;  // world px of headroom for the 18px glow + 4px stroke

function spawnTextPop(x, y, text, color, pops) {
  const cv = document.createElement('canvas');
  const c  = cv.getContext('2d');
  c.font = 'bold ' + 22 * POP_SS + 'px Georgia';
  const tw = c.measureText(text).width / POP_SS;
  cv.width  = Math.ceil((tw + POP_PAD * 2) * POP_SS);
  cv.height = Math.ceil((22 + POP_PAD * 2) * POP_SS);
  c.font = 'bold ' + 22 * POP_SS + 'px Georgia';  // canvas resize reset the ctx
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.translate(cv.width / 2, cv.height / 2);
  c.shadowColor = color; c.shadowBlur = 18 * POP_SS;
  c.lineWidth = 4 * POP_SS; c.strokeStyle = 'rgba(18,10,28,.85)';
  c.strokeText(text, 0, 0);
  c.fillStyle = color;
  c.fillText(text, 0, 0);
  pops.push({ x, y, img: cv, w: cv.width / POP_SS, h: cv.height / POP_SS, life: 1, vy: -0.7 });
}

function drawTextPops(pops, dt) {
  for (const p of pops) {
    p.y  += p.vy * dt;
    p.vy *= Math.pow(0.94, dt);      // ease the rise to a stop
    p.life -= 0.016 * dt;
    const alpha = Math.max(0, Math.min(1, p.life * 1.5));
    const pop   = p.life > 0.8 ? (1 - p.life) * 5 : 1;   // quick scale-in at spawn
    const scale = (0.7 + pop * 0.5) + (1 - p.life) * 0.35;
    ctx.globalAlpha = alpha;
    const w = p.w * scale, h = p.h * scale;
    ctx.drawImage(p.img, p.x - w / 2, p.y - h / 2, w, h);
  }
  ctx.globalAlpha = 1;
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
