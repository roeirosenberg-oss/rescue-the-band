'use strict';
// =====================================================================
//  PROLOGUE: animated kidnapping intro + interactive tutorial with Sam the stagehand
// =====================================================================

// ---------- Sam the stagehand ----------
function drawStagehand(ctx, x, y, f, o = {}) {
  const p = new Painter(ctx, x, y, f), t = o.t || 0;
  let lf = 0, lb = 0, bob = 0, arm = [5, -10];
  if (o.anim === 'walk' || o.anim === 'run') { const fr = (t * (o.anim === 'run' ? 12 : 8) | 0) % 4; lf = fr === 0 ? 2 : fr === 2 ? -2 : 0; lb = -lf; bob = fr % 2 ? -1 : 0; }
  if (o.anim === 'talk') arm = (t * 3 | 0) % 2 ? [5, -16] : [6, -12];
  if (o.anim === 'cheer') { bob = -(Math.abs(Math.sin(t * 7)) * 3 | 0); arm = [3, -22]; }
  const by = bob;
  p.line(-2, -13 + by, -4, -8 + by, '#2a2a30', 2); p.r(-4, -8 + by, 2, 2, '#d9a77c');
  p.r(-3 + lb, -6 + by, 3, 4, '#8a7a52'); p.r(-3 + lb, -2 + by, 4, 2, '#3a2a1a');
  p.r(0 + lf, -6 + by, 3, 4, '#8a7a52'); p.r(0 + lf, -2 + by, 4, 2, '#3a2a1a');
  p.r(-4, -14 + by, 8, 8, '#1c1c22'); p.r(-4, -7 + by, 8, 1, '#4a4a40');           // black crew tee + belt
  p.r(-2, -12 + by, 4, 1, '#fff'); p.px(-1, -11 + by, '#fff'); p.px(1, -11 + by, '#fff'); // "CREW" print
  p.r(-3, -21 + by, 7, 7, '#d9a77c'); p.px(1, -18 + by, '#141018'); p.px(3, -18 + by, '#141018');
  if (o.anim === 'talk' && (t * 6 | 0) % 2) p.r(2, -16 + by, 2, 1, '#5a1020'); else p.r(2, -16 + by, 2, 1, '#9a5a40');
  p.r(-4, -23 + by, 8, 3, '#ffd34f'); p.r(-6, -21 + by, 3, 1, '#ffd34f');              // backwards cap
  p.r(-4, -20 + by, 1, 4, '#333'); p.line(-4, -17 + by, 2, -15 + by, '#333');           // headset + boom mic
  p.line(1, -13 + by, arm[0], arm[1] + by, '#1c1c22', 2); p.r(arm[0], arm[1] + by, 2, 2, '#d9a77c');
  if (o.anim !== 'cheer') { p.r(arm[0] + 1, arm[1] + by - 1, 4, 2, '#888'); p.px(arm[0] + 5, arm[1] + by - 1, '#ffe9a8'); } // flashlight
}

// ---------- hand-pose illustrations (20x24 pixel art) ----------
function drawPose(cv, pose, hand) {
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, 20, 24);
  const OUT = '#141018', SK = '#f2c299', SH = '#c98f6b', SLV = hand === 'R' ? '#4fe3ff' : '#ff7ab8';
  const F = [[5, 3, 8], [8, 2, 9], [11, 3, 8], [14, 5, 6]]; // x, top, height (index..pinky)
  const ext = { OPEN: [1, 1, 1, 1], FIST: [0, 0, 0, 0], INDEX: [1, 0, 0, 0] }[pose];
  const R = [];
  R.push([5, 11, 12, 9, SK]); R.push([7, 20, 8, 4, SLV]);
  F.forEach(([fx, top, h], i) => { if (ext[i]) R.push([fx, top, 3, 11 - top, SK]); else R.push([fx, 9, 3, 3, SK]); });
  if (pose === 'OPEN') { R.push([2, 14, 3, 4, SK]); R.push([1, 11, 3, 4, SK]); }
  else R.push([4, 15, 8, 3, SK]);
  const m = r => hand === 'R' ? r : [20 - r[0] - r[2], r[1], r[2], r[3], r[4]];
  for (const r0 of R) { const r = m(r0); x.fillStyle = OUT; x.fillRect(r[0] - 1, r[1] - 1, r[2] + 2, r[3] + 2); }
  for (const r0 of R) { const r = m(r0); x.fillStyle = r[4]; x.fillRect(r[0], r[1], r[2], r[3]); }
  // finger separators, knuckle folds, thumb fold
  x.fillStyle = SH;
  F.forEach(([fx, top, h], i) => {
    if (i > 0) { const r = m([fx, ext[i] || ext[i - 1] ? Math.max(top, F[i - 1][1]) : 9, 1, 0, '']); x.fillRect(r[0] + (hand === 'R' ? 0 : 0), r[1], 1, 11 - r[1] + 1); }
    if (!ext[i]) { const r = m([fx, 11, 3, 1, '']); x.fillRect(r[0], r[1], r[2], 1); }
  });
  if (pose !== 'OPEN') { const r = m([4, 17, 8, 1, '']); x.fillRect(r[0], r[1], r[2], 1); }
  x.fillStyle = '#fff6'; const hl = m([6, 12, 1, 3, '']); x.fillRect(hl[0], hl[1], 1, 3);
}
const POSE_INFO = {
  R: { OPEN: ['OPEN PALM', 'STOP', 'NO KEY'], FIST: ['CLOSED FIST', 'MOVE RIGHT', 'D / →'], INDEX: ['INDEX FINGER ONLY', 'MOVE LEFT', 'A / ←'] },
  L: { OPEN: ['OPEN PALM', 'NO ACTION', 'NO KEY'], FIST: ['CLOSED FIST', 'ATTACK', 'J'], INDEX: ['INDEX FINGER ONLY', 'JUMP', 'SPACE / W'] }
};

