'use strict';
// =====================================================================
//  PIXEL-ART SPRITES (procedural, drawn at native 1px scale)
// =====================================================================
const PAL = {
  skin: '#f2c299', skinD: '#c98f6b', ink: '#141018', white: '#f4f0ea',
  standL: '#d6dae6', standD: '#6b6f80', mic: '#2b2b33', micG: '#a9b0bf'
};
const STAGE_COL = { 1: '#4fe3ff', 2: '#ffa53a', 3: '#ff4f6a' };

// Tinted painter (used for hit-flash)
function TP(ctx, x, y, f, tint) { const p = new Painter(ctx, x, y, f); if (tint) { const r = p.r; p.r = function (a, b, c, d) { r.call(this, a, b, c, d, tint); }; const l = p.line; p.line = function (a, b, c, d, col, th) { l.call(this, a, b, c, d, tint, th); }; } return p; }

// ---------- mic stand ----------
function drawStand(p, gx, gy, th, ltop, lbot) {
  const sx = Math.sin(th), sy = -Math.cos(th);
  const tx = gx + sx * ltop, ty = gy + sy * ltop, bx = gx - sx * lbot, by = gy - sy * lbot;
  p.line(bx, by, tx, ty, PAL.standL);
  // base (tripod foot) perpendicular to pole
  const px = -sy, py = sx;
  p.line(bx - px * 3, by - py * 3, bx + px * 3, by + py * 3, PAL.standD);
  p.px(Math.round(bx), Math.round(by), PAL.standD);
  // mic head
  const mx = Math.round(tx + sx * 1.5), my = Math.round(ty + sy * 1.5);
  p.r(mx - 1, my - 1, 3, 3, PAL.mic); p.px(mx, my - 1, PAL.micG); p.px(mx - 1, my, PAL.micG);
  return { tx: mx, ty: my };
}

