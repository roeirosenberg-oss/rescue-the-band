'use strict';
// =====================================================================
//  GAME CORE: physics, player, enemies, rescue loop, saving
// =====================================================================
const PHYS = { G: 900, MAXF: 420, SPEED: 92, ACC: 1100, DEC: 1500, AIR: 700, DRAG: 110, JUMP: 322, CUT: -130, COYOTE: 0.09, BUF: 0.12 };
const ATK = { windup: 0.07, swing: 0.11, recover: 0.16 };
const SOLID = '#WSMG';

const Game = {
  mode: 'gate', paused: false, time: 0, realT: 0, lvl: null, stage: 0, grid: null, tiles: null, bg: null,
  player: null, enemies: [], shots: [], parts: [], keys: [], cages: [], exits: [], cps: [], hearts: [], signs: [], actors: [], dummies: [],
  camX: 0, camY: 0, shake: 0, hitstop: 0, msgs: [], cut: null, fade: 0, fadeTarget: 0, card: null, boss: null, guardian: null, bossBar: null,
  gate: null, musicHold: 0, sv: null, swingId: 0, lightning: 0, nextLightning: 8, onFadeDone: null, stats: { hits: 0, swings: 0, misses: 0 }
};

// ---------------- saving ----------------
Game.newSave = () => ({ v: 1, stage: 1, rescued: [], completed: [], checkpoint: null, ss: { 1: {}, 2: {}, 3: {} } });
Game.loadSave = () => { const s = Store.get('rtb_save', null); return s && s.v === 1 ? s : null; };
Game.persist = () => { if (Game.mode === 'play') Store.set('rtb_save', Game.sv); };
Game.ss = () => Game.sv.ss[Game.stage] || (Game.sv.ss[Game.stage] = {});

// ---------------- tiles ----------------
Game.tileAt = (cx, cy) => {
  const g = Game.grid; if (cx < 0 || cx >= Game.lvl.w) return '#'; if (cy < 0 || cy >= Game.lvl.h) return '.'; return g[cy][cx];
};
Game.solid = (cx, cy) => SOLID.includes(Game.tileAt(cx, cy));
function moveBody(b, dt, opts = {}) {
  b.hitWall = false; const wasGround = b.onGround; b.onGround = false;
  // X
  b.x += b.vx * dt;
  const r0 = Math.floor(b.y / TILE), r1 = Math.floor((b.y + b.h - 0.01) / TILE);
  if (b.vx > 0) { const c = Math.floor((b.x + b.w - 0.01) / TILE); for (let r = r0; r <= r1; r++) if (Game.solid(c, r)) { b.x = c * TILE - b.w; b.vx = 0; b.hitWall = true; break; } }
  else if (b.vx < 0) { const c = Math.floor(b.x / TILE); for (let r = r0; r <= r1; r++) if (Game.solid(c, r)) { b.x = (c + 1) * TILE; b.vx = 0; b.hitWall = true; break; } }
  // Y
  const prevBottom = b.y + b.h;
  b.y += b.vy * dt;
  const c0 = Math.floor(b.x / TILE), c1 = Math.floor((b.x + b.w - 0.01) / TILE);
  if (b.vy >= 0) {
    const r = Math.floor((b.y + b.h) / TILE);
    for (let c = c0; c <= c1; c++) {
      const t = Game.tileAt(c, r);
      if (SOLID.includes(t) || (t === '=' && !opts.noPlat && prevBottom <= r * TILE + 1)) { b.y = r * TILE - b.h; b.landVy = b.vy; b.vy = 0; b.onGround = true; b.groundTile = t; break; }
    }
  } else {
    const r = Math.floor(b.y / TILE);
    for (let c = c0; c <= c1; c++) if (Game.solid(c, r)) { b.y = (r + 1) * TILE; b.vy = 0; break; }
  }
  b.justLanded = !wasGround && b.onGround;
}
Game.surfaceUnder = b => {
  const cx = Math.floor((b.x + b.w / 2) / TILE), cy = Math.floor((b.y + b.h + 1) / TILE);
  let t = Game.tileAt(cx, cy); if (t === '.' || t === '^') t = Game.tileAt(Math.floor((b.x + 1) / TILE), cy);
  return tileSurface(Game.lvl.theme, t);
};

// ---------------- particles & messages ----------------
function burst(x, y, n, cols, sp = 80, life = 0.5, grav = 300, size = 1) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = rand(sp * 0.3, sp); Game.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - sp * 0.3, life: rand(life * 0.5, life), max: life, col: cols[i % cols.length], grav, size }); }
}
function noteFx(x, y, col) { Game.parts.push({ x, y, vx: rand(-12, 12), vy: rand(-40, -25), life: 1.4, max: 1.4, col, grav: 0, note: true }); }
Game.msg = (text, dur = 2.5, col = '#fff') => { Game.msgs = Game.msgs.filter(m => m.text !== text); Game.msgs.push({ text, t: dur, col }); if (Game.msgs.length > 3) Game.msgs.shift(); };

// ---------------- stage loading ----------------
Game.loadStage = function (n, o = {}) {
  const L = LEVELS[n]; Game.lvl = L; Game.stage = L.stage; Game.grid = L.g.map(r => r.slice());
  Game.tiles = buildTileArt(L.theme); Game.bg = buildBackground(L.theme);
  Game.enemies = []; Game.shots = []; Game.parts = []; Game.keys = []; Game.cages = []; Game.exits = []; Game.cps = []; Game.hearts = []; Game.signs = []; Game.actors = []; Game.dummies = [];
  Game.boss = null; Game.guardian = null; Game.gate = null; Game.cut = null; Game.msgs = []; Game.musicHold = 0;
  const training = typeof n !== 'number';
  const ss = training ? {} : Game.ss();
  let start = null;
  for (const e of L.ents) {
    const X = e.col * TILE, Y = e.gy * TILE;
    switch (e.type) {
      case 'player': start = { x: X + 3, y: Y - 22 }; break;
      case 'cage': {
        const allIn = e.members.every(m => Game.sv && Game.sv.rescued.includes(m));
        Game.cages.push({ id: 'cage-' + e.stage, keyId: 'key-' + e.stage, stage: e.stage, x: X, y: Y - 44, w: 48, h: 44, members: e.members, col: STAGE_COL[e.stage], state: allIn ? 'open' : 'locked', doorOpen: allIn ? 1 : 0, dwell: 0, denied: false, lockT: 0, emptied: allIn });
        break;
      }
      case 'exit': Game.exits.push({ stage: e.stage, tutorial: !!e.tutorial, x: X + 2, y: Y - 36, w: 28, h: 36, open: !e.tutorial && !!(Game.sv && Game.sv.completed.includes(e.stage)) }); break;
      case 'checkpoint': Game.cps.push({ x: X, y: Y - 16, w: 16, h: 16, active: false }); break;
      case 'heart': Game.hearts.push({ x: X + 4, y: Y - 10, w: 8, h: 8 }); break;
      case 'sign': Game.signs.push({ x: X, y: Y, text: e.text }); break;
      case 'bossgate': Game.gate = { col: e.col, gy: e.gy, rows: e.rows, closed: false }; break;
      case 'dummy': Game.dummies.push({ type: 'dummy', x: X + 2, y: Y - 24, w: 12, h: 24, hits: 0, flash: 0, wob: 0, hp: 1e9, f: -1 }); break;
      default: {
        if ((e.type === 'guardian' || e.type === 'boss') && ss.guardianDefeated) break;
        const en = makeEnemy(e, X, Y); if (en) Game.enemies.push(en);
      }
    }
  }
  Game.boss = Game.enemies.find(e => e.type === 'boss') || null;
  // restore key state
  if (!training && Game.stage) {
    if (ss.key === 'dropped' && ss.keyPos) spawnKey(Game.stage, ss.keyPos.x, ss.keyPos.y, true);
  }
  // player
  const cp = (!training && Game.sv.checkpoint && Game.sv.checkpoint.stage === n) ? Game.sv.checkpoint : null;
  const pos = cp ? { x: cp.x, y: cp.y } : start;
  Game.player = makePlayer(pos.x, pos.y);
  if (!training && ss.key === 'collected') Game.player.keys.add('key-' + Game.stage);
  if (cp) { for (const c of Game.cps) if (Math.abs(c.x - cp.cx) < 2) c.active = true; }
  Game.spawn = { x: pos.x, y: pos.y };
  Game.camX = clamp(Game.player.x - VW / 2, 0, L.w * TILE - VW); Game.camY = clamp(Game.player.y - VH / 2, 0, L.h * TILE - VH);
  AudioMgr.setMusic(L.music, 'explore'); AudioMgr.setAmbient(L.theme); AudioMgr.duck(false);
  Game.card = null;
  if (!o.noCard) Game.card = { t: 2.4, title: training ? (L.cardTitle || 'TRAINING ROOM') : 'STAGE ' + n + '/3', sub: L.name, info: training ? (L.cardInfo || 'TEST CONTROLS, GESTURES AND SOUND') : stageBlurb(n) };
};
function stageBlurb(n) {
  return { 1: 'RESCUE MINA (KEYS) & VOLT (ELECTRONICS)', 2: 'RESCUE DEX (BASS) & RIFF (GUITAR)', 3: 'DEFEAT THE SILENCER. FREE BO (DRUMS)' }[n];
}
Game.respawnEnemies = function () {
  const L = Game.lvl, ss = Game.stage ? Game.ss() : {};
  Game.enemies = []; Game.shots = [];
  for (const e of L.ents) {
    if (!['gremlin', 'bat', 'amp', 'guardian', 'boss'].includes(e.type)) continue;
    if ((e.type === 'guardian' || e.type === 'boss') && ss.guardianDefeated) continue;
    Game.enemies.push(makeEnemy(e, e.col * TILE, e.gy * TILE));
  }
  if (Game.gate && Game.gate.closed) setGate(false);
};

