'use strict';
// =====================================================================
//  LEVELS (built with a tiny builder, tile units: 16px) + THEMES
// =====================================================================
function LB(w, h) {
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  const b = {
    w, h, g, ents: [],
    fill(x0, x1, y0, y1, ch = '#') { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (y >= 0 && y < h && x >= 0 && x < w) g[y][x] = ch; return b; },
    ground(x0, x1, top, ch = '#') { return b.fill(x0, x1, top, h - 1, ch); },
    plat(x0, x1, y) { return b.fill(x0, x1, y, y, '='); },
    spikes(x0, x1, y) { return b.fill(x0, x1, y, y, '^'); },
    e(type, col, gy, props = {}) { b.ents.push(Object.assign({ type, col, gy }, props)); return b; }
  };
  return b;
}

const LEVELS = {};
// ---------------- STAGE 1: IVORY HALLS (keys + electronics) ----------------
LEVELS[1] = (() => {
  const b = LB(112, 15);
  b.ground(0, 30, 12).ground(34, 47, 12).ground(48, 60, 10).ground(61, 76, 12).ground(80, 111, 12);
  b.fill(110, 111, 0, 14);
  b.plat(23, 26, 9).plat(37, 40, 9).plat(42, 45, 6).plat(62, 68, 9).plat(88, 91, 9).plat(102, 105, 9);
  b.spikes(63, 67, 11);
  b.e('player', 3, 12).e('cage', 8, 12, { stage: 1, members: ['keys', 'volt'] }).e('exit', 13, 12, { stage: 1 })
    .e('sign', 17, 12, { text: 'KEY GUARDIAN >' })
    .e('gremlin', 21, 12).e('gremlin', 28, 12).e('heart', 24, 9)
    .e('checkpoint', 36, 12).e('bat', 44, 4).e('gremlin', 52, 10).e('amp', 58, 10, { f: -1 })
    .e('gremlin', 72, 12).e('bat', 70, 6)
    .e('checkpoint', 82, 12).e('guardian', 98, 12, { variant: 1, name: 'OFF-KEY OGRE', hp: 8 });
  return Object.assign(b, { stage: 1, theme: 's1', name: 'IVORY HALLS', music: 's1' });
})();
// ---------------- STAGE 2: LOW-END CAVERNS (bass + guitar) ----------------
LEVELS[2] = (() => {
  const b = LB(132, 22);
  b.ground(0, 24, 19).ground(28, 65, 19).fill(66, 67, 9, 21).fill(52, 80, 7, 8).ground(68, 100, 15).ground(101, 131, 18);
  b.fill(130, 131, 0, 21);
  b.plat(45, 48, 16).plat(48, 51, 13).plat(47, 50, 10).plat(84, 86, 12).plat(81, 83, 10).plat(103, 107, 15).plat(113, 116, 15).plat(124, 127, 15);
  b.spikes(104, 106, 17).spikes(57, 63, 18);
  b.e('player', 3, 19).e('cage', 8, 19, { stage: 2, members: ['bass', 'riff'] }).e('exit', 14, 19, { stage: 2 })
    .e('sign', 19, 19, { text: 'GUARDIAN >' })
    .e('gremlin', 31, 19).e('gremlin', 37, 19).e('amp', 41, 19, { f: -1 }).e('sign', 44, 19, { text: 'CLIMB ^' })
    .e('checkpoint', 54, 7).e('bat', 59, 4).e('gremlin', 63, 7).e('bat', 71, 4).e('heart', 76, 7)
    .e('gremlin', 88, 15).e('bat', 92, 11).e('gremlin', 95, 15).e('amp', 99, 15, { f: -1 })
    .e('checkpoint', 109, 18).e('guardian', 120, 18, { variant: 2, name: 'FEEDBACK GOLEM', hp: 10 });
  return Object.assign(b, { stage: 2, theme: 's2', name: 'LOW-END CAVERNS', music: 's2' });
})();
// ---------------- STAGE 3: THUNDER CITADEL (drums, final boss) ----------------
LEVELS[3] = (() => {
  const b = LB(124, 17);
  b.ground(0, 13, 14).fill(17, 19, 12, 16).fill(22, 24, 10, 16).fill(27, 29, 12, 16).ground(33, 52, 14).fill(39, 41, 12, 13)
    .ground(53, 70, 14).ground(71, 123, 14).fill(122, 123, 0, 16);
  b.spikes(54, 69, 13);
  b.plat(54, 57, 11).plat(60, 63, 11).plat(66, 69, 11).plat(99, 102, 10).plat(111, 114, 10);
  b.e('player', 2, 14).e('bat', 21, 7).e('bat', 26, 6)
    .e('checkpoint', 34, 14).e('gremlin', 36, 14).e('amp', 40, 12, { f: -1 }).e('gremlin', 46, 14).e('amp', 51, 14, { f: -1 })
    .e('bat', 61, 7).e('bat', 67, 7).e('heart', 61, 11)
    .e('checkpoint', 73, 14).e('gremlin', 78, 14).e('gremlin', 84, 14).e('amp', 88, 14, { f: -1 })
    .e('checkpoint', 90, 14).e('bossgate', 93, 14, { rows: 5 }).e('boss', 108, 14, { name: 'THE SILENCER', hp: 30 })
    .e('cage', 117, 14, { stage: 3, members: ['drums'] });
  return Object.assign(b, { stage: 3, theme: 's3', name: 'THUNDER CITADEL', music: 's3' });
})();
// ---------------- PROLOGUE TUTORIAL (backstage) ----------------
LEVELS.tut = (() => {
  const b = LB(58, 14);
  b.ground(0, 57, 11, 'W').fill(0, 0, 0, 13, 'M').fill(57, 57, 0, 13, 'M');
  b.fill(21, 22, 9, 10, 'W');                      // crates to jump over
  b.fill(34, 34, 9, 10, 'M').fill(46, 46, 9, 10, 'M'); // gremlin pen walls
  b.plat(38, 41, 8);
  b.e('player', 3, 11).e('dummy', 28, 11).e('exit', 52, 11, { stage: 0, tutorial: true })
    .e('sign', 31, 8, { text: 'PEN' });
  return Object.assign(b, { stage: 0, theme: 'train', name: 'BACKSTAGE', music: 'train', cardTitle: 'PROLOGUE', cardInfo: 'LEARN THE MOVES WITH SAM THE STAGEHAND' });
})();
// ---------------- TRAINING ROOM ----------------
LEVELS.train = (() => {
  const b = LB(44, 14);
  b.ground(0, 13, 11, 'W').ground(14, 27, 11, 'S').ground(28, 43, 11, 'M').fill(0, 0, 0, 13, 'M').fill(43, 43, 0, 13, 'M');
  b.plat(5, 8, 8).plat(15, 18, 8).plat(31, 34, 7);
  b.spikes(22, 23, 10);
  b.e('player', 3, 11).e('dummy', 37, 11).e('sign', 3, 8, { text: 'WOOD' }).e('sign', 16, 8, { text: 'STONE' }).e('sign', 30, 9, { text: 'METAL' })
    .e('sign', 22, 7, { text: 'OUCH!' });
  return Object.assign(b, { stage: 0, theme: 'train', name: 'TRAINING ROOM', music: 'train' });
})();