// =====================================================================
//  INTRO CUTSCENE
// =====================================================================
const Prologue = {
  t: 0, done: false, fired: null, crowd: [], mons: [], caption: null,
  END: 15.2,
  start() {
    Game.mode = 'prologue'; Game.paused = false; Game.frozen = false; Game.cut = null; UI.hideAll();
    Prologue.t = 0; Prologue.done = false; Prologue.fired = new Set(); Prologue.caption = null; Game.parts = []; Game.shake = 0;
    Prologue.crowd = []; for (let r = 0; r < 2; r++) for (let i = 0; i < 34; i++) Prologue.crowd.push({ x: i * 12 + (r % 2) * 6 - 6, row: r, ph: Math.random() * 6, dir: i < 17 ? -1 : 1, sp: rand(70, 130) });
    const g = (o) => Object.assign({ flash: 0, dead: false, seed: Math.random() * 9, state: 'walk', vy: 0 }, o);
    Prologue.mons = [
      { kind: 'ogre', e: g({ type: 'guardian', variant: 1, w: 22, h: 38, x: -60, y: 160 - 38, f: 1, keyId: 'key-1', keyCol: STAGE_COL[1] }), tx: 98, carry: ['keys', 'volt'], exitX: -90 },
      { kind: 'golem', e: g({ type: 'guardian', variant: 2, w: 22, h: 38, x: 430, y: 160 - 38, f: -1, keyId: 'key-2', keyCol: STAGE_COL[2] }), tx: 262, carry: ['bass', 'riff'], exitX: 470 },
      { kind: 'boss', e: g({ type: 'boss', w: 34, h: 56, x: 175, y: -90, f: 1, keyId: 'key-3', keyCol: STAGE_COL[3], phase2: false, state: 'walk' }), ty: 138 - 56, carry: ['drums'] },
      { kind: 'gremlin', e: g({ type: 'gremlin', w: 14, h: 12, x: -30, y: 148, f: 1, col: '#a34fe0', colD: '#6a2a99', state: 'patrol' }), sp: 110 },
      { kind: 'gremlin', e: g({ type: 'gremlin', w: 14, h: 12, x: 400, y: 148, f: -1, col: '#e0703a', colD: '#904018', state: 'patrol' }), sp: 95 },
      { kind: 'bat', e: g({ type: 'bat', w: 14, h: 8, x: 60, y: -20, f: 1, state: 'idle' }), ph: 0 },
      { kind: 'bat', e: g({ type: 'bat', w: 14, h: 8, x: 320, y: -30, f: -1, state: 'idle' }), ph: 2 }
    ];
    Prologue.sam = { x: -20, anim: 'run' };
    Prologue.singer = { anim: 'sing', x: 192 };
    AudioMgr.stopFinale(); AudioMgr.setMusic('s1', 'combat'); AudioMgr.setAmbient('concert'); AudioMgr.duck(false);
    Tutorial.showSkip(true); Tutorial.showUI(false);
    Game.fade = 1; Game.fadeTo(0);
  },
  update(dt) {
    const P = Prologue; P.t += dt; const t = P.t;
    const once = (time, k, fn) => { if (t >= time && !P.fired.has(k)) { P.fired.add(k); fn(); } };
    once(0.3, 'cheer', () => AudioMgr.play('cheer', { strength: 0.45, dur: 2.5 }));
    once(0.4, 'c0', () => P.caption = { who: null, text: 'NOVA AND THE BAND ARE LIVE ON STAGE...' });
    once(4.2, 'alarm', () => { AudioMgr.setMusic(null); AudioMgr.play('roar'); AudioMgr.play('warn', { boss: true }); Game.shake = 3; P.caption = { who: null, text: 'WHAT WAS THAT?!' }; });
    once(5.0, 'enter', () => { AudioMgr.play('cheer', { strength: 0.8, dur: 2.5 }); P.caption = { who: null, text: 'MONSTERS CRASH THE SHOW!' }; });
    once(6.3, 'land', () => { Game.shake = 6; AudioMgr.play('shockwave'); P.singer.anim = 'hurt'; AudioMgr.play('pain'); burst(192, 138, 18, ['#ff6', '#f84', '#fff'], 120, 0.5); });
    once(6.6, 'knock', () => { P.singer.anim = 'dead'; });
    once(6.8, 'grab', () => { AudioMgr.play('locked'); AudioMgr.play('woo', { pitch: 1.4 }); AudioMgr.play('woo', { pitch: 0.9, delay: 0.15 }); P.caption = { who: null, text: "THEY'RE KIDNAPPING THE BAND!" }; });
    once(8.0, 'keys', () => P.caption = { who: null, text: 'EACH MONSTER LEADER CARRIES A CAGE KEY...' });
    once(10.0, 'up', () => { P.singer.anim = 'idle'; P.caption = { who: null, text: 'THE BAND IS GONE. ONLY NOVA IS LEFT.' }; });
    once(12.0, 'sam', () => { P.caption = { who: 'SAM', text: 'NOVA! ARE YOU OKAY?! COME BACKSTAGE, QUICK!' }; });
    // monsters
    for (const m of P.mons) {
      const e = m.e;
      if (m.kind === 'ogre' || m.kind === 'golem') {
        if (t > 5.0 && t < 6.8) { e.x += (m.tx - e.x) * Math.min(1, dt * 2.6); e.state = 'walk'; }
        if (t >= 6.8 && t < 7.3) e.state = 'attack';
        if (t >= 7.3) { e.state = 'walk'; e.f = sign(m.exitX - e.x) || e.f; e.x += sign(m.exitX - e.x) * 75 * dt; }
      } else if (m.kind === 'boss') {
        if (t > 5.4 && t < 6.3) e.y = lerp(-90, m.ty, clamp((t - 5.4) / 0.9, 0, 1) ** 2);
        if (t >= 6.3 && t < 7.4) { e.y = m.ty; e.state = t < 6.8 ? 'warnOrbs' : 'recover'; }
        if (t >= 7.4) { e.state = 'leap'; e.y -= 140 * dt; }
      } else if (m.kind === 'gremlin') {
        if (t > 5.0 && t <= 9.2) { e.x += e.f * m.sp * dt; if (e.x > 330 && e.f > 0) e.f = -1; if (e.x < 40 && e.f < 0) e.f = 1; }
        if (t > 9.2) { e.f = e.x < 192 ? -1 : 1; e.x += e.f * 160 * dt; }
      } else if (m.kind === 'bat') {
        if (t > 5.0) { m.ph += dt; e.y = lerp(e.y, 40 + Math.sin(m.ph * 2) * 18, 0.05); e.x += Math.cos(m.ph * 1.3) * 60 * dt; }
        if (t > 9.0) e.y -= 120 * dt;
      }
    }
    for (const c of P.crowd) if (t > 5.0) c.x += c.dir * c.sp * dt;
    // Sam runs in
    if (t > 12.0) { const s = P.sam; if (s.x < 150) { s.x += 110 * dt; s.anim = 'run'; } else s.anim = 'talk'; }
    for (const q of Game.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt; }
    Game.parts = Game.parts.filter(q => q.life > 0);
    Game.shake = Math.max(0, Game.shake - dt * 10);
    if (t >= P.END && !P.done) { P.done = true; Game.fadeTo(1, () => Tutorial.start()); }
  },
  skipIntro() { if (Game.mode !== 'prologue' || Prologue.done) return; Prologue.done = true; Game.fadeTo(1, () => Tutorial.start()); },
  draw(ctx) {
    const P = Prologue, t = P.t, playing = t < 4.2, alarm = t >= 4.2 && t < 9.6;
    const sx = Game.shake > 0 ? Math.round(rand(-Game.shake, Game.shake)) : 0;
    ctx.save(); ctx.translate(sx, 0);
    const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#05030c'); g.addColorStop(1, alarm ? '#2a0a14' : '#1a0c2a'); ctx.fillStyle = g; ctx.fillRect(-8, 0, VW + 16, VH);
    // LED wall
    ctx.fillStyle = '#0c0818'; ctx.fillRect(60, 22, 264, 78);
    if (playing) for (let i = 0; i < 32; i++) { const h = Math.round((0.3 + 0.35 * Math.sin(i * 1.7 + t * 6) * Math.sin(t * 2.3 + i)) * 50 + 10); ctx.fillStyle = `hsl(${(t * 40 + i * 9) % 360},90%,55%)`; ctx.fillRect(66 + i * 8, 96 - Math.max(2, h), 6, Math.max(2, h)); }
    if (alarm && (t * 4 | 0) % 2) drawTextC(ctx, '!! WARNING !!', VW / 2, 52, '#ff4f6a', 2, '#000');
    if (playing) drawTextC(ctx, 'RESCUE THE BAND', VW / 2, 30, '#ffd34f', 2, '#000');
    // truss + lights
    ctx.fillStyle = '#333'; ctx.fillRect(20, 10, VW - 40, 4);
    [50, 100, 150, 234, 284, 334].forEach((lx, i) => {
      let col = null;
      if (playing) col = `hsla(${(t * 50 + i * 60) % 360},100%,60%,0.16)`;
      else if (alarm) col = (t * 6 + i | 0) % 2 ? 'rgba(255,40,60,0.22)' : null;
      if (col) { const sw = Math.sin(t + i) * 30; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(lx, 14); ctx.lineTo(lx + sw - 22, 170); ctx.lineTo(lx + sw + 22, 170); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = col ? '#fff' : '#555'; ctx.fillRect(lx - 2, 13, 5, 4);
    });
    if (t >= 9.6) { ctx.fillStyle = 'rgba(255,240,200,0.13)'; ctx.beginPath(); ctx.moveTo(192, 14); ctx.lineTo(160, 165); ctx.lineTo(224, 165); ctx.closePath(); ctx.fill(); }
    // stage
    ctx.fillStyle = '#2a1a12'; ctx.fillRect(-8, 160, VW + 16, 12); ctx.fillStyle = '#4a2e1c'; ctx.fillRect(-8, 160, VW + 16, 2);
    ctx.fillStyle = '#3a2a3a'; ctx.fillRect(160, 138, 64, 22);
    for (const ax of [44, 72, 294, 322]) { ctx.fillStyle = '#111'; ctx.fillRect(ax, 144, 24, 16); ctx.fillStyle = '#333'; ctx.fillRect(ax + 2, 146, 20, 12); }
    drawDrumKit(ctx, 192, 138, t, playing && (t * 4.6 | 0) % 2 === 0, true);
    // band members still on stage before the grab
    const beat = (t * 4.6 | 0) % 2 === 0, anim = playing ? 'play' : 'caged';
    const pos = { drums: [192, 128, 1], volt: [120, 158, 1], keys: [146, 160, 1], bass: [252, 160, -1], riff: [290, 160, -1] };
    const carried = new Set();
    if (t >= 6.8) for (const m of P.mons) if (m.carry) m.carry.forEach((id, k) => {
      carried.add(id); const e = m.e;
      drawMember(ctx, id, e.x + e.w / 2 + (k ? 9 : -7) * (m.kind === 'boss' ? 0 : 1), e.y + (m.kind === 'boss' ? 30 : 8), k ? -1 : 1, { anim: 'caged', t: t + k });
    });
    for (const id of BAND_ORDER) if (!carried.has(id)) { const [x, y, f] = pos[id]; drawMember(ctx, id, x, y, f, { anim, t, beat }); }
    // singer
    const S = P.singer;
    if (S.anim === 'sing') drawSinger(ctx, 192, 162, 1, { anim: 'sing', t, mouth: (t * 5 | 0) % 3 ? 2 : 1, beat, armUp: (t * 2 | 0) % 2 === 0 });
    else drawSinger(ctx, 192, 162, S.anim === 'idle' && t > 12 ? -1 : 1, { anim: S.anim, t, tint: S.anim === 'hurt' ? '#fff' : null });
    // monsters
    for (const m of P.mons) {
      const e = m.e; if ((m.kind === 'ogre' || m.kind === 'golem') && t < 5.0) continue; if (m.kind === 'boss' && t < 5.4) continue;
      if ((m.kind === 'gremlin' || m.kind === 'bat') && t < 5.0) continue;
      ({ guardian: drawGuardian, boss: drawBoss, gremlin: drawGremlin, bat: drawBat })[e.type](ctx, e, t);
    }
    if (t >= 7.8 && t < 10) { // point out the keys
      for (const m of P.mons) if (m.e.keyId && m.e.x > -20 && m.e.x < VW && m.e.y > -40) { const e = m.e; const kx = e.x + e.w / 2, ky = m.kind === 'boss' ? e.y + 6 : e.y + e.h - 20; if ((t * 4 | 0) % 2) drawTextC(ctx, 'KEY', kx, ky - 10, m.e.keyCol, 1, '#000'); }
    }
    // stagehand
    if (t > 12.0) drawStagehand(ctx, P.sam.x, 162, 1, { anim: P.sam.anim, t });
    for (const q of Game.parts) { ctx.globalAlpha = clamp(q.life / q.max * 1.5, 0, 1); ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size || 1, q.size || 1); } ctx.globalAlpha = 1;
    // crowd
    for (const c of P.crowd) {
      const y = 188 + c.row * 12 + Math.round(Math.sin(t * (playing ? 4.6 : 12) + c.ph) * (playing ? 1.2 : 2));
      const x = Math.round(c.x); if (x < -14 || x > VW + 4) continue;
      ctx.fillStyle = ['#141020', '#100c18'][c.row]; ctx.fillRect(x, y, 10, 30); ctx.fillStyle = ['#2a2238', '#262032'][c.row]; ctx.fillRect(x + 2, y - 7, 6, 7);
      if (playing || t > 5) { ctx.fillStyle = ['#141020', '#100c18'][c.row]; ctx.fillRect(x - 1, y - 12, 2, 12); ctx.fillRect(x + 9, y - 12, 2, 12); }
    }
    ctx.restore();
    // caption box
    if (P.caption) {
      const c = P.caption; ctx.fillStyle = '#000c'; ctx.fillRect(6, 194, 300, 17); ctx.fillStyle = '#ffd34f'; ctx.fillRect(6, 194, 300, 1);
      if (c.who) { drawText(ctx, c.who + ':', 11, 200, '#ffd34f'); drawText(ctx, c.text, 11 + textWidth(c.who + ': '), 200, '#fff'); }
      else drawText(ctx, c.text, 11, 200, '#fff');
    }
    drawText(ctx, 'PROLOGUE', 6, 4, '#9cf'); drawText(ctx, 'ENTER = SKIP INTRO', VW - 6 - textWidth('ENTER = SKIP INTRO'), 4, '#667');
  }
};