// ---------------- player ----------------
function makePlayer(x, y) {
  return { x, y, w: 10, h: 22, vx: 0, vy: 0, f: 1, onGround: false, coyote: 0, jumpBuf: 0, jumpCut: false, hp: 5, maxHp: 5, inv: 0, hurtT: 0,
    frame: 0, frameT: 0, landT: 0, atk: null, atkBuf: 0, dead: false, deadT: 0, keys: new Set(), lock: false, pose: null, safe: { x, y }, safeT: 0, lastStep: -1 };
}
Game.playerAnim = function (p) {
  if (p.pose) return p.pose;
  if (p.dead) return 'dead';
  if (p.hurtT > 0) return 'hurt';
  if (p.atk) return 'attack';
  if (!p.onGround) return p.vy < 0 ? 'jump' : 'fall';
  if (p.landT > 0) return 'land';
  if (Math.abs(p.vx) > 12) return 'walk';
  return 'idle';
};
function startAttack(p) {
  p.atk = { t: 0, phase: 'windup', hit: new Set(), id: ++Game.swingId, sounded: false, connected: false };
  Game.stats.swings++;
}
function standAngle(a) {
  const t = a.t;
  if (t < ATK.windup) return lerp(0, -1.35, t / ATK.windup);
  if (t < ATK.windup + ATK.swing) { const k = (t - ATK.windup) / ATK.swing; return lerp(-1.35, 1.95, 1 - Math.pow(1 - k, 2)); }
  const k = (t - ATK.windup - ATK.swing) / ATK.recover; return lerp(1.95, 0, k);
}
// world-space sample points along the swinging stand (grip -> mic head)
function standPoints(p) {
  const th = standAngle(p.atk), f = p.f, ox = p.x + p.w / 2, oy = p.y + p.h;
  const gx = 1 + Math.sin(th) * 5, gy = -15 - Math.cos(th) * 5, pts = [];
  for (let i = 0; i <= 5; i++) { const L = i / 5 * 22; pts.push({ x: ox + f * (gx + Math.sin(th) * L), y: oy + gy - Math.cos(th) * L }); }
  return pts;
}
Game.updatePlayer = function (dt) {
  const p = Game.player, training = Game.mode === 'training';
  if (p.dead) {
    p.deadT += dt; p.vx *= 0.9; p.vy += PHYS.G * dt; moveBody(p, dt);
    if (p.deadT > 1.8) Game.respawn();
    return;
  }
  p.inv = Math.max(0, p.inv - dt); p.hurtT = Math.max(0, p.hurtT - dt); p.landT = Math.max(0, p.landT - dt);
  let dir = 0;
  if (!p.lock) {
    dir = Input.moveDir();
    if (Input.consume('jump')) { p.jumpBuf = PHYS.BUF; }
    if (Input.consume('attack')) { if (!p.atk) startAttack(p); else p.atkBuf = 0.15; }
  } else { Input.clear(); }
  if (p.hurtT > 0.15) dir = 0;
  // horizontal (stopping input never touches vertical velocity)
  const target = dir * PHYS.SPEED * (p.atk && p.onGround ? 0.55 : 1);
  if (dir !== 0 && !p.atk) p.f = dir;
  if (p.onGround) {
    const a = dir !== 0 ? PHYS.ACC : PHYS.DEC;
    p.vx = p.vx < target ? Math.min(target, p.vx + a * dt) : Math.max(target, p.vx - a * dt);
  } else if (dir !== 0) {
    p.vx = p.vx < target ? Math.min(target, p.vx + PHYS.AIR * dt) : Math.max(target, p.vx - PHYS.AIR * dt);
  } else { // preserve airborne momentum: gentle drag only
    p.vx = p.vx > 0 ? Math.max(0, p.vx - PHYS.DRAG * dt) : Math.min(0, p.vx + PHYS.DRAG * dt);
  }
  // jump
  p.coyote = p.onGround ? PHYS.COYOTE : p.coyote - dt;
  if (p.jumpBuf > 0) {
    p.jumpBuf -= dt;
    if (p.coyote > 0 && !p.lock) {
      p.vy = -PHYS.JUMP; p.onGround = false; p.coyote = 0; p.jumpBuf = 0; p.jumpCut = false;
      AudioMgr.play('jump'); if (Math.random() < 0.35) AudioMgr.play('jumpGrunt');
      burst(p.x + p.w / 2, p.y + p.h, 5, ['#fff8', '#ccc8'], 40, 0.3, 50);
      EventLog.push('JUMP');
    }
  }
  if (!p.jumpCut && p.vy < PHYS.CUT && !Input.jumpHeld()) { p.vy = PHYS.CUT; p.jumpCut = true; }
  // gravity + move
  p.vy = Math.min(PHYS.MAXF, p.vy + PHYS.G * dt);
  const wasGround = p.onGround;
  p.prevBottom = p.y + p.h;
  moveBody(p, dt);
  if (p.justLanded && !wasGround) {
    p.landT = 0.09; const s = clamp((p.landVy || 200) / 420, 0.2, 1);
    AudioMgr.play('land', { strength: s }); burst(p.x + p.w / 2, p.y + p.h, 4, ['#fff6'], 30, 0.25, 30);
    p.frame = 0; p.frameT = 0; p.lastStep = 0; EventLog.push('LAND');
  }
  // walk cycle + footstep sync on foot-contact frames (0 and 2)
  if (p.onGround && Math.abs(p.vx) > 12 && !p.atk) {
    p.frameT += dt * (Math.abs(p.vx) / PHYS.SPEED) * 9;
    const fr = Math.floor(p.frameT) % 4;
    if (fr !== p.frame) { p.frame = fr; if (fr === 0 || fr === 2) { AudioMgr.play('footstep', { surface: Game.surfaceUnder(p), vol: 0.9 }); EventLog.push('STEP ' + Game.surfaceUnder(p)); } }
  } else if (p.onGround) { p.frameT = 0; p.frame = 0; }
  // attack
  if (p.atk) {
    const a = p.atk; a.t += dt;
    const prevPhase = a.phase;
    a.phase = a.t < ATK.windup ? 'windup' : a.t < ATK.windup + ATK.swing ? 'swing' : 'recover';
    if (a.phase === 'swing' && !a.sounded) { a.sounded = true; AudioMgr.play('swing'); if (Math.random() < 0.45) AudioMgr.play('effort'); }
    if (a.phase === 'swing' || (prevPhase === 'swing' && a.phase === 'recover' && a.t - dt < ATK.windup + ATK.swing)) Game.swingHits(p);
    if (a.t >= ATK.windup + ATK.swing + ATK.recover) {
      if (!a.connected) Game.stats.misses++;
      p.atk = null; if (p.atkBuf > 0) { p.atkBuf = 0; startAttack(p); }
    }
  }
  p.atkBuf = Math.max(0, p.atkBuf - dt);
  // hazards
  const L = Game.lvl;
  const c0 = Math.floor(p.x / TILE), c1 = Math.floor((p.x + p.w - 0.01) / TILE), r0 = Math.floor(p.y / TILE), r1 = Math.floor((p.y + p.h - 0.01) / TILE);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (Game.tileAt(c, r) === '^' && p.y + p.h > r * TILE + 8) { Game.hurtPlayer(1, p.x + p.w / 2 - p.f * 4, true); }
  if (p.y > L.h * TILE + 24) {
    if (!p.dead) { Game.hurtPlayer(1, p.x, false, true); }
    if (!p.dead) { p.x = p.safe.x; p.y = p.safe.y; p.vx = p.vy = 0; p.inv = 1.2; }
  }
  // safe ground tracking
  if (p.onGround && SOLID.includes(p.groundTile) && p.inv === 0) {
    const ok = Game.solid(c0, r1 + 1) && Game.solid(c1, r1 + 1) && Game.tileAt(c0, r1) !== '^' && Game.tileAt(c1, r1) !== '^';
    if (ok) { p.safe.x = p.x; p.safe.y = p.y; }
  }
};
Game.swingHits = function (p) {
  const pts = standPoints(p), a = p.atk, cx = p.x + p.w / 2;
  const targets = Game.enemies.concat(Game.dummies);
  for (const e of targets) {
    if (e.dead || a.hit.has(e)) continue;
    const ecx = e.x + e.w / 2;
    if ((ecx - cx) * p.f < -4) continue; // forward hit area only
    let inside = false;
    for (const q of pts) if (q.x > e.x - 4 && q.x < e.x + e.w + 4 && q.y > e.y - 4 && q.y < e.y + e.h + 4) { inside = true; break; }
    if (!inside) continue;
    a.hit.add(e); a.connected = true; Game.stats.hits++;
    AudioMgr.play('impact', { heavy: e.type === 'boss' || e.type === 'guardian' });
    Game.hitstop = 0.05; Game.shake = Math.max(Game.shake, 2);
    const tip = pts[pts.length - 1]; burst(clamp(tip.x, e.x, e.x + e.w), clamp(tip.y, e.y, e.y + e.h), 8, ['#fff', '#ffd34f', STAGE_COL[Game.stage] || '#9cf'], 90, 0.35, 200);
    if (e.type === 'dummy') { e.hits++; e.flash = 0.12; e.wob = 0.4; EventLog.push('HIT DUMMY #' + e.hits); continue; }
    damageEnemy(e, 1, p.f);
    EventLog.push('HIT ' + e.type.toUpperCase());
  }
  for (const s of Game.shots) {
    if (s.dead || a.hit.has(s)) continue;
    for (const q of pts) if (Math.abs(q.x - s.x) < 7 && Math.abs(q.y - s.y) < 7) { s.dead = true; a.hit.add(s); AudioMgr.play('pop'); burst(s.x, s.y, 6, ['#ffd34f', '#fff'], 60, 0.3, 0); break; }
  }
};
Game.hurtPlayer = function (dmg, srcX, spike, pit) {
  const p = Game.player; if (p.dead || p.inv > 0 || (Game.cut && Game.cut.type !== 'none')) return false;
  p.hp -= dmg; p.inv = 1.1; p.hurtT = 0.3; p.atk = null;
  const d = (p.x + p.w / 2) < srcX ? -1 : 1;
  if (!pit) { p.vx = d * 140; p.vy = spike ? -230 : -170; }
  AudioMgr.play('pain'); AudioMgr.play('playerHurt'); Game.shake = 3;
  burst(p.x + p.w / 2, p.y + 8, 8, ['#ff3b5c', '#fff'], 70, 0.4);
  EventLog.push('DAMAGE -' + dmg);
  if (p.hp <= 0) {
    if (Game.mode === 'training' || Game.mode === 'tutorial') { p.hp = p.maxHp; Game.msg((Game.mode === 'tutorial' ? 'SAM' : 'TRAINING') + ': HEALTH REFILLED', 1.5); return true; }
    p.hp = 0; p.dead = true; p.deadT = 0; p.vy = -150; AudioMgr.play('defeat'); AudioMgr.setIntensity('silent');
    Game.sessionDeaths = (Game.sessionDeaths || 0) + 1;
  }
  return true;
};
Game.respawn = function () {
  const p = Game.player, sp = (Game.sv.checkpoint && Game.sv.checkpoint.stage === Game.stage) ? Game.sv.checkpoint : Game.spawn;
  const keys = p.keys; Game.player = makePlayer(sp.x, sp.y); Game.player.keys = keys; Game.player.inv = 1.0;
  Game.respawnEnemies(); Game.boss = Game.enemies.find(e => e.type === 'boss') || null;
  Game.hearts = []; for (const e of Game.lvl.ents) if (e.type === 'heart') Game.hearts.push({ x: e.col * TILE + 4, y: e.gy * TILE - 10, w: 8, h: 8 });
  AudioMgr.setMusic(Game.lvl.music, 'explore');
  Game.msg('BACK ON YOUR FEET!', 2);
  if (Game.sessionDeaths >= 5) Tip.open();   // once per page session, after the 5th death
};