// =====================================================================
//  THEMES: tile art, surfaces, parallax backgrounds
// =====================================================================
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
const THEMES = {
  s1: { top: '#3a2350', grad: ['#120a22', '#2c1745', '#4a2160'], surface: 'keys', plat: 'wood', accent: '#4fe3ff' },
  s2: { grad: ['#0e0704', '#2a1508', '#46240c'], surface: 'stone', plat: 'metal', accent: '#ffa53a' },
  s3: { grad: ['#08030a', '#2a0812', '#4a0d1c'], surface: 'metal', plat: 'drum', accent: '#ff4f6a' },
  train: { grad: ['#0b1220', '#18233a', '#22304a'], surface: 'wood', plat: 'wood', accent: '#9cf' }
};
const SURF_BY_CHAR = { W: 'wood', S: 'stone', M: 'metal' };
function tileSurface(theme, ch) { return SURF_BY_CHAR[ch] || (ch === '=' ? THEMES[theme].plat : THEMES[theme].surface); }

function buildTileArt(theme) {
  const T = {};
  const mk = fn => { const [c, x] = mkCanvas(16, 16); fn(x); return c; };
  const noiseDots = (x, cols, n, seed) => { let s = seed; for (let i = 0; i < n; i++) { s = (s * 9301 + 49297) % 233280; const px = s % 16; s = (s * 9301 + 49297) % 233280; const py = s % 16; x.fillStyle = cols[i % cols.length]; x.fillRect(px, py, 1, 1); } };
  const wood = (x, top) => { x.fillStyle = '#5a3420'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#4a2a18'; x.fillRect(0, 5, 16, 1); x.fillRect(0, 11, 16, 1); x.fillRect(7, 0, 1, 5); x.fillRect(3, 6, 1, 5); x.fillRect(12, 12, 1, 4); if (top) { x.fillStyle = '#8a5a34'; x.fillRect(0, 0, 16, 2); x.fillStyle = '#b07848'; x.fillRect(0, 0, 16, 1); } };
  const stone = (x, top) => { x.fillStyle = '#4a3a2e'; x.fillRect(0, 0, 16, 16); noiseDots(x, ['#3a2c22', '#5a4838', '#33261c'], 26, 7); x.fillStyle = '#2e2218'; x.fillRect(0, 8, 16, 1); x.fillRect(8, 0, 1, 8); x.fillRect(4, 8, 1, 8); if (top) { x.fillStyle = '#6a5440'; x.fillRect(0, 0, 16, 2); x.fillStyle = '#ffa53a'; x.fillRect(3, 0, 3, 1); x.fillRect(11, 1, 2, 1); } };
  const metal = (x, top) => { x.fillStyle = '#3a3c48'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#2a2c36'; x.fillRect(0, 15, 16, 1); x.fillRect(15, 0, 1, 16); x.fillStyle = '#50525f'; x.fillRect(0, 0, 16, 1); x.fillRect(0, 0, 1, 16); x.fillStyle = '#7a7c8a'; x.fillRect(2, 2, 1, 1); x.fillRect(13, 2, 1, 1); x.fillRect(2, 13, 1, 1); x.fillRect(13, 13, 1, 1); if (top) { x.fillStyle = '#8a8c9c'; x.fillRect(0, 0, 16, 2); x.fillStyle = theme === 's3' ? '#ff4f6a' : '#9cf'; x.fillRect(0, 2, 16, 1); } };
  const keys = (x, top) => {
    x.fillStyle = '#2a1838'; x.fillRect(0, 0, 16, 16); noiseDots(x, ['#36204a', '#1f1029'], 14, 3);
    if (top) { x.fillStyle = '#f4f0ea'; x.fillRect(0, 0, 16, 6); x.fillStyle = '#c9c2b8'; x.fillRect(7, 0, 1, 6); x.fillRect(15, 0, 1, 6); x.fillRect(0, 5, 16, 1); x.fillStyle = '#141018'; x.fillRect(5, 0, 4, 3); x.fillRect(13, 0, 3, 3); x.fillStyle = '#4fe3ff'; x.fillRect(0, 6, 16, 1); }
  };
  const base = { s1: keys, s2: stone, s3: metal, train: wood }[theme];
  T['#top'] = mk(x => base(x, true)); T['#'] = mk(x => base(x, false));
  T['Wtop'] = mk(x => wood(x, true)); T['W'] = mk(x => wood(x, false));
  T['Stop'] = mk(x => stone(x, true)); T['S'] = mk(x => stone(x, false));
  T['Mtop'] = mk(x => metal(x, true)); T['M'] = mk(x => metal(x, false));
  T['='] = mk(x => {
    if (theme === 's1' || theme === 'train') { x.fillStyle = '#8a5a34'; x.fillRect(0, 0, 16, 4); x.fillStyle = '#ffd34f'; x.fillRect(0, 0, 16, 1); x.fillStyle = '#4a2a18'; x.fillRect(0, 4, 16, 1); x.fillRect(2, 5, 2, 3); x.fillRect(12, 5, 2, 3); }
    else if (theme === 's2') { x.fillStyle = '#555a66'; x.fillRect(0, 0, 16, 5); x.fillStyle = '#2b2e36'; for (let i = 1; i < 16; i += 3) x.fillRect(i, 1, 1, 3); x.fillStyle = '#8a8f9c'; x.fillRect(0, 0, 16, 1); }
    else { x.fillStyle = '#e9dcc0'; x.fillRect(0, 0, 16, 3); x.fillStyle = '#b31b1b'; x.fillRect(0, 3, 16, 3); x.fillStyle = '#ffd34f'; x.fillRect(0, 6, 16, 1); for (let i = 2; i < 16; i += 5) x.fillRect(i, 3, 1, 3); }
  });
  T['^'] = mk(x => { x.fillStyle = theme === 's3' ? '#c0c0d0' : theme === 's2' ? '#d0a070' : '#ddd'; for (let i = 0; i < 4; i++) { x.fillRect(i * 4 + 1, 12, 3, 4); x.fillRect(i * 4 + 2, 8, 1, 4); } x.fillStyle = '#fff'; for (let i = 0; i < 4; i++) x.fillRect(i * 4 + 2, 8, 1, 1); });
  T['G'] = mk(x => { x.fillStyle = '#2a0a12'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#7a7c8a'; for (let i = 1; i < 16; i += 5) x.fillRect(i, 0, 2, 16); x.fillStyle = '#ff4f6a'; x.fillRect(0, 7, 16, 2); });
  return T;
}

function buildBackground(theme) {
  const W = 512, layers = [];
  const L = (par, h, fn) => { const [c, x] = mkCanvas(W, h); fn(x); layers.push({ c, par, h }); };
  let seed = 11; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  if (theme === 's1') {
    L(0.08, 216, x => { for (let i = 0; i < 70; i++) { x.fillStyle = R() < 0.3 ? '#b9a8ff' : '#6a5a9a'; x.fillRect(R() * W | 0, R() * 140 | 0, 1, 1); } x.fillStyle = '#e8e0ff'; x.fillRect(400, 26, 14, 14); x.fillStyle = '#2c1745'; x.fillRect(405, 26, 9, 9); });
    L(0.3, 216, x => { for (let i = 0; i < 4; i++) { const bx = i * 128 + 20; x.fillStyle = '#24123a'; x.fillRect(bx, 40, 70, 176); x.fillStyle = '#3a2058'; x.fillRect(bx + 10, 60, 50, 90); x.fillRect(bx + 18, 52, 34, 8); x.fillStyle = '#4fe3ff22'; x.fillRect(bx + 12, 62, 46, 86); x.fillStyle = '#24123a'; x.fillRect(bx + 34, 60, 2, 90); x.fillRect(bx + 10, 104, 50, 2); x.fillStyle = '#1a0c2a'; x.fillRect(bx + 80, 30, 14, 186); x.fillRect(bx + 76, 30, 22, 6); } });
    L(0.55, 216, x => { for (let i = 0; i < 2; i++) { const bx = i * 256 + 40; x.fillStyle = '#170a24'; x.fillRect(bx, 150, 110, 30); x.fillRect(bx + 70, 120, 60, 34); x.fillRect(bx + 10, 180, 6, 36); x.fillRect(bx + 96, 180, 6, 36); x.fillStyle = '#2a1840'; for (let k = 0; k < 13; k++) x.fillRect(bx + 4 + k * 8, 152, 6, 8); }
      for (let i = 0; i < 9; i++) { const nx = R() * W | 0, ny = 40 + R() * 90 | 0; x.fillStyle = '#ff3fa455'; x.fillRect(nx, ny, 3, 3); x.fillRect(nx + 2, ny - 7, 1, 7); x.fillRect(nx + 3, ny - 7, 3, 1); } });
  } else if (theme === 's2') {
    L(0.1, 216, x => { for (let i = 0; i < 120; i++) { x.fillStyle = ['#1a0d06', '#2a1508', '#33190a'][i % 3]; x.fillRect(R() * W | 0, R() * 216 | 0, 6 + R() * 18 | 0, 4 + R() * 10 | 0); } for (let i = 0; i < 18; i++) { x.fillStyle = R() < 0.5 ? '#ffa53a88' : '#ff6a2a66'; const cx = R() * W | 0, cy = R() * 200 | 0; x.fillRect(cx, cy, 2, 4); x.fillRect(cx + 2, cy + 1, 2, 3); } });
    L(0.35, 216, x => { for (let i = 0; i < 3; i++) { const cx = 80 + i * 170, cy = 100 + (i % 2) * 30; x.fillStyle = '#1e1008'; x.fillRect(cx - 40, cy - 40, 80, 80); x.fillStyle = '#2b2e36'; x.fillRect(cx - 32, cy - 32, 64, 64); x.fillStyle = '#16171c'; x.fillRect(cx - 26, cy - 26, 52, 52); x.fillStyle = '#3a3e48'; x.fillRect(cx - 16, cy - 16, 32, 32); x.fillStyle = '#111'; x.fillRect(cx - 7, cy - 7, 14, 14); } });
    L(0.6, 216, x => { x.fillStyle = '#140a04'; for (let i = 0; i < 16; i++) { const sx = R() * W | 0, sh = 10 + R() * 40 | 0; x.fillRect(sx, 0, 8, sh); x.fillRect(sx + 2, sh, 4, 6); x.fillRect(sx + 3, sh + 6, 2, 4); } });
  } else if (theme === 's3') {
    L(0.06, 216, x => { for (let i = 0; i < 26; i++) { x.fillStyle = ['#1a0810', '#24101a', '#2e1220'][i % 3]; x.fillRect(R() * W | 0, R() * 90 | 0, 40 + R() * 80 | 0, 8 + R() * 14 | 0); } });
    L(0.28, 216, x => { for (let i = 0; i < 4; i++) { const bx = i * 128 + 10; const h = 90 + (i % 2) * 40; x.fillStyle = '#16060c'; x.fillRect(bx, 216 - h, 50, h); for (let k = 0; k < 4; k++) { x.fillStyle = '#2a0a14'; x.fillRect(bx - 4, 216 - h + k * 26, 58, 18); x.fillStyle = '#ff4f6a33'; x.fillRect(bx - 4, 216 - h + k * 26, 58, 2); } x.fillStyle = '#16060c'; for (let k = 0; k < 5; k++) x.fillRect(bx + k * 11, 216 - h - 8, 6, 8); x.fillStyle = '#ffd34f55'; x.fillRect(bx + 22, 216 - h + 40, 6, 8); } });
    L(0.6, 216, x => { for (let i = 0; i < 5; i++) { const cx = R() * W | 0; x.fillStyle = '#2a1018'; for (let y = 0; y < 50 + R() * 40; y += 4) x.fillRect(cx + (y / 4 % 2), y, 2, 3); x.fillStyle = '#c9a030'; x.fillRect(cx - 9, 92, 20, 2); x.fillRect(cx - 5, 90, 12, 2); } });
  } else {
    L(0.2, 216, x => { x.fillStyle = '#1e2a40'; for (let i = 0; i < 8; i++) x.fillRect(i * 64 + 8, 30, 48, 120); x.fillStyle = '#2a3a58'; for (let i = 0; i < 8; i++) for (let k = 0; k < 4; k++) x.fillRect(i * 64 + 14 + k * 10, 40, 6, 100); });
  }
  return layers;
}