// ---------- the lead singer (player) ----------
const SINGER = { hair: '#2a1840', hairH: '#ff3fa4', jacket: '#d8263a', jacketD: '#8e1426', shirt: '#f4f4f4', pants: '#29293f', boot: '#121218', shades: '#0c0c12' };
function drawSinger(ctx, x, y, f, o) {
  const p = TP(ctx, x, y, f, o.tint), C = SINGER, t = o.t || 0;
  if (o.anim === 'dead') return drawSingerDead(p, C);
  let bob = 0, lf = 0, lb = 0, lean = 0, liftF = 0, liftB = 0;
  let th = 0, gx = 7, gy = -11, ltop = 12, lbot = 11, handX = 6, handY = -11, backHand = null, mouth = 0, key = false;
  switch (o.anim) {
    case 'idle': bob = (Math.sin(t * 3.2) > 0.3) ? 1 : 0; break;
    case 'walk': { const fr = o.frame % 4; if (fr === 0) { lf = 2; lb = -2; } else if (fr === 2) { lf = -2; lb = 2; } else { bob = -1; liftB = fr === 1 ? 1 : 0; liftF = fr === 3 ? 1 : 0; } th = 0.12; gy = -12 + bob; break; }
    case 'jump': lf = 2; lb = -1; liftF = 3; liftB = 1; th = 0.35; gy = -13; break;
    case 'fall': lf = 1; lb = -2; liftF = 1; th = -0.2; gy = -13; break;
    case 'land': bob = 2; lf = 2; lb = -2; break;
    case 'attack': {
      th = o.standAngle; ltop = 20; lbot = 3; lean = o.phase === 'swing' ? 1 : o.phase === 'windup' ? -1 : 0;
      gx = 1 + Math.sin(th) * 5; gy = -15 - Math.cos(th) * 5; lf = 2; lb = -2; break;
    }
    case 'hurt': lean = -1; th = -0.5; gy = -12; lf = -1; lb = 1; mouth = 2; break;
    case 'unlock': th = -0.35; gx = -3; gy = -12; key = true; handX = 8; handY = -13; break;
    case 'celebrate': { const j = Math.abs(Math.sin(t * 6)) * 4 | 0; bob = -j; liftF = liftB = j > 1 ? 1 : 0; th = 0.15; gx = 3; gy = -28 - j; ltop = 11; lbot = 10; mouth = 2; break; }
    case 'sing': { th = -0.18; gx = 7; gy = -13; ltop = 9; lbot = 13; mouth = o.mouth || 0; bob = o.beat ? 1 : 0; backHand = o.armUp ? [-6, -24] : [-5, -12]; lf = 1; lb = -2; break; }
  }
  const by = bob;
  // back arm
  const bh = backHand || (o.anim === 'unlock' ? [gx, gy] : [-4 + lean, -10 + by]);
  p.line(-2 + lean, -14 + by, bh[0], bh[1], C.jacketD, 2); p.r(bh[0], bh[1], 2, 2, PAL.skinD);
  // legs
  p.r(-3 + lb, -7 + by - liftB, 3, 5, C.pants); p.r(-3 + lb, -2 + by - liftB, 4, 2, C.boot);
  p.r(0 + lf, -7 + by - liftF, 3, 5, C.pants); p.r(0 + lf, -2 + by - liftF, 4, 2, C.boot);
  // torso
  const ty = -16 + by;
  p.r(-4 + lean, ty, 8, 9, C.jacket); p.r(-4 + lean, ty + 7, 8, 2, C.jacketD);
  p.r(0 + lean, ty + 1, 3, 6, C.shirt); p.px(1 + lean, ty + 3, '#ffcc33'); // star badge
  p.r(-4 + lean, ty, 2, 9, C.jacketD);
  // head
  const hy = -24 + by;
  p.r(-3 + lean, hy, 7, 8, PAL.skin); p.r(-3 + lean, hy + 6, 7, 2, PAL.skinD);
  p.r(0 + lean, hy + 3, 4, 2, C.shades); p.px(3 + lean, hy + 3, '#7ff');
  if (mouth) p.r(2 + lean, hy + 6, 2, mouth === 2 ? 2 : 1, '#5a1020');
  // spiky hair
  p.r(-4 + lean, hy - 1, 8, 3, C.hair); p.r(-4 + lean, hy + 2, 2, 4, C.hair);
  p.r(-3 + lean, hy - 3, 2, 2, C.hair); p.r(0 + lean, hy - 4, 2, 3, C.hair); p.r(3 + lean, hy - 2, 2, 2, C.hair);
  p.r(-5 + lean, hy - 1, 1, 2, C.hair); p.px(1 + lean, hy - 3, C.hairH); p.px(0 + lean, hy - 1, C.hairH); p.px(-2 + lean, hy, C.hairH);
  // mic stand + front arm
  if (o.anim === 'unlock') {
    drawStand(p, gx, gy, th, ltop, lbot);
    p.line(1 + lean, -14 + by, handX, handY, C.jacket, 2); p.r(handX, handY, 2, 2, PAL.skin);
    if (key) drawKeyShape(p, handX + 2, handY - 1, o.keyCol || '#ffd34f');
  } else {
    drawStand(p, gx, gy, th, ltop, lbot);
    p.line(1 + lean, -14 + by, Math.round(gx), Math.round(gy), C.jacket, 2); p.r(Math.round(gx) - 1, Math.round(gy) - 1, 2, 2, PAL.skin);
  }
}
function drawSingerDead(p, C) {
  p.r(-10, -4, 6, 3, C.pants); p.r(-12, -4, 2, 3, C.boot);
  p.r(-4, -5, 9, 5, C.jacket); p.r(-1, -4, 3, 3, C.shirt);
  p.r(5, -6, 7, 6, PAL.skin); p.r(9, -5, 2, 2, C.shades); p.r(11, -7, 2, 7, C.hair); p.r(5, -7, 6, 2, C.hair);
  p.line(-6, -1, 14, -1, PAL.standL); p.r(15, -2, 3, 3, PAL.mic);
}
function drawKeyShape(p, x, y, col) {
  p.r(x, y, 4, 4, col);
  p.r(x + 1, y + 1, 2, 2, '#3a2a10');
  p.r(x + 4, y + 1, 5, 2, col); p.r(x + 7, y + 3, 1, 2, col); p.r(x + 5, y + 3, 1, 1, col);
  p.px(x, y, '#fff8');
}