// ---------------- enemies ----------------
function makeEnemy(e, X, Y) {
  const base = { type: e.type, f: e.f || -1, vx: 0, vy: 0, flash: 0, state: 'idle', st: 0, dead: false, seed: Math.random() * 10, showHp: 0, cd: rand(0.5, 1.5), onGround: false };
  const sc = STAGE_COL[e.type === 'guardian' ? (e.variant || 1) : Game.stage] || '#9cf';
  switch (e.type) {
    case 'gremlin': return Object.assign(base, { w: 14, h: 12, x: X + 1, y: Y - 12, hp: 2, maxHp: 2, state: 'patrol', col: ['#a34fe0', '#a34fe0', '#e0703a', '#e03a5a'][Game.stage] || '#a34fe0', colD: ['#6a2a99', '#6a2a99', '#904018', '#90182e'][Game.stage] || '#6a2a99' });
    case 'bat': return Object.assign(base, { w: 14, h: 8, x: X + 1, y: Y - 4, hx: X + 8, hy: Y, hp: 1, maxHp: 1, fly: true });
    case 'amp': return Object.assign(base, { w: 16, h: 16, x: X, y: Y - 16, hp: 3, maxHp: 3, f: e.f || -1, cd: rand(0.8, 1.6) });
    case 'guardian': return Object.assign(base, { w: 22, h: 38, x: X - 3, y: Y - 38, hp: e.hp, maxHp: e.hp, variant: e.variant, name: e.name, keyId: 'key-' + Game.stage, keyCol: STAGE_COL[Game.stage], engaged: false, guardian: true, atkN: 0 });
    case 'boss': return Object.assign(base, { w: 34, h: 56, x: X - 9, y: Y - 56, hp: e.hp, maxHp: e.hp, name: e.name, keyId: 'key-3', keyCol: STAGE_COL[3], engaged: false, guardian: true, phase2: false, pat: 0, state: 'sleep' });
  }
  return null;
}
const STOMP = { BOUNCE: 175, GRACE: 0.18 };
// Returns true when this frame's contact with e was a successful stomp.
Game.tryStomp = function (e, dt) {
  const p = Game.player;
  if (p.dead || p.lock || e.dead || p.vy <= 0 || p.onGround) return false;
  const bottom = p.y + p.h, prev = p.prevBottom !== undefined ? p.prevBottom : bottom;
  const top = e.y, tol = 4 + Math.abs(e.vy || 0) * dt;
  // feet must have been above the head last frame and now reach into the top of the enemy, with horizontal overlap
  if (prev > top + tol || bottom < top - 1 || bottom > top + Math.max(6, Math.min(12, e.h * 0.5))) return false;
  if (p.x + p.w <= e.x + 1 || p.x >= e.x + e.w - 1) return false;
  if (e.stompGrace > 0) return true;           // already stomped; ignore lingering overlap
  e.stompGrace = STOMP.GRACE; e.stompCount = (e.stompCount || 0) + 1;
  p.vy = -STOMP.BOUNCE; p.jumpCut = true; p.coyote = 0; p.jumpBuf = 0;
  p.y = Math.min(p.y, top - p.h);
  const dir = sign(e.x + e.w / 2 - (p.x + p.w / 2)) || p.f;
  AudioMgr.play('impact', { heavy: e.type === 'boss' || e.type === 'guardian' });
  Game.hitstop = 0.05; Game.shake = Math.max(Game.shake, 2); Game.stats.stomps = (Game.stats.stomps || 0) + 1;
  burst(p.x + p.w / 2, top, 10, ['#fff', '#ffd34f', STAGE_COL[Game.stage] || '#9cf'], 80, 0.35, 150);
  if (e.type === 'dummy') { e.hits++; e.flash = 0.12; e.wob = 0.4; EventLog.push('STOMP DUMMY #' + e.hits); return true; }
  const keepVy = e.vy;
  damageEnemy(e, 1, dir);
  if (e.fly || e.type === 'boss' || e.type === 'guardian') e.vy = keepVy;  // no upward knock on stomp for flyers/heavies
  EventLog.push('STOMP ' + e.type.toUpperCase());
  return true;
};
function damageEnemy(e, n, dir) {
  if (e.dead) return;
  e.hp -= n; e.flash = 0.12; e.showHp = 2.5;
  const heavy = e.type === 'boss' ? 0 : e.type === 'guardian' ? 0.35 : 1;
  if (!e.fly) { e.vx = dir * 130 * heavy; if (heavy) e.vy = -90 * heavy; } else { e.kx = dir * 120; }
  if (e.type === 'gremlin' || e.type === 'bat') { e.state = e.fly ? 'return' : 'stun'; e.st = 0.3; }
  if (e.type === 'guardian' || e.type === 'boss') { e.engaged = true; }
  AudioMgr.play('enemyHurt', { pitch: e.type === 'boss' ? 0.5 : e.type === 'guardian' ? 0.7 : 1 });
  if (e.hp <= 0) killEnemy(e);
  else if (e.type === 'boss' && !e.phase2 && e.hp <= e.maxHp / 2) { e.phase2 = true; AudioMgr.play('roar'); Game.msg('THE SILENCER IS ENRAGED!', 2.2, '#ff6a6a'); Game.shake = 4; }
}
function killEnemy(e) {
  e.dead = true; e.deadT = 0;
  AudioMgr.play('enemyDie', { pitch: e.guardian ? 0.6 : 1 });
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  burst(cx, cy, e.guardian ? 40 : 14, ['#fff', e.col || '#c7f', '#ffd34f', '#555'], e.guardian ? 140 : 90, e.guardian ? 0.9 : 0.5);
  if (e.keyId) {
    // designated guardian ALWAYS drops its stage key (deterministic, never random loot)
    const ss = Game.ss(); ss.guardianDefeated = true;
    spawnKey(Game.stage, cx - 4, e.y + e.h - 20, false);
    Game.persist();
    AudioMgr.play('keyDrop');
    Game.msg(e.type === 'boss' ? 'THE SILENCER FALLS! GRAB THE KEY!' : e.name + ' DROPPED THE KEY!', 3, STAGE_COL[Game.stage]);
    if (e.type === 'boss') { setGate(false); Game.shake = 6; AudioMgr.setMusic(Game.lvl.music, 'explore'); }
    Game.bossBar = null;
  }
}
function spawnKey(stage, x, y, restored) {
  const id = 'key-' + stage;
  if (Game.keys.some(k => k.id === id) || Game.player && Game.player.keys.has(id)) return;
  Game.keys.push({ id, stage, x, y, w: 9, h: 6, vx: restored ? 0 : rand(-30, 30), vy: restored ? 0 : -190, col: STAGE_COL[stage], state: 'dropped', onGround: restored, bounced: restored });
  if (!restored) { const ss = Game.ss(); ss.key = 'dropped'; ss.keyPos = { x, y }; }
}
function setGate(close) {
  const g = Game.gate; if (!g) return;
  g.closed = close;
  for (let r = g.gy - g.rows; r < g.gy; r++) Game.grid[r][g.col] = close ? 'G' : '.';
}
Game.updateEnemies = function (dt) {
  const p = Game.player, pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
  let near = false;
  for (const e of Game.enemies) {
    if (e.dead) { e.deadT += dt; continue; }
    e.flash = Math.max(0, e.flash - dt); e.showHp = Math.max(0, e.showHp - dt); e.cd = Math.max(0, e.cd - dt); e.st -= dt;
    const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2, dx = pcx - ecx, dy = pcy - ecy, dist = Math.hypot(dx, dy);
    if (dist < 130 && !p.dead) near = true;
    ENEMY_AI[e.type](e, dt, dx, dy, dist);
    e.stompGrace = Math.max(0, (e.stompGrace || 0) - dt);
    // stomp: falling onto the enemy's head damages it and bounces the player (never hurts the player)
    if (Game.tryStomp(e, dt)) continue;
    // contact damage
    if (!p.dead && e.stompGrace === 0 && overlap({ x: e.x + 2, y: e.y + 2, w: e.w - 4, h: e.h - 2 }, p) && e.state !== 'stun') Game.hurtPlayer(1, ecx);
  }
  Game.enemies = Game.enemies.filter(e => !e.dead || e.deadT < 0.1);
  // projectiles & shockwaves
  for (const s of Game.shots) {
    s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.kind === 'shock') { if (Game.solid(Math.floor(s.x / TILE), Math.floor((s.y - 4) / TILE)) || !Game.solid(Math.floor(s.x / TILE), Math.floor((s.y + 2) / TILE))) s.dead = true; }
    else if (Game.solid(Math.floor(s.x / TILE), Math.floor(s.y / TILE))) { s.dead = true; burst(s.x, s.y, 4, ['#fff'], 40, 0.2, 0); }
    if (s.life <= 0) s.dead = true;
    const hb = s.kind === 'shock' ? { x: s.x - 4, y: s.y - s.h, w: 8, h: s.h } : { x: s.x - 3, y: s.y - 3, w: 6, h: 6 };
    if (!s.dead && overlap(hb, p)) { if (Game.hurtPlayer(1, s.x)) { if (s.kind !== 'shock') s.dead = true; } }
  }
  Game.shots = Game.shots.filter(s => !s.dead);
  return near;
};
const ENEMY_AI = {
  gremlin(e, dt, dx, dy, dist) {
    e.vy = Math.min(PHYS.MAXF, e.vy + PHYS.G * dt);
    if (e.state === 'patrol') {
      e.vx = e.f * 26;
      if (Math.abs(dx) < 72 && Math.abs(dy) < 18 && e.cd === 0 && sign(dx) === e.f) { e.state = 'windup'; e.st = 0.38; e.vx = 0; AudioMgr.play('enemyAttack', { pitch: 1.4 }); }
    } else if (e.state === 'windup') { e.vx = 0; if (e.st <= 0) { e.state = 'lunge'; e.vx = e.f * 120; e.vy = -150; e.st = 0.6; } }
    else if (e.state === 'lunge') { if (e.onGround && e.st < 0.45) { e.state = 'patrol'; e.cd = 1.3; } }
    else if (e.state === 'stun') { e.vx *= 0.9; if (e.st <= 0) e.state = 'patrol'; }
    moveBody(e, dt);
    if (e.state === 'patrol' && e.onGround) {
      const ahead = Math.floor((e.f > 0 ? e.x + e.w + 1 : e.x - 1) / TILE), below = Math.floor((e.y + e.h + 2) / TILE);
      const ft = Game.tileAt(ahead, below);
      if (e.hitWall || !(SOLID.includes(ft) || ft === '=') || Game.tileAt(ahead, below - 1) === '^') e.f *= -1;
    } else if (e.hitWall) e.f *= -1;
  },
  bat(e, dt, dx, dy, dist) {
    e.t = (e.t || 0) + dt; e.kx = (e.kx || 0) * 0.9;
    if (e.state === 'idle') {
      const tx = e.hx + Math.sin(e.t * 1.3 + e.seed) * 26 - e.w / 2, ty = e.hy + Math.sin(e.t * 2.6) * 6 - e.h / 2;
      e.x = lerp(e.x, tx, 0.08); e.y = lerp(e.y, ty, 0.08); e.f = dx > 0 ? 1 : -1;
      if (dist < 95 && e.cd === 0) { e.state = 'windup'; e.st = 0.5; AudioMgr.play('enemyAttack', { pitch: 2.2 }); }
    } else if (e.state === 'windup') { if (e.st <= 0) { const p = Game.player; const ang = Math.atan2(p.y + p.h / 2 - (e.y + e.h / 2), p.x + p.w / 2 - (e.x + e.w / 2)); e.vx = Math.cos(ang) * 135; e.vy = Math.sin(ang) * 135; e.state = 'swoop'; e.st = 0.75; } }
    else if (e.state === 'swoop') { e.x += e.vx * dt; e.y += e.vy * dt; if (e.st <= 0) { e.state = 'return'; } }
    else if (e.state === 'return') { const tx = e.hx - e.w / 2, ty = e.hy - e.h / 2, d = Math.hypot(tx - e.x, ty - e.y); if (d < 3) { e.state = 'idle'; e.cd = 1.4; } else { e.x += (tx - e.x) / d * 60 * dt; e.y += (ty - e.y) / d * 60 * dt; } }
    e.x += e.kx * dt;
  },
  amp(e, dt, dx, dy, dist) {
    e.vy = Math.min(PHYS.MAXF, e.vy + PHYS.G * dt); e.vx *= 0.8; moveBody(e, dt);
    if (Math.abs(dx) < 230) e.f = dx > 0 ? 1 : -1;
    if (e.state === 'idle') { if (e.cd === 0 && Math.abs(dx) < 220 && Math.abs(dy) < 70) { e.state = 'windup'; e.st = 0.65; AudioMgr.play('warn', {}); } }
    else if (e.state === 'windup' && e.st <= 0) {
      Game.shots.push({ kind: 'note', x: e.x + e.w / 2 + e.f * 9, y: e.y + 7, vx: e.f * 82, vy: 0, life: 4 }); AudioMgr.play('shoot');
      e.state = 'idle'; e.cd = 1.9;
    }
  },
  guardian(e, dt, dx, dy, dist) {
    e.vy = Math.min(PHYS.MAXF, e.vy + PHYS.G * dt);
    if (!e.engaged && Math.abs(dx) < 170 && Math.abs(dy) < 60) { e.engaged = true; AudioMgr.play('roar'); Game.msg(e.name + ' GUARDS THE KEY!', 2.2, e.keyCol); }
    if (e.engaged) Game.bossBar = e;
    const v2 = e.variant === 2;
    switch (e.state) {
      case 'idle': e.vx *= 0.8; if (e.engaged) e.state = 'walk'; break;
      case 'walk':
        e.f = dx > 0 ? 1 : -1; e.vx = e.f * (v2 ? 30 : 36);
        if (e.cd === 0 && Math.abs(dx) < (v2 && e.atkN % 2 === 1 ? 150 : 44) && Math.abs(dy) < 40) { e.state = 'windup'; e.st = v2 && e.atkN % 2 === 1 ? 0.75 : 0.6; e.vx = 0; AudioMgr.play('warn', { boss: true }); }
        break;
      case 'windup': e.vx = 0; if (e.st <= 0) {
        if (v2 && e.atkN % 2 === 1) { e.state = 'charge'; e.st = 0.8; e.vx = e.f * 155; AudioMgr.play('enemyAttack', { pitch: 0.6 }); }
        else {
          e.state = 'attack'; e.st = 0.3; AudioMgr.play('enemyAttack', { pitch: 0.7 }); Game.shake = 3;
          const hb = { x: e.f > 0 ? e.x + e.w - 4 : e.x - 30, y: e.y + 4, w: 34, h: e.h - 4 };
          if (overlap(hb, Game.player)) Game.hurtPlayer(1, e.x + e.w / 2);
          Game.shots.push({ kind: 'shock', x: e.x + e.w / 2 + e.f * 24, y: e.y + e.h, vx: e.f * 95, vy: 0, h: 9, life: 1.0 }); AudioMgr.play('shockwave');
        }
        e.atkN++;
      } break;
      case 'charge': if (e.hitWall || e.st <= 0) { e.state = 'recover'; e.st = 0.9; e.vx = 0; if (e.hitWall) { Game.shake = 3; AudioMgr.play('land', { strength: 1 }); } } break;
      case 'attack': e.vx = 0; if (e.st <= 0) { e.state = 'recover'; e.st = 0.75; } break;
      case 'recover': e.vx *= 0.85; if (e.st <= 0) { e.state = 'walk'; e.cd = 0.6; } break;
    }
    moveBody(e, dt);
  },
  boss(e, dt, dx, dy, dist) {
    e.vy = Math.min(PHYS.MAXF, e.vy + PHYS.G * dt);
    const g = Game.gate, p = Game.player, sp = e.phase2 ? 1.3 : 1;
    if (e.state === 'sleep') {
      if (g && p.x > (g.col + 2) * TILE && !p.dead) { setGate(true); e.engaged = true; e.state = 'intro'; e.st = 1.6; AudioMgr.play('roar'); AudioMgr.setMusic(Game.lvl.music, 'danger'); Game.msg('THE SILENCER: NO MORE MUSIC!', 2.6, '#ff6a6a'); Game.shake = 4; }
      moveBody(e, dt); return;
    }
    Game.bossBar = e;
    switch (e.state) {
      case 'intro': if (e.st <= 0) { e.state = 'walk'; e.st = 1.0; } break;
      case 'walk':
        e.f = dx > 0 ? 1 : -1; e.vx = e.f * 28 * sp;
        if (e.st <= 0) {
          const pats = ['stomp', 'leap', 'orbs']; const pat = pats[e.pat++ % 3];
          e.vx = 0; AudioMgr.play('warn', { boss: true });
          if (pat === 'stomp') { e.state = 'warnStomp'; e.st = 0.85 / sp; }
          if (pat === 'leap') { e.state = 'warnLeap'; e.st = 0.65 / sp; e.tx = clamp(p.x + p.w / 2, (g.col + 2) * TILE, (Game.lvl.w - 5) * TILE); }
          if (pat === 'orbs') { e.state = 'warnOrbs'; e.st = 0.75 / sp; }
        } break;
      case 'warnStomp': e.vx = 0; if (e.st <= 0) { bossShock(e, 135 * sp, 1.6, 12); if (e.phase2) e.second = 0.45; e.state = 'recover'; e.st = 1.1; } break;
      case 'warnLeap': e.vx = 0; if (e.st <= 0) { const T = 0.85; e.vy = -0.5 * PHYS.G * T; e.vx = (e.tx - (e.x + e.w / 2)) / T; e.state = 'leap'; e.st = 2; AudioMgr.play('jump'); } break;
      case 'leap': if ((e.onGround && e.st < 1.9) || e.st <= 0) { e.vx = 0; bossShock(e, 95, 0.7, 9); e.state = 'recover'; e.st = 0.95; } break;
      case 'warnOrbs': e.vx = 0; if (e.st <= 0) {
        const n = e.phase2 ? 5 : 3, base = Math.atan2(p.y + p.h / 2 - (e.y + 20), p.x + p.w / 2 - (e.x + e.w / 2));
        for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.28; Game.shots.push({ kind: 'orb', x: e.x + e.w / 2 + Math.cos(a) * 20, y: e.y + 20, vx: Math.cos(a) * 78, vy: Math.sin(a) * 78, life: 5 }); }
        AudioMgr.play('orb'); e.state = 'recover'; e.st = 1.0;
      } break;
      case 'recover': e.vx *= 0.85; if (e.second !== undefined) { e.second -= dt; if (e.second <= 0) { bossShock(e, 160, 1.4, 10); delete e.second; } } if (e.st <= 0) { e.state = 'walk'; e.st = e.phase2 ? 0.7 : 1.1; } break;
    }
    moveBody(e, dt);
  }
};
function bossShock(e, speed, life, h) {
  Game.shake = 5; AudioMgr.play('shockwave');
  const y = e.y + e.h;
  Game.shots.push({ kind: 'shock', x: e.x - 2, y, vx: -speed, vy: 0, h, life });
  Game.shots.push({ kind: 'shock', x: e.x + e.w + 2, y, vx: speed, vy: 0, h, life });
  burst(e.x + e.w / 2, y, 16, ['#ff6', '#f84', '#fff'], 120, 0.5);
}