// =====================================================================
//  INTERACTIVE TUTORIAL
// =====================================================================
const LESSONS = [
  { talk: ["THOSE MONSTERS TOOK YOUR WHOLE BAND, NOVA!", "THEY LOCKED THEM IN CAGES ACROSS THREE STAGES.", "THE BIG MONSTERS CARRY THE CAGE KEYS. FIND THEM, DEFEAT THEM, GRAB THE KEYS...", "...AND RESCUE THE BAND! BUT FIRST, LET'S WARM UP YOUR HANDS.", "YOUR RIGHT HAND MOVES YOU. YOUR LEFT HAND DOES ACTIONS. HERE'S THE CHEAT SHEET."], cheat: true },
  { id: 'stop', hand: 'R', pose: 'OPEN', title: 'RIGHT HAND: OPEN PALM = STOP', say: 'SHOW ME AN OPEN RIGHT PALM AND STAND STILL FOR A MOMENT.' },
  { id: 'right', hand: 'R', pose: 'FIST', title: 'RIGHT HAND: CLOSED FIST = MOVE RIGHT', say: 'CLOSE YOUR RIGHT HAND INTO A FIST TO WALK RIGHT. REACH THE GLOWING MARK!', mark: 16 },
  { id: 'left', hand: 'R', pose: 'INDEX', title: 'RIGHT HAND: INDEX FINGER = MOVE LEFT', say: 'NOW KEEP A FIST BUT POINT ONLY YOUR RIGHT INDEX FINGER. WALK BACK LEFT TO THE MARK!', mark: 5 },
  { id: 'noact', hand: 'L', pose: 'OPEN', title: 'LEFT HAND: OPEN PALM = NO ACTION', say: 'YOUR LEFT HAND DOES ACTIONS. AN OPEN LEFT PALM MEANS "DO NOTHING". HOLD IT OPEN AND RELAX.' },
  { id: 'jump', hand: 'L', pose: 'INDEX', title: 'LEFT HAND: INDEX FINGER = JUMP', say: 'POINT YOUR LEFT INDEX FINGER TO JUMP. WALK RIGHT AND HOP OVER THE CRATES! OPEN YOUR HAND BEFORE EACH NEW JUMP.' },
  { id: 'attack', hand: 'L', pose: 'FIST', title: 'LEFT HAND: CLOSED FIST = ATTACK', say: 'MAKE A LEFT FIST TO SWING YOUR MIC STAND. HIT THE DUMMY 3 TIMES. OPEN YOUR HAND BETWEEN SWINGS!' },
  { id: 'stomp', title: "STOMP: LAND ON A MONSTER'S HEAD", say: 'A NOISE GREMLIN! JUMP INTO THE PEN AND LAND RIGHT ON ITS HEAD. JUMPING ON MONSTERS HURTS THEM, NOT YOU!', poses: [['R', 'FIST'], ['L', 'INDEX']] },
  { talk: ["YOU'RE A NATURAL, NOVA!", "THE FIRST KEY CARRIER IS HIDING IN THE IVORY HALLS.", "THE DOOR IS OPEN. GO SAVE YOUR BAND!"], cheat: true, final: true }
];
const Tutorial = {
  i: 0, st: null, passT: 0, line: 0, lineT: 0, sam: null, doorOpen: false, uiT: 0, ACTIVE_LESSONS: LESSONS.filter(l => !l.talk).length,
  start() {
    Game.mode = 'tutorial'; Game.paused = false; Game.frozen = false; UI.hideAll();
    Game.stats = { hits: 0, swings: 0, misses: 0, stomps: 0 };
    Game.loadStage('tut');
    Tutorial.sam = { x: Game.player.x - 26, y: 11 * TILE, f: 1, anim: 'idle', t: 0 };
    Tutorial.i = -1; Tutorial.doorOpen = false; Tutorial.next();
    Tutorial.showUI(true); Tutorial.showSkip(true);
    Game.fade = 1; Game.fadeTo(0);
  },
  lesson() { return LESSONS[Tutorial.i]; },
  next() {
    Tutorial.i++; const L = Tutorial.lesson(); if (!L) return;
    Tutorial.passT = 0; Tutorial.line = 0; Tutorial.lineT = 0;
    Tutorial.st = { hold: 0, hits0: Game.stats.hits, jumped: false, gremlin: null, respawnT: 0 };
    if (L.id === 'stomp') Tutorial.spawnGremlin();
    if (L.final) { const d = Game.exits[0]; if (d) { d.open = true; AudioMgr.play('door'); } Tutorial.doorOpen = true; }
    Tutorial.render();
  },
  spawnGremlin() {
    const e = makeEnemy({ type: 'gremlin' }, 40 * TILE, 11 * TILE); e.cd = 1.2; Game.enemies.push(e); Tutorial.st.gremlin = e;
    burst(e.x + 7, e.y + 6, 10, ['#a34fe0', '#fff'], 60, 0.4);
  },
  advanceLine() {
    const L = Tutorial.lesson(); if (!L || !L.talk) return;
    if (Tutorial.line < L.talk.length - 1) { Tutorial.line++; Tutorial.lineT = 0; Tutorial.render(); AudioMgr.play('ui'); }
    else if (!L.final) Tutorial.next();
  },
  check(L, dt) {
    const p = Game.player, H = Gesture.hands, S = Tutorial.st, still = p.onGround && Math.abs(p.vx) < 5 && Input.moveDir() === 0;
    switch (L.id) {
      case 'stop': S.hold = (still && (!H.R.present || H.R.stable === 'OPEN')) ? S.hold + dt : 0; return S.hold >= 1.0;
      case 'right': return p.x + p.w / 2 >= L.mark * TILE + 4;
      case 'left': return p.x + p.w / 2 <= (L.mark + 1) * TILE - 4;
      case 'noact': S.hold = (!p.atk && p.onGround && (!H.L.present || H.L.stable === 'OPEN')) ? S.hold + dt : 0; return S.hold >= 1.2;
      case 'jump': if (p.vy < -200) S.jumped = true; return S.jumped && p.onGround && p.x > 23 * TILE;
      case 'attack': return Game.stats.hits - S.hits0 >= 3;
      case 'stomp': {
        const g = S.gremlin;
        if (g && (g.stompCount || 0) > 0) return true;
        if (g && g.dead && !(g.stompCount > 0)) { S.respawnT += dt; if (S.respawnT > 0.8) { S.respawnT = 0; Tutorial.spawnGremlin(); Game.msg('SAM: NICE SWING! NOW TRY LANDING ON ITS HEAD.', 2.6, '#ffd34f'); } }
        return false;
      }
    }
    return false;
  },
  update(dt) {
    if (!Tutorial.st || Game.card) { Tutorial.updateSam(dt); return; }
    const L = Tutorial.lesson(); Tutorial.updateSam(dt);
    Tutorial.uiT -= dt; if (Tutorial.uiT <= 0) { Tutorial.uiT = 0.1; Tutorial.liveUI(); }
    if (!L) return;
    if (Tutorial.passT > 0) { Tutorial.passT -= dt; if (Tutorial.passT <= 0) Tutorial.next(); return; }
    if (L.talk) { Tutorial.lineT += dt; const len = L.talk[Tutorial.line].length; if (!L.final || Tutorial.line < L.talk.length - 1) { if (Tutorial.lineT > 3.0 + len * 0.045) Tutorial.advanceLine(); } return; }
    if (Tutorial.check(L, dt)) Tutorial.succeed(L);
  },
  succeed(L) {
    Tutorial.passT = 1.2; AudioMgr.play('checkpoint'); const p = Game.player;
    burst(p.x + p.w / 2, p.y + 4, 16, ['#ffd34f', '#7f7', '#fff'], 80, 0.6);
    EventLog.push('LESSON ' + L.id + ' PASSED');
    if (L.id === 'stomp') { const g = Tutorial.st.gremlin; if (g && !g.dead) killEnemyQuiet(g); }
    Tutorial.render(true);
  },
  updateSam(dt) {
    const s = Tutorial.sam, p = Game.player; if (!s) return;
    s.t += dt; const L = Tutorial.lesson();
    const tx = p.x + p.w / 2 - 34 * (p.f || 1), d = tx - s.x;
    if (Math.abs(d) > 12) { s.x += sign(d) * Math.min(Math.abs(d), (Math.abs(d) > 70 ? 120 : 70) * dt); s.f = sign(d); s.anim = 'walk'; }
    else { s.f = sign(p.x - s.x) || 1; s.anim = Tutorial.passT > 0 ? 'cheer' : (L && L.talk) ? 'talk' : 'idle'; }
    s.x = clamp(s.x, 20, (Game.lvl.w - 2) * TILE);
    // follow the floor height (hops over crates/walls)
    const col = Math.floor(s.x / TILE); let gy = Game.lvl.h * TILE; for (let r = 0; r < Game.lvl.h; r++) if (Game.solid(col, r)) { gy = r * TILE; break; }
    s.y = s.y + (gy - s.y) * Math.min(1, dt * 12);
  },
  drawWorld(ctx, t) {
    const s = Tutorial.sam, L = Tutorial.lesson();
    if (s) {
      drawStagehand(ctx, s.x, Math.round(s.y), s.f, { anim: s.anim, t: s.t });
      drawTextC(ctx, 'SAM', s.x, s.y - 34, '#ffd34f', 1, '#000');
      if (L && (L.talk) && (t * 2 | 0) % 2) drawText(ctx, '...', s.x + 4, s.y - 30, '#fff');
    }
    if (!L || Tutorial.passT > 0) return;
    const bob = Math.round(Math.sin(t * 6) * 2);
    const arrow = (x, y, text, col = '#ffd34f') => { drawTextC(ctx, text, x, y - 10 + bob, col, 1, '#000'); drawTextC(ctx, 'V', x, y - 3 + bob, col, 1, '#000'); };
    if (L.mark !== undefined) {
      const x = L.mark * TILE; ctx.fillStyle = `rgba(255,211,79,${0.25 + 0.15 * Math.sin(t * 6)})`; ctx.fillRect(x, 8 * TILE, TILE, 3 * TILE);
      ctx.fillStyle = '#ffd34f'; ctx.fillRect(x, 11 * TILE - 2, TILE, 2); arrow(x + 8, 8 * TILE, L.id === 'right' ? 'GO >' : '< GO');
    }
    if (L.id === 'jump') arrow(22 * TILE, 9 * TILE - 4, 'JUMP!');
    if (L.id === 'attack') { const d = Game.dummies[0]; if (d) arrow(d.x + d.w / 2, d.y - 14, 'HIT ME!'); }
    if (L.id === 'stomp') { const g = Tutorial.st.gremlin; if (g && !g.dead) arrow(g.x + g.w / 2, g.y - 8, 'STOMP!', '#7f7'); }
    if (L.final) { const d = Game.exits[0]; if (d) arrow(d.x + d.w / 2, d.y - 18, 'STAGE 1 >', '#7f7'); }
  },
  // ---------- DOM panel ----------
  showUI(on) { $('tut').classList.toggle('on', !!on); },
  showSkip(on) { $('skipTut').style.display = on ? 'block' : 'none'; },
  hideUI() { Tutorial.showUI(false); Tutorial.showSkip(false); },
  poseCard(hand, pose, small) {
    const [name, act, key] = POSE_INFO[hand][pose];
    return `<div class="pcard ${small ? 'small' : ''}" data-hand="${hand}" data-pose="${pose}"><canvas width="20" height="24"></canvas><b class="${hand}">${hand === 'R' ? 'RIGHT' : 'LEFT'} HAND</b><span>${name}</span><em>= ${act}</em><small>KEYBOARD: ${key}</small></div>`;
  },
  render(passed) {
    const L = Tutorial.lesson(); if (!L) return;
    const n = LESSONS.slice(0, Tutorial.i + 1).filter(l => !l.talk).length;
    $('tutStep').textContent = L.talk ? (L.final ? 'READY!' : 'SAM THE STAGEHAND') : `LESSON ${n}/${Tutorial.ACTIVE_LESSONS}`;
    $('tutTitle').textContent = L.talk ? '' : L.title;
    $('tutText').textContent = passed ? 'NICE ONE! ✓' : L.talk ? L.talk[Tutorial.line] : L.say;
    $('tutText').classList.toggle('ok', !!passed);
    let poses = '';
    if (L.cheat) poses = `<div class="cheat">${['OPEN', 'FIST', 'INDEX'].map(p => Tutorial.poseCard('R', p, true)).join('')}${['OPEN', 'FIST', 'INDEX'].map(p => Tutorial.poseCard('L', p, true)).join('')}</div>`;
    else if (L.poses) poses = L.poses.map(([h, p]) => Tutorial.poseCard(h, p)).join('');
    else if (L.hand) poses = Tutorial.poseCard(L.hand, L.pose);
    $('tutPoses').innerHTML = poses;
    $('tutPoses').querySelectorAll('.pcard').forEach(c => drawPose(c.querySelector('canvas'), c.dataset.pose, c.dataset.hand));
    $('tutNext').style.display = (L.talk && !(L.final && Tutorial.line === L.talk.length - 1)) ? '' : 'none';
    $('tutCam').style.display = Gesture.status === 'ready' || Gesture.status === 'loading' ? 'none' : '';
    $('tutHint').textContent = L.final && Tutorial.line === L.talk.length - 1 ? 'WALK THROUGH THE GLOWING DOOR TO START STAGE 1.' : L.talk ? '' : (Gesture.status === 'ready' ? 'TIP: THE BOXES AT THE BOTTOM-LEFT SHOW WHAT THE CAMERA SEES.' : 'CAMERA OFF: USE THE KEYBOARD SHOWN ON THE CARD, OR ENABLE THE CAMERA.');
  },
  liveUI() {
    const H = Gesture.hands;
    $('tutPoses').querySelectorAll('.pcard').forEach(c => { const h = H[c.dataset.hand]; c.classList.toggle('match', Gesture.S.enabled && h.present && h.stable === c.dataset.pose); });
    $('tutCam').style.display = Gesture.status === 'ready' || Gesture.status === 'loading' ? 'none' : '';
  },
  finish() {
    if (Tutorial.finishing) return; Tutorial.finishing = true;
    Tutorial.hideUI(); Prologue.done = true;
    if (Game.sv) { Game.sv.prologueDone = true; Store.set('rtb_save', Game.sv); }
    AudioMgr.play('door'); Game.transitioning = true;
    Game.fadeTo(1, () => {
      Tutorial.finishing = false; Game.transitioning = false;
      Game.mode = 'play'; Game.paused = false; Game.frozen = false; Input.clear();
      Game.sv.stage = 1; Game.sv.checkpoint = null; Game.persist();
      Game.stats = { hits: 0, swings: 0, misses: 0 };
      Game.loadStage(1); Game.fadeTo(0);
    });
  },
  skip() { if (Game.mode !== 'prologue' && Game.mode !== 'tutorial') return; if (Game.paused) Flow.resume(); Tutorial.finish(); }
};
function killEnemyQuiet(e) { e.dead = true; e.deadT = 0; AudioMgr.play('pop'); burst(e.x + e.w / 2, e.y + e.h / 2, 12, ['#fff', e.col || '#c7f'], 70, 0.4); }