// ---------- band members ----------
const BAND = {
  keys: { name: 'MINA', role: 'KEYS', hair: '#4a7dff', hairStyle: 'bob', top: '#f2f2f2', top2: '#b9c4d6', pants: '#2c3554', skin: '#ffd3b0', inst: 'keytar' },
  volt: { name: 'VOLT', role: 'ELECTRONICS', hair: '#39ff9c', hairStyle: 'mohawk', top: '#2b2b40', top2: '#39ff9c', pants: '#1b1b28', skin: '#c78c5e', inst: 'sampler', phones: true },
  bass: { name: 'DEX', role: 'BASS', hair: '#e0a030', hairStyle: 'long', top: '#5b3a8c', top2: '#3d2560', pants: '#26222e', skin: '#8d5a3b', inst: 'bass' },
  riff: { name: 'RIFF', role: 'GUITAR', hair: '#ff6b2e', hairStyle: 'spike', top: '#1f6f50', top2: '#134733', pants: '#2b2b2b', skin: '#f0c090', inst: 'guitar' },
  drums: { name: 'BO', role: 'DRUMS', hair: '#e8e8e8', hairStyle: 'bandana', top: '#b31b1b', top2: '#7a1010', pants: '#202030', skin: '#e9b98f', inst: 'sticks' }
};
const BAND_ORDER = ['keys', 'volt', 'bass', 'riff', 'drums'];
function drawMember(ctx, id, x, y, f, o) {
  const c = BAND[id], p = TP(ctx, x, y, f, o.tint), t = o.t || 0;
  let bob = 0, armF = [5, -11], armB = [-4, -10], lf = 0, lb = 0, mouth = 0;
  const a = o.anim;
  if (a === 'caged') { bob = Math.sin(t * 10) > 0.7 ? -1 : 0; armF = [3, -20]; armB = [-3, -20]; }
  if (a === 'celebrate') { const j = Math.abs(Math.sin(t * 7 + x)) * 4 | 0; bob = -j; armF = [4, -21 - j]; armB = [-4, -21 - j]; mouth = 1; }
  if (a === 'walk') { const fr = (t * 8 | 0) % 4; lf = fr === 0 ? 2 : fr === 2 ? -2 : 0; lb = -lf; bob = fr % 2 ? -1 : 0; }
  if (a === 'play') { bob = o.beat ? 1 : 0; }
  if (a === 'wave') { armF = [4, -20 + (Math.sin(t * 8) > 0 ? 0 : 2)]; }
  const by = bob;
  p.line(-2, -13 + by, armB[0], armB[1] + by, c.top2, 2);
  p.r(-3 + lb, -6 + by, 3, 4, c.pants); p.r(-3 + lb, -2 + by, 3, 2, PAL.ink);
  p.r(0 + lf, -6 + by, 3, 4, c.pants); p.r(0 + lf, -2 + by, 3, 2, PAL.ink);
  p.r(-4, -14 + by, 7, 8, c.top); p.r(-4, -14 + by, 2, 8, c.top2);
  const hy = -21 + by;
  p.r(-3, hy, 6, 7, c.skin); p.px(1, hy + 3, PAL.ink); p.px(3, hy + 3, PAL.ink);
  if (mouth || a === 'caged') p.r(2, hy + 5, 1, 1, '#5a1020');
  switch (c.hairStyle) {
    case 'bob': p.r(-4, hy - 1, 8, 3, c.hair); p.r(-4, hy + 2, 2, 5, c.hair); p.r(3, hy + 2, 1, 3, c.hair); break;
    case 'mohawk': p.r(-1, hy - 4, 3, 4, c.hair); p.r(-3, hy, 6, 1, '#222'); break;
    case 'long': p.r(-4, hy - 1, 7, 3, c.hair); p.r(-4, hy + 2, 2, 8, c.hair); break;
    case 'spike': p.r(-3, hy - 2, 6, 3, c.hair); p.r(-4, hy - 4, 2, 2, c.hair); p.r(0, hy - 5, 2, 3, c.hair); p.r(3, hy - 3, 2, 2, c.hair); break;
    case 'bandana': p.r(-3, hy - 1, 6, 2, '#d22'); p.r(-5, hy, 2, 2, '#d22'); p.px(-1, hy - 1, '#fff'); break;
  }
  if (c.phones) { p.r(-4, hy + 1, 2, 3, '#333'); p.r(-3, hy - 2, 6, 1, '#333'); p.px(-4, hy + 2, c.top2); }
  // instrument / hands
  if (a !== 'caged' && a !== 'celebrate') drawHeldInstrument(p, id, c, by, o);
  p.line(1, -13 + by, armF[0], armF[1] + by, c.top, 2); p.r(armF[0], armF[1] + by, 2, 2, c.skin);
}
function drawHeldInstrument(p, id, c, by, o) {
  const t = o.t || 0, play = o.anim === 'play';
  if (id === 'keys') { p.line(-6, -6 + by, 9, -12 + by, '#e8e8e8', 3); for (let i = 0; i < 6; i++) p.px(-4 + i * 2, -6 + by - i, '#222'); p.r(8, -14 + by, 3, 3, '#4a7dff'); }
  if (id === 'volt') { p.r(2, -11 + by, 9, 6, '#222'); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) p.r(3 + i * 3, -10 + j * 3 + by, 2, 2, (play && ((t * 8 | 0) + i + j) % 3 === 0) ? '#fff' : ['#39ff9c', '#ff3fa4', '#4fe3ff'][i]); }
  if (id === 'bass') { p.r(-2, -9 + by, 7, 5, '#c8102e'); p.r(-1, -8 + by, 2, 2, '#222'); p.line(4, -8 + by, 14, -16 + by, '#6b3f1f', 1); p.r(14, -18 + by, 2, 3, '#333'); }
  if (id === 'riff') { p.r(-1, -9 + by, 6, 4, '#ffcc33'); p.r(0, -8 + by, 2, 1, '#222'); p.line(4, -8 + by, 11, -14 + by, '#5a3818', 1); p.r(11, -16 + by, 2, 3, '#222'); }
  if (id === 'drums') { const s = play ? (Math.sin(t * 14) > 0 ? -2 : 1) : 0; p.line(4, -11 + by, 9, -15 + by + s, '#e8d0a0', 1); p.line(-3, -10 + by, -8, -14 + by - s, '#e8d0a0', 1); }
}
// mini drum kit for rescue performance / concert
function drawDrumKit(ctx, x, y, t, hit, big) {
  const p = new Painter(ctx, x, y, 1), s = big ? 1 : 0;
  p.r(-14 - s * 4, -10, 10 + s * 2, 10, '#b31b1b'); p.r(-14 - s * 4, -10, 10 + s * 2, 2, '#eee'); // floor tom
  p.r(-4, -14 - s * 2, 14 + s * 4, 14 + s * 2, '#d02020'); p.r(-1, -11 - s * 2, 8 + s * 4, 8 + s * 2, '#f4f0ea'); p.r(1, -9 - s * 2, 4 + s * 4, 4 + s * 2, '#b31b1b'); // kick
  p.r(12 + s * 2, -9, 9, 4, '#ddd'); p.r(12 + s * 2, -5, 1, 5, '#888'); p.r(20 + s * 2, -5, 1, 5, '#888'); // snare
  const cy = hit ? -21 : -20; p.r(-22 - s * 4, cy, 11, 1, '#ffd34f'); p.r(-17 - s * 4, cy + 1, 1, 20 + (hit ? -1 : 0), '#888');
  p.r(20 + s * 4, -24, 12, 1, '#ffd34f'); p.r(26 + s * 4, -23, 1, 23, '#888');
  if (hit) { p.r(-20 - s * 4, cy - 2, 7, 1, '#fff8'); }
}