// ---------------- items, cages, rescue ----------------
Game.updateItems = function (dt) {
  const p = Game.player;
  for (const k of Game.keys) {
    if (k.state !== 'dropped') continue;
    if (!k.onGround) {
      k.vy = Math.min(PHYS.MAXF, k.vy + PHYS.G * dt); moveBody(k, dt);
      if (k.justLanded) { if (!k.bounced) { k.bounced = true; k.vy = -90; k.onGround = false; AudioMgr.play('keyBounce'); } else { k.vx = 0; const ss = Game.ss(); ss.keyPos = { x: k.x, y: k.y }; Game.persist(); } }
      if (k.y > Game.lvl.h * TILE) { k.x = Game.player.safe.x; k.y = Game.player.safe.y; k.vy = 0; } // never lose a key in a pit
    }
    if (!p.dead && overlap({ x: k.x - 4, y: k.y - 6, w: k.w + 8, h: k.h + 10 }, p)) {
      k.state = 'collected'; p.keys.add(k.id);
      const ss = Game.ss(); ss.key = 'collected'; Game.persist();
      AudioMgr.play('keyPickup'); burst(k.x + 4, k.y, 14, [k.col, '#fff'], 80, 0.6);
      Game.msg('GOT CAGE KEY ' + k.stage + '! RETURN TO THE CAGE', 3.2, k.col);
      EventLog.push('KEY ' + k.id);
    }
  }
  Game.keys = Game.keys.filter(k => k.state === 'dropped');
  for (const h of Game.hearts) if (!h.taken && overlap(h, p) && p.hp < p.maxHp) { h.taken = true; p.hp = Math.min(p.maxHp, p.hp + 2); AudioMgr.play('heal'); burst(h.x + 4, h.y + 4, 8, ['#ff3b5c', '#fff'], 50, 0.4); }
  Game.hearts = Game.hearts.filter(h => !h.taken);
  for (const c of Game.cps) {
    if (!c.active && overlap({ x: c.x, y: c.y - 16, w: 16, h: 32 }, p)) {
      Game.cps.forEach(o => o.active = false); c.active = true;
      Game.sv.checkpoint = { stage: Game.stage, x: c.x + 3, y: c.y + 16 - p.h, cx: c.x };
      Game.spawn = { x: c.x + 3, y: c.y + 16 - p.h };
      Game.persist(); AudioMgr.play('checkpoint'); Game.msg('CHECKPOINT', 1.5, '#7f7');
      if (p.hp < 3) p.hp = 3;
    }
  }
  // cages
  for (const c of Game.cages) {
    if (c.state !== 'locked' || Game.cut) continue;
    const zone = { x: c.x - 8, y: c.y, w: c.w + 16, h: c.h };
    if (overlap(zone, p) && p.onGround && !p.dead) {
      if (p.keys.has(c.keyId)) {
        c.dwell += dt;
        if (c.dwell >= 0.3 || Input.interactHeld()) Game.startRescue(c);
      } else if (!c.denied) { c.denied = true; AudioMgr.play('locked'); Game.msg('LOCKED! DEFEAT THE GUARDIAN FOR KEY ' + c.stage, 2.6, c.col); }
    } else { c.dwell = 0; c.denied = false; }
  }
  // exits
  for (const d of Game.exits) {
    if (d.open && !Game.cut && !p.dead && overlap({ x: d.x + 6, y: d.y, w: d.w - 12, h: d.h }, p) && !Game.transitioning) {
      if (d.tutorial) { Tutorial.finish(); continue; }
      Game.transitioning = true; AudioMgr.play('door');
      Game.fadeTo(1, () => { Game.transitioning = false; Game.sv.stage = d.stage + 1; Game.sv.checkpoint = null; Game.persist(); Game.loadStage(d.stage + 1); Game.fadeTo(0); });
    }
  }
};
Game.startRescue = function (c) {
  // guard: a cage can only open once, and only with its matching key
  if (c.state !== 'locked' || !Game.player.keys.has(c.keyId)) return;
  c.state = 'unlocking'; c.lockT = 0;
  const p = Game.player; p.lock = true; p.vx = 0; p.atk = null; p.f = (c.x + c.w / 2) > (p.x + p.w / 2) ? 1 : -1; p.pose = 'unlock';
  Game.cut = { type: 'rescue', cage: c, t: 0, step: 0, cueStarted: false, cueDone: false };
  EventLog.push('UNLOCK ' + c.id);
};
Game.updateCutscene = function (dt) {
  const C = Game.cut; if (!C || C.type !== 'rescue') return;
  const c = C.cage, p = Game.player; C.t += dt; c.lockT = C.t;
  const at = (time, fn) => { if (C.t >= time && C.step < time * 100) { C.step = time * 100; fn(); } };
  at(0.6, () => { AudioMgr.play('unlock'); burst(c.x + c.w / 2 + 5, c.y + c.h / 2, 12, [c.col, '#fff'], 70, 0.5); });
  at(0.9, () => { c.state = 'open'; AudioMgr.play('cageOpen'); p.keys.delete(c.keyId); const ss = Game.ss(); ss.key = 'used'; });
  if (c.state === 'open') c.doorOpen = Math.min(1, c.doorOpen + dt * 3);
  at(1.2, () => {
    c.emptied = true;
    c.members.forEach((m, i) => {
      const tx = c.members.length === 1 ? c.x - 34 : (i === 0 ? c.x - 14 : c.x + c.w + 14);
      Game.actors.push({ id: m, x: c.x + c.w / 2 + (i ? 6 : -6), y: c.y + c.h, tx, f: tx > c.x + c.w / 2 ? 1 : -1, anim: 'walk', t: 0 });
      AudioMgr.play('woo', { pitch: [1, 1.15, 0.85, 1.25, 0.9][BAND_ORDER.indexOf(m)], delay: i * 0.15 });
    });
    // record the rescue exactly once
    for (const m of c.members) if (!Game.sv.rescued.includes(m)) Game.sv.rescued.push(m);
    if (!Game.sv.completed.includes(c.stage)) Game.sv.completed.push(c.stage);
    Game.persist();
  });
  for (const a of Game.actors) { a.t += dt; if (a.anim === 'walk') { const d = a.tx - a.x; if (Math.abs(d) < 1) { a.x = a.tx; a.anim = 'celebrate'; } else a.x += sign(d) * Math.min(Math.abs(d), 40 * dt); } }
  at(2.0, () => { p.pose = 'celebrate'; AudioMgr.play('yeah'); Game.actors.forEach(a => { a.anim = 'celebrate'; a.f = -sign(a.x - (p.x + p.w / 2)) || 1; }); });
  at(2.7, () => {
    if (C.cueStarted) return; C.cueStarted = true;
    p.pose = null; Game.actors.forEach(a => { a.anim = 'play'; });
    const names = c.members.map(m => BAND[m].name).join(' & ');
    Game.msg('~ ' + names + (c.members.length > 1 ? ' ARE' : ' IS') + ' BACK! ~', 8, c.col);
    C.cueAt = C.t;
    AudioMgr.playCue(c.stage, () => { C.cueDone = true; });
  });
  if (C.cueStarted && !C.cueDone && C.t - C.cueAt > 8.6) C.cueDone = true; // safety if audio unavailable
  if (C.cueStarted && !C.cueDone) { if (Math.random() < dt * 5) { const a = Game.actors[irand(0, Game.actors.length - 1)]; if (a) noteFx(a.x + rand(-6, 6), a.y - 26, c.col); } }
  if (C.cueDone && !C.finished) {
    C.finished = true;
    Game.actors.forEach(a => a.anim = 'wave');
    p.lock = false; p.pose = null;
    if (c.stage < 3) {
      const ex = Game.exits.find(d => d.stage === c.stage); if (ex) { ex.open = true; AudioMgr.play('door'); }
      Game.msg('THE EXIT IS OPEN! HEAD TO THE DOOR', 3.5, '#7f7');
      Game.cut = null;
    } else {
      Game.cut = { type: 'final', t: 0 };
      Game.msg('ALL 5 MUSICIANS RESCUED!', 3.5, '#ffd34f');
      AudioMgr.play('cheer', { strength: 0.5, dur: 2 });
    }
  }
};

