'use strict';
// ---------- core constants & helpers ----------
const VW = 384, VH = 216, TILE = 16;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const sign = v => v > 0 ? 1 : v < 0 ? -1 : 0;
const now = () => performance.now();
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

const Store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};

// ---------- 3x5 pixel font ----------
const FONT = (() => {
  const g = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101101111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
    '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111',
    '9': '111101111001110', '.': '000000000000010', ',': '000000000010100', '!': '010010010000010', '?': '110001010000010',
    ':': '000010000010000', '-': '000000111000000', '/': '001001010100100', "'": '010010000000000', '+': '000010111010000',
    '(': '010100100100010', ')': '010001001001010', '&': '010101010101011', '%': '101001010100101', '<': '001010100010001',
    '>': '100010001010100', '=': '000111000111000', '~': '011010010110110', '_': '000000000000111', '*': '000101010101000',
    '#': '101111101111101', ' ': '000000000000000'
  };
  return g;
})();
function textWidth(s, sc = 1) { return s.length * 4 * sc - sc; }
function drawText(ctx, s, x, y, col = '#fff', sc = 1, shadow = null) {
  s = String(s).toUpperCase();
  x = Math.round(x); y = Math.round(y);
  if (shadow) drawText(ctx, s, x + sc, y + sc, shadow, sc, null);
  ctx.fillStyle = col;
  for (let i = 0; i < s.length; i++) {
    const gl = FONT[s[i]] || FONT['?'];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++)
      if (gl[r * 3 + c] === '1') ctx.fillRect(x + i * 4 * sc + c * sc, y + r * sc, sc, sc);
  }
}
function drawTextC(ctx, s, cx, y, col, sc = 1, shadow = '#000') { drawText(ctx, s, cx - textWidth(String(s), sc) / 2, y, col, sc, shadow); }

// ---------- painter (origin at feet-center, mirrored by facing) ----------
function Painter(ctx, ox, oy, f) { this.c = ctx; this.ox = Math.round(ox); this.oy = Math.round(oy); this.f = f >= 0 ? 1 : -1; }
Painter.prototype.r = function (dx, dy, w, h, col) {
  if (col) this.c.fillStyle = col;
  const x = this.f === 1 ? this.ox + dx : this.ox - dx - w;
  this.c.fillRect(x, this.oy + dy, w, h);
};
Painter.prototype.px = function (dx, dy, col) { this.r(dx, dy, 1, 1, col); };
// pixel line in local coordinates
Painter.prototype.line = function (x0, y0, x1, y1, col, th = 1) {
  this.c.fillStyle = col;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
  for (let n = 0; n < 200; n++) {
    this.r(x0, y0, th, th);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
};
function pline(ctx, x0, y0, x1, y1, col) { new Painter(ctx, 0, 0, 1).line(x0, y0, x1, y1, col); }

// ---------- small event log (training room / debug) ----------
const EventLog = {
  items: [], push(s) { this.items.unshift({ s, t: now() }); if (this.items.length > 8) this.items.pop(); }
};