// ---------- enemies ----------
function drawGremlin(ctx, e, t) {
  const p = TP(ctx, e.x + e.w / 2, e.y + e.h, e.f, e.flash > 0 ? '#fff' : null);
  const sq = e.state === 'windup' ? 2 : (Math.sin(t * 12 + e.seed) > 0 ? 1 : 0);
  const col = e.col || '#a34fe0', dk = e.colD || '#6a2a99';
  p.r(-7, -11 + sq, 14, 10 - sq, col); p.r(-6, -12 + sq, 12, 1, col); p.r(-7, -3, 14, 2, dk);
  p.r(-7, -11 + sq, 2, 10 - sq, dk);
  p.r(-5, -1, 3, 1, PAL.ink); p.r(2, -1, 3, 1, PAL.ink);
  // eyes
  p.r(0, -9 + sq, 3, 3, '#fff'); p.r(4, -9 + sq, 2, 3, '#fff'); p.px(2, -8 + sq, PAL.ink); p.px(5, -8 + sq, PAL.ink);
  // teeth
  p.r(0, -4 + sq, 6, 2, PAL.ink); p.px(1, -4 + sq, '#fff'); p.px(3, -4 + sq, '#fff'); p.px(5, -4 + sq, '#fff');
  // static noise
  for (let i = 0; i < 3; i++) { const k = (t * 20 + i * 7 + e.seed) | 0; p.px(-5 + (k * 13) % 9, -10 + sq + (k * 7) % 6, '#fff6'); }
  if (e.state === 'windup') drawText(ctx, '!', e.x + e.w / 2 - 1, e.y - 9, '#ff4');
}
function drawBat(ctx, e, t) {
  const p = TP(ctx, e.x + e.w / 2, e.y + e.h / 2, e.f, e.flash > 0 ? '#fff' : null);
  const up = Math.sin(t * 18 + e.seed) > 0; const col = e.col || '#3d3d5c';
  p.r(-3, -3, 7, 6, col); p.r(-2, -5, 2, 2, '#666'); p.r(1, -5, 2, 2, '#666'); p.px(-1, -4, '#222'); p.px(2, -4, '#222');
  if (up) { p.line(-3, -1, -9, -6, col, 2); p.line(4, -1, 9, -6, col, 2); } else { p.line(-3, 0, -9, 3, col, 2); p.line(4, 0, 9, 3, col, 2); }
  p.px(0, -1, e.state === 'windup' ? '#ff0' : '#f33'); p.px(2, -1, e.state === 'windup' ? '#ff0' : '#f33');
  p.r(0, 2, 2, 1, '#fff');
  if (e.state === 'windup') drawText(ctx, '!', e.x + e.w / 2 - 1, e.y - 8, '#ff4');
}
function drawAmp(ctx, e, t) {
  const p = TP(ctx, e.x + e.w / 2, e.y + e.h, e.f, e.flash > 0 ? '#fff' : null);
  const warn = e.state === 'windup';
  p.r(-8, -16, 16, 16, '#26262e'); p.r(-7, -15, 14, 3, '#3a3a46'); p.px(-5, -14, '#ffd34f'); p.px(-2, -14, '#ffd34f'); p.px(1, -14, '#ffd34f');
  p.r(-7, -11, 14, 10, '#4b4b5e'); for (let i = -6; i < 7; i += 2) p.r(i, -11, 1, 10, '#3b3b4b');
  const glow = warn ? ((t * 16 | 0) % 2 ? '#ff0' : '#f80') : '#f33';
  p.r(-3, -9, 6, 6, '#111'); p.r(-2, -8, 4, 4, '#eee'); p.r(0, -7, 2, 2, glow);
  p.r(-8, -1, 16, 1, '#111');
  if (warn) { p.r(-9, -17, 18, 1, glow); }
}
function drawGuardian(ctx, e, t) {
  const p = TP(ctx, e.x + e.w / 2, e.y + e.h, e.f, e.flash > 0 ? '#fff' : null);
  const v = e.variant, body = v === 2 ? '#7a6a5a' : '#5d8f3a', dk = v === 2 ? '#4a3e34' : '#3a6024';
  const walk = e.state === 'walk' ? ((t * 6 | 0) % 2) : 0, wind = e.state === 'windup', atk = e.state === 'attack' || e.state === 'charge';
  p.r(-8, -8 - walk, 6, 8 + walk, dk); p.r(3, -8 + walk - 1, 6, 8 - walk + 1, dk); // legs
  p.r(-11, -27, 22, 20, body); p.r(-11, -27, 4, 20, dk); p.r(-11, -9, 22, 2, '#3a2a1a'); // torso & belt
  if (v === 2) { p.r(-4, -23, 10, 10, '#2b2b33'); p.r(-2, -21, 6, 6, '#555'); p.r(0, -19, 2, 2, '#ff6'); }
  else { p.r(-2, -21, 9, 6, '#7fb050'); }
  p.r(-7, -35, 15, 9, body); p.r(-7, -35, 3, 9, dk); // head
  p.r(-8, -38, 3, 4, '#eee'); p.r(6, -38, 3, 4, '#eee'); // horns
  const ec = wind ? ((t * 14 | 0) % 2 ? '#ff0' : '#f40') : '#f33';
  p.r(1, -32, 3, 2, ec); p.r(5, -32, 2, 2, ec); p.r(1, -29, 6, 2, PAL.ink); p.px(2, -29, '#fff'); p.px(5, -29, '#fff');
  // key on belt (visible until drop)
  if (!e.dead && e.keyId) { drawKeyShape(p, -5, -11, e.keyCol); }
  // weapon arm
  const ang = wind ? -2.4 : atk ? 1.3 : -0.3 + Math.sin(t * 3) * 0.1;
  const hx = 8 + Math.sin(ang) * 6, hy = -24 - Math.cos(ang) * 6;
  p.line(8, -24, hx, hy, body, 3);
  const cx = hx + Math.sin(ang) * 12, cy = hy - Math.cos(ang) * 12;
  if (v === 2) { p.line(hx, hy, cx, cy, '#555', 2); p.r(Math.round(cx) - 3, Math.round(cy) - 3, 6, 6, '#2b2b33'); p.r(Math.round(cx) - 2, Math.round(cy) - 2, 4, 4, '#888'); }
  else { p.line(hx, hy, cx, cy, '#d8b040', 2); p.r(Math.round(cx) - 3, Math.round(cy) - 2, 6, 5, '#e8c050'); p.r(Math.round(cx) - 2, Math.round(cy) - 1, 4, 3, '#a07818'); }
  p.line(-9, -24, -12, -12, body, 3);
  if (wind) drawText(ctx, '!', e.x + e.w / 2 - 1, e.y - 12, (t * 10 | 0) % 2 ? '#ff4' : '#f44', 2);
}
function drawBoss(ctx, e, t) {
  const p = TP(ctx, e.x + e.w / 2, e.y + e.h, e.f, e.flash > 0 ? '#fff' : null);
  const rage = e.phase2, cloak = rage ? '#3a0f1e' : '#221a30', cl2 = rage ? '#5a1a2e' : '#352a4a';
  const crouch = e.state === 'warnLeap' || e.state === 'warnStomp' ? 3 : 0, air = e.state === 'leap';
  p.r(-14, -44 + crouch, 28, 42 - crouch, cloak); p.r(-16, -20 + crouch, 32, 18 - crouch, cloak); p.r(-14, -44 + crouch, 6, 42 - crouch, cl2);
  p.r(-12, -2, 9, 2, '#111'); p.r(4, -2, 9, 2, '#111');
  // hood + face
  const hy = -56 + crouch;
  p.r(-10, hy, 20, 16, cloak); p.r(-7, hy + 4, 14, 10, '#0a0a10');
  const ec = rage ? '#ff3030' : '#c070ff';
  p.r(-5, hy + 7, 3, 2, ec); p.r(2, hy + 7, 3, 2, ec);
  p.r(-4, hy + 11, 8, 2, '#ddd'); p.line(-4, hy + 10, 3, hy + 13, '#888'); p.line(3, hy + 10, -4, hy + 13, '#888'); // taped mouth (X)
  // giant earmuffs (the Silencer)
  p.r(-15, hy + 3, 6, 9, '#333'); p.r(10, hy + 3, 6, 9, '#333'); p.r(-14, hy + 5, 3, 5, '#666'); p.r(12, hy + 5, 3, 5, '#666'); p.r(-12, hy - 2, 25, 3, '#333');
  // final key on necklace
  if (!e.dead) { p.line(-4, hy + 16, 0, hy + 22, '#999'); p.line(4, hy + 16, 0, hy + 22, '#999'); drawKeyShape(p, -2, hy + 22, e.keyCol); }
  // hands
  const glow = e.state === 'warnOrbs';
  const hl = glow ? (t * 16 | 0) % 2 ? '#ff0' : '#f0f' : '#4a3a5a';
  const lift = e.state === 'warnStomp' ? -10 : air ? -6 : 0;
  p.r(14, -30 + lift, 8, 8, hl); p.r(-22, -30 + lift, 8, 8, hl);
  if (e.state && e.state.startsWith('warn')) drawText(ctx, '!', e.x + e.w / 2 - 3, e.y - 22, (t * 10 | 0) % 2 ? '#ff4' : '#f44', 2);
}
function drawOrb(ctx, o, t) {
  const p = new Painter(ctx, o.x, o.y, 1);
  if (o.kind === 'note') { p.r(-1, -1, 3, 3, '#ffd34f'); p.r(1, -5, 1, 4, '#ffd34f'); p.r(2, -5, 2, 1, '#ffd34f'); return; }
  const c = (t * 12 | 0) % 2 ? '#e070ff' : '#ff50a0';
  p.r(-3, -2, 6, 4, c); p.r(-2, -3, 4, 6, c); p.r(-1, -1, 2, 2, '#fff');
}
function drawShock(ctx, s, t) {
  const p = new Painter(ctx, s.x, s.y, 1); const c = (t * 20 | 0) % 2 ? '#ff6' : '#f84';
  p.r(-4, -s.h, 8, s.h, c); p.r(-2, -s.h - 3, 4, 3, '#fff'); p.r(-6, -3, 12, 3, '#f84');
}