// ---------------- main play update ----------------
Game.update = function (dt) {
  Game.time += dt;
  if (Game.card) { Game.card.t -= dt; if (Game.card.t <= 0) Game.card = null; }
  for (const m of Game.msgs) m.t -= dt; Game.msgs = Game.msgs.filter(m => m.t > 0);
  if (Game.hitstop > 0) { Game.hitstop -= dt; return; }
  const frozen = Game.card && Game.card.t > 0.6;
  if (Game.cut && Game.cut.type === 'final') {
    Game.cut.t += dt;
    for (const a of Game.actors) a.t += dt;
    if (Game.cut.t > 3.0 && !Game.cut.go) { Game.cut.go = true; Game.fadeTo(1, () => Concert.start()); }
  }
  if (!frozen) {
    Game.updatePlayer(dt);
    Game.bossBar = null;
    const near = (Game.cut && Game.cut.type === 'rescue') ? false : Game.updateEnemies(dt);
    Game.updateItems(dt);
    Game.updateCutscene(dt);
    for (const d of Game.dummies) { d.flash = Math.max(0, d.flash - dt); d.wob = Math.max(0, d.wob - dt); d.stompGrace = Math.max(0, (d.stompGrace || 0) - dt); d.vy = 0; Game.tryStomp(d, dt); }
    // adaptive music
    if (!Game.player.dead && !Game.cut) {
      if (Game.boss && Game.boss.engaged && !Game.boss.dead) AudioMgr.setIntensity('danger');
      else { if (near || Game.bossBar) Game.musicHold = 2.5; Game.musicHold -= dt; AudioMgr.setIntensity(Game.musicHold > 0 ? 'combat' : 'explore'); }
    }
  } else Input.clear();
  for (const q of Game.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt; }
  Game.parts = Game.parts.filter(q => q.life > 0);
  if (Game.parts.length > 400) Game.parts.splice(0, Game.parts.length - 400);
  // camera
  const p = Game.player, L = Game.lvl;
  const tx = clamp(p.x + p.w / 2 - VW / 2 + p.f * 30, 0, L.w * TILE - VW), ty = clamp(p.y + p.h / 2 - VH * 0.55, 0, L.h * TILE - VH);
  Game.camX = lerp(Game.camX, tx, 1 - Math.pow(0.002, dt)); Game.camY = lerp(Game.camY, ty, 1 - Math.pow(0.01, dt));
  Game.shake = Math.max(0, Game.shake - dt * 12);
  if (L.theme === 's3') { Game.nextLightning -= dt; Game.lightning = Math.max(0, Game.lightning - dt * 3); if (Game.nextLightning <= 0) { Game.lightning = 1; Game.nextLightning = rand(7, 14); Game.thunderT = 0.35; }
    if (Game.thunderT > 0) { Game.thunderT -= dt; if (Game.thunderT <= 0) AudioMgr.play('thunder'); } }
};
Game.fadeTo = function (v, cb) { Game.fadeTarget = v; Game.onFadeDone = cb || null; };
Game.updateFade = function (dt) {
  if (Game.fade !== Game.fadeTarget) {
    Game.fade = Game.fadeTarget > Game.fade ? Math.min(Game.fadeTarget, Game.fade + dt * 2.5) : Math.max(Game.fadeTarget, Game.fade - dt * 2.5);
    if (Game.fade === Game.fadeTarget && Game.onFadeDone) { const cb = Game.onFadeDone; Game.onFadeDone = null; cb(); }
  }
};