// ---------- items ----------
function drawKeyItem(ctx, k, t) {
  const p = new Painter(ctx, k.x, k.y + Math.round(Math.sin(t * 4) * (k.vy === 0 ? 1 : 0)), 1);
  if ((t * 3 | 0) % 2) { ctx.fillStyle = k.col + '55'; ctx.fillRect(Math.round(k.x) - 3, Math.round(k.y) - 4, 15, 12); }
  drawKeyShape(p, 0, 0, k.col);
  if ((t * 6 | 0) % 4 === 0) p.px(-2, -3, '#fff');
  drawTextC(ctx, 'KEY', k.x + 4, k.y - 9, k.col, 1, '#000');
}
function drawCage(ctx, c, t, hasKey) {
  const x = Math.round(c.x), y = Math.round(c.y), w = c.w, h = c.h;
  const iron = '#4c4f5c', ironD = '#2c2e38';
  ctx.fillStyle = '#0006'; ctx.fillRect(x + 2, y + 4, w - 4, h - 6);
  ctx.fillStyle = ironD; ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y + h - 4, w, 4);
  ctx.fillStyle = iron; ctx.fillRect(x, y + 1, w, 2); ctx.fillRect(x, y + h - 3, w, 2);
  const open = c.doorOpen || 0; // 0..1
  for (let bx = x + 2; bx < x + w - 1; bx += 5) {
    const inDoor = bx > x + w / 2;
    if (inDoor && open > 0) continue;
    ctx.fillStyle = iron; ctx.fillRect(bx, y + 4, 2, h - 8); ctx.fillStyle = '#7a7e90'; ctx.fillRect(bx, y + 4, 1, h - 8);
  }
  if (open > 0) { // swung door
    const dw = Math.max(2, Math.round((1 - open) * (w / 2)));
    ctx.fillStyle = iron; for (let i = 0; i < 4; i++) ctx.fillRect(x + w + i * Math.max(1, dw / 4) | 0, y + 4, 1, h - 8);
    ctx.fillRect(x + w, y + 4, dw, 2); ctx.fillRect(x + w, y + h - 6, dw, 2);
  }
  // padlock
  if (c.state === 'locked' || (c.state === 'unlocking' && c.lockT < 0.9)) {
    const lx = x + w / 2 + 2, ly = y + h / 2 - 3 + (c.state === 'unlocking' && c.lockT > 0.6 ? Math.round((c.lockT - 0.6) * 40) : 0);
    ctx.fillStyle = '#888'; ctx.fillRect(lx + 1, ly - 3, 5, 1); ctx.fillRect(lx + 1, ly - 3, 1, 3); ctx.fillRect(lx + 5, ly - 3, 1, 3);
    ctx.fillStyle = c.col; ctx.fillRect(lx, ly, 7, 6); ctx.fillStyle = '#222'; ctx.fillRect(lx + 3, ly + 2, 1, 2);
    if (hasKey && (t * 4 | 0) % 2) { ctx.fillStyle = '#fff'; ctx.fillRect(lx - 1, ly - 1, 9, 1); }
  }
  // sign
  ctx.fillStyle = ironD; ctx.fillRect(x + 4, y - 8, w - 8, 7); drawTextC(ctx, 'CAGE ' + c.stage, x + w / 2, y - 7, c.col, 1, null);
}
function drawExit(ctx, d, t) {
  const x = Math.round(d.x), y = Math.round(d.y);
  ctx.fillStyle = '#1a1420'; ctx.fillRect(x - 2, y - 2, d.w + 4, d.h + 2);
  if (d.open) {
    ctx.fillStyle = '#ffe9a8'; ctx.fillRect(x, y, d.w, d.h); ctx.fillStyle = '#fff6d8'; ctx.fillRect(x + 4, y + 3, d.w - 8, d.h - 3);
    const a = (t * 4 | 0) % 2; drawText(ctx, '>', x + d.w / 2 - 1 + a, y + d.h / 2 - 2, '#3a2', 1);
    ctx.fillStyle = '#3f3'; ctx.fillRect(x + d.w / 2 - 2, y - 6, 4, 3);
  } else {
    ctx.fillStyle = '#3a2f44'; ctx.fillRect(x, y, d.w, d.h);
    ctx.fillStyle = '#2a2034'; for (let i = 3; i < d.w; i += 6) ctx.fillRect(x + i, y, 2, d.h);
    ctx.fillStyle = (t * 2 | 0) % 2 ? '#f33' : '#a22'; ctx.fillRect(x + d.w / 2 - 2, y - 6, 4, 3);
  }
  drawTextC(ctx, d.final ? 'STAGE' : 'EXIT', x + d.w / 2, y - 13, d.open ? '#7f7' : '#c88', 1);
}
function drawCheckpoint(ctx, c, t) {
  const p = new Painter(ctx, c.x + 8, c.y + 16, 1);
  p.r(0, -20, 1, 20, PAL.standL); p.r(-3, -1, 7, 1, PAL.standD); p.r(-1, -23, 3, 3, PAL.mic);
  const col = c.active ? '#3f6' : '#777'; const w = c.active ? ((t * 6 | 0) % 2) : 0;
  p.r(1, -19, 7, 5 + w, col); p.r(1, -19, 7, 1, '#fff4');
  if (c.active && (t * 5 | 0) % 3 === 0) p.px(9, -22, '#fff');
}
function drawHeart(ctx, x, y, full, col = '#ff3b5c') {
  const rows = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) if (rows[r][c] === '1') { ctx.fillStyle = full ? col : '#3a2630'; ctx.fillRect(x + c, y + r, 1, 1); }
  if (full) { ctx.fillStyle = '#fff8'; ctx.fillRect(x + 1, y + 1, 1, 1); }
}
// small gesture icons for HUD (10x10)
function drawHandIcon(ctx, x, y, g, col) {
  const P = (dx, dy, w, h) => { ctx.fillRect(x + dx, y + dy, w, h); };
  ctx.fillStyle = col;
  if (g === 'NONE') { ctx.fillStyle = '#555'; drawText(ctx, '?', x + 3, y + 2, '#777'); return; }
  P(2, 5, 6, 5);
  if (g === 'OPEN') { P(2, 1, 1, 4); P(4, 0, 1, 5); P(6, 1, 1, 4); P(8, 2, 1, 4); P(0, 5, 2, 1); }
  else if (g === 'INDEX') { P(4, 0, 2, 5); P(1, 6, 1, 2); }
  else if (g === 'FIST') { P(2, 3, 6, 2); P(1, 6, 1, 2); }
  else { drawText(ctx, '~', x + 3, y - 1, '#aaa'); }
}