// ---------------- rendering ----------------
Game.render = function (ctx) {
  const L = Game.lvl, th = THEMES[L.theme];
  const sx = Game.shake > 0 ? Math.round(rand(-Game.shake, Game.shake)) : 0, sy = Game.shake > 0 ? Math.round(rand(-Game.shake, Game.shake)) : 0;
  const cx = Math.round(Game.camX) + sx, cy = Math.round(Game.camY) + sy, t = Game.time;
  // sky
  const gr = ctx.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, th.grad[0]); gr.addColorStop(0.6, th.grad[1]); gr.addColorStop(1, th.grad[2]);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
  if (Game.lightning > 0) { ctx.fillStyle = `rgba(255,200,220,${Game.lightning * 0.35})`; ctx.fillRect(0, 0, VW, VH); }
  for (const l of Game.bg) {
    const ox = -Math.round(cx * l.par) % 512, oy = -Math.round(cy * l.par * 0.5);
    for (let x = ox - 512; x < VW; x += 512) ctx.drawImage(l.c, x, oy);
  }
  if (L.theme === 's2') { // pulsing bass rings on the speaker layer
    const ph = (t * 1.5) % 1; ctx.strokeStyle = `rgba(255,165,58,${0.25 * (1 - ph)})`; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { const sx2 = 80 + i * 170 - Math.round(cx * 0.35) % 512; for (const off of [0, 512, -512]) { ctx.strokeRect(Math.round(sx2 + off - 30 - ph * 20), Math.round(100 + (i % 2) * 30 - cy * 0.17 - 30 - ph * 20), Math.round(60 + ph * 40), Math.round(60 + ph * 40)); } }
  }
  ctx.save(); ctx.translate(-cx, -cy);
  // tiles
  const c0 = Math.max(0, Math.floor(cx / TILE)), c1 = Math.min(L.w - 1, Math.floor((cx + VW) / TILE)), r0 = Math.max(0, Math.floor(cy / TILE)), r1 = Math.min(L.h - 1, Math.floor((cy + VH) / TILE));
  const T = Game.tiles;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const ch = Game.grid[r][c]; if (ch === '.') continue;
    let img;
    if (ch === '=' || ch === '^' || ch === 'G') img = T[ch];
    else { const above = r > 0 ? Game.grid[r - 1][c] : '.'; const top = !SOLID.includes(above); img = T[ch + (top ? 'top' : '')] || T[ch]; }
    if (img) ctx.drawImage(img, c * TILE, r * TILE);
  }
  // signs
  for (const s of Game.signs) { ctx.fillStyle = '#0008'; const w = textWidth(s.text) + 6; ctx.fillRect(s.x - 1, s.y - 22, w, 9); drawText(ctx, s.text, s.x + 2, s.y - 20, th.accent); ctx.fillStyle = '#6a5040'; ctx.fillRect(s.x + 4, s.y - 13, 2, 13); }
  for (const d of Game.exits) drawExit(ctx, d, t);
  for (const c of Game.cps) drawCheckpoint(ctx, c, t);
  for (const c of Game.cages) {
    if (!c.emptied) c.members.forEach((m, i) => drawMember(ctx, m, c.x + (c.members.length === 1 ? 24 : 14 + i * 20), c.y + c.h - 4, i ? -1 : 1, { anim: 'caged', t: t + i }));
    drawCage(ctx, c, t, Game.player.keys.has(c.keyId));
    if (!c.emptied && !c.state.startsWith('un') && (t * 1.2 | 0) % 3 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(c.x + 2, c.y - 20, 22, 9); drawText(ctx, 'HELP!', c.x + 4, c.y - 18, '#c22'); }
    if (Game.cut && Game.cut.cage === c && Game.cut.t < 0.65) { // key flying into the lock
      const k = Game.cut.t / 0.65, p = Game.player, sx0 = p.x + p.w / 2 + p.f * 10, sy0 = p.y + 8, ex = c.x + c.w / 2 + 3, ey = c.y + c.h / 2 - 2;
      drawKeyShape(new Painter(ctx, 0, 0, 1), lerp(sx0, ex, k) | 0, (lerp(sy0, ey, k) - Math.sin(k * Math.PI) * 10) | 0, c.col);
    }
  }
  for (const h of Game.hearts) drawHeart(ctx, Math.round(h.x), Math.round(h.y + Math.sin(t * 4) * 1.5), true);
  for (const k of Game.keys) drawKeyItem(ctx, k, t);
  for (const d of Game.dummies) {
    const p = new Painter(ctx, d.x + d.w / 2 + (d.wob > 0 ? Math.round(Math.sin(d.wob * 40) * 2) : 0), d.y + d.h, 1); const col = d.flash > 0 ? '#fff' : '#c8a060';
    p.r(-1, -6, 3, 6, '#6a5040'); p.r(-6, -8, 12, 2, '#6a5040'); p.r(-5, -22, 10, 15, col); p.r(-4, -26, 8, 5, col); p.r(-2, -24, 1, 1, '#000'); p.r(1, -24, 1, 1, '#000'); p.r(-5, -16, 10, 1, '#a07040');
    drawTextC(ctx, 'HITS ' + d.hits, d.x + d.w / 2, d.y - 10, '#ffd34f');
  }
  for (const e of Game.enemies) {
    if (e.dead) continue;
    ({ gremlin: drawGremlin, bat: drawBat, amp: drawAmp, guardian: drawGuardian, boss: drawBoss })[e.type](ctx, e, t);
    if (e.showHp > 0 && !e.guardian) { const w = e.w; ctx.fillStyle = '#000'; ctx.fillRect(e.x - 1, e.y - 5, w + 2, 3); ctx.fillStyle = '#f33'; ctx.fillRect(e.x, e.y - 4, Math.max(0, w * e.hp / e.maxHp), 1); }
    if (e.state === 'warnLeap') { ctx.fillStyle = (t * 10 | 0) % 2 ? '#f44' : '#ff4'; ctx.fillRect(e.tx - 10, e.y + e.h - 2, 20, 2); drawTextC(ctx, 'V', e.tx, e.y + e.h - 12, '#f44'); }
    if (e.state === 'warnStomp') { ctx.fillStyle = (t * 10 | 0) % 2 ? '#f448' : '#ff48'; ctx.fillRect(e.x - 60, e.y + e.h - 2, e.w + 120, 2); }
  }
  if (Game.mode === 'tutorial') Tutorial.drawWorld(ctx, t);
  for (const a of Game.actors) {
    drawMember(ctx, a.id, a.x, a.y - (a.id === 'drums' && a.anim === 'play' ? 6 : 0), a.f, { anim: a.anim, t: a.t, beat: (t * 4.6 | 0) % 2 === 0 });
    if (a.id === 'drums' && a.anim === 'play') drawDrumKit(ctx, a.x + 2, a.y, t, (t * 4.6 | 0) % 2 === 0, false);
  }
  // player
  const p = Game.player;
  if (!(p.inv > 0 && !p.dead && (t * 20 | 0) % 2 === 0)) {
    const anim = Game.playerAnim(p);
    drawSinger(ctx, p.x + p.w / 2, p.y + p.h, p.f, { anim, frame: p.frame, t, standAngle: p.atk ? standAngle(p.atk) : 0, phase: p.atk && p.atk.phase, tint: p.hurtT > 0.18 ? '#fff' : null, keyCol: STAGE_COL[Game.stage] });
  }
  if (UI.debugHit && p.atk) { ctx.fillStyle = '#0f0'; for (const q of standPoints(p)) ctx.fillRect(q.x - 1, q.y - 1, 2, 2); }
  for (const s of Game.shots) { if (s.kind === 'shock') drawShock(ctx, s, t); else drawOrb(ctx, s, t); }
  for (const q of Game.parts) {
    ctx.globalAlpha = clamp(q.life / q.max * 1.5, 0, 1);
    if (q.note) { drawText(ctx, '~', q.x, q.y, q.col); } else { ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  HUD.draw(ctx);
};
