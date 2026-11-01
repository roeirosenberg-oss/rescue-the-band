'use strict';
// =====================================================================
//  FINAL CONCERT (ending sequence, plays the complete song)
// =====================================================================
const Concert = {
  t: 0, phase: 'intro', crowd: [], beat: 0, avg: 0.2, beatCount: 0, conf: [], fakeT: 0, songDur: 153, lightHue: 0,
  start() {
    if (!Game.sv || BAND_ORDER.some(m => !Game.sv.rescued.includes(m))) { console.warn('Concert requires all five rescues'); return false; }
    Game.mode = 'concert'; Game.paused = false; Game.cut = null; Game.card = null; UI.hideAll(); UI.setPlayingUI(true);
    Concert.t = 0; Concert.phase = 'intro'; Concert.conf = []; Concert.beatCount = 0; Concert.ended = false;
    Concert.crowd = []; for (let r = 0; r < 3; r++) for (let i = 0; i < 34; i++) Concert.crowd.push({ x: i * 12 + (r % 2) * 6 - 6 + rand(-2, 2), row: r, ph: Math.random() * 6, hue: irand(0, 5), arms: Math.random() < 0.5, phone: Math.random() < 0.12, jump: 0 });
    AudioMgr.stopFinale(); AudioMgr.setMusic(null); AudioMgr.setAmbient('concert'); AudioMgr.duck(false);
    AudioMgr.play('cheer', { strength: 0.7, dur: 3 });
    Game.fadeTo(0);
    Store.set('rtb_save', Game.sv);
    return true;
  },
  update(dt) {
    const C = Concert; C.t += dt;
    if (C.phase === 'intro' && C.t > 3.2) {
      C.phase = 'song'; C.songStart = C.t;
      const f = AudioMgr.playFinale(() => Concert.finish());
      C.hasAudio = !!f; C.songDur = f ? f.dur : 153;
    }
    let b = { low: 0, mid: 0, high: 0 };
    if (C.phase === 'song') {
      if (C.hasAudio) b = AudioMgr.bands();
      else { const s = C.t - C.songStart; b = { low: (s * 2.28 % 1) < 0.2 ? 0.8 : 0.3, mid: 0.5, high: 0.4 }; if (s >= C.songDur) Concert.finish(); }
    }
    C.bands = b;
    C.avg = lerp(C.avg, b.low, 0.05);
    C.beat = Math.max(0, C.beat - dt * 4);
    if (b.low > C.avg * 1.18 + 0.04 && C.beat < 0.4) { C.beat = 1; C.beatCount++; for (const p of C.crowd) if (Math.random() < 0.4) p.jump = 1; }
    for (const p of C.crowd) p.jump = Math.max(0, p.jump - dt * 4);
    C.lightHue += dt * (20 + C.beat * 60);
    if (C.phase === 'outro' || (C.phase === 'song' && C.beat === 1 && C.beatCount % 16 === 0)) for (let i = 0; i < (C.phase === 'outro' ? 3 : 12); i++) C.conf.push({ x: rand(0, VW), y: -4, vx: rand(-20, 20), vy: rand(30, 70), c: ['#ff3fa4', '#4fe3ff', '#ffd34f', '#7f7', '#fff'][irand(0, 4)], life: 4 });
    if (C.phase === 'song' && Math.random() < 0.05 + b.mid * 0.1) Game.parts.push({ x: 196, y: 138, vx: rand(-10, 10), vy: rand(-30, -18), life: 1.5, max: 1.5, col: ['#ffd34f', '#ff3fa4', '#4fe3ff'][irand(0, 2)], grav: 0, note: true });
    for (const q of Game.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    Game.parts = Game.parts.filter(q => q.life > 0);
    for (const c of C.conf) { c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt; }
    C.conf = C.conf.filter(c => c.life > 0 && c.y < VH);
    if (C.phase === 'outro' && C.t - C.outroT > 6 && !C.ended) { C.ended = true; UI.show('concertEnd'); }
  },
  finish() {
    const C = Concert; if (C.phase === 'outro') return;
    C.phase = 'outro'; C.outroT = C.t;
    AudioMgr.play('cheer', { strength: 1, dur: 5.5 }); setTimeout(() => AudioMgr.play('cheer', { strength: 0.9, dur: 4 }), 900);
    AudioMgr.play('yeah');
  },
  songTime() { return Concert.phase === 'song' ? (Concert.hasAudio ? AudioMgr.finaleTime() : Concert.t - Concert.songStart) : Concert.phase === 'outro' ? Concert.songDur : 0; },
  draw(ctx) {
    const C = Concert, t = C.t, b = C.bands || { low: 0, mid: 0, high: 0 }, beat = C.beat;
    const lit = C.phase === 'intro' ? clamp(t / 2.5, 0.15, 1) : 1;
    // arena
    const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#05030c'); g.addColorStop(1, '#1a0c2a'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    // LED wall
    ctx.fillStyle = '#0c0818'; ctx.fillRect(60, 22, 264, 78);
    for (let i = 0; i < 32; i++) {
      const v = C.phase === 'song' ? clamp((i < 8 ? b.low : i < 20 ? b.mid : b.high) * (0.6 + 0.6 * Math.sin(i * 1.7 + t * 3)) + beat * 0.3, 0, 1) : 0.05;
      const h = Math.round(v * 60 * lit); const hue = (C.lightHue + i * 8) % 360;
      ctx.fillStyle = `hsl(${hue},90%,55%)`; ctx.fillRect(66 + i * 8, 96 - h, 6, h);
    }
    drawTextC(ctx, 'RESCUE THE BAND', VW / 2, 30, beat > 0.5 ? '#fff' : '#ffd34f', 2, '#000');
    drawTextC(ctx, 'LIVE!', VW / 2, 46, '#ff3fa4', 1, '#000');
    // truss + lamps
    ctx.fillStyle = '#333'; ctx.fillRect(20, 10, VW - 40, 4); for (let x = 24; x < VW - 24; x += 8) { ctx.fillStyle = '#444'; ctx.fillRect(x, 10, 1, 4); }
    const lamps = [50, 100, 150, 192, 234, 284, 334];
    lamps.forEach((lx, i) => {
      const hue = (C.lightHue + i * 50) % 360, sw = Math.sin(t * 0.9 + i) * 40;
      ctx.fillStyle = `hsla(${hue},100%,60%,${(0.10 + beat * 0.14) * lit})`;
      ctx.beginPath(); ctx.moveTo(lx, 14); ctx.lineTo(lx + sw - 24, 170); ctx.lineTo(lx + sw + 24, 170); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `hsl(${hue},100%,${70 * lit}%)`; ctx.fillRect(lx - 2, 13, 5, 4);
    });
    // stage
    ctx.fillStyle = '#2a1a12'; ctx.fillRect(0, 160, VW, 12); ctx.fillStyle = '#4a2e1c'; ctx.fillRect(0, 160, VW, 2);
    for (let x = 0; x < VW; x += 24) { ctx.fillStyle = '#1e120c'; ctx.fillRect(x, 162, 1, 10); }
    ctx.fillStyle = '#3a2a3a'; ctx.fillRect(160, 138, 64, 22); ctx.fillStyle = '#4a3a4a'; ctx.fillRect(160, 138, 64, 2); // drum riser
    ctx.fillStyle = '#222'; ctx.fillRect(40, 148, 60, 12); ctx.fillRect(290, 148, 60, 12); // wedges/amps
    for (const ax of [44, 72, 294, 322]) { ctx.fillStyle = '#111'; ctx.fillRect(ax, 132, 24, 16); ctx.fillStyle = '#333'; ctx.fillRect(ax + 2, 134, 20, 12); ctx.fillStyle = '#555'; ctx.fillRect(ax + 8 + (beat > 0.5 ? 1 : 0), 138, 8, 4); }
    // band
    const bt = beat > 0.45, play = C.phase !== 'intro' ? 'play' : 'idle';
    const anim = C.phase === 'outro' ? 'celebrate' : play;
    drawDrumKit(ctx, 192, 138, t, bt, true);
    drawMember(ctx, 'drums', 192, 128, 1, { anim, t, beat: bt });
    drawMember(ctx, 'volt', 120, 158, 1, { anim, t: t * 1.1, beat: bt });
    drawMember(ctx, 'keys', 146, 160, 1, { anim, t, beat: bt });
    drawMember(ctx, 'bass', 252, 160, -1, { anim, t, beat: bt });
    drawMember(ctx, 'riff', 290, 160, -1, { anim, t: t * 0.9, beat: bt });
    const sing = C.phase === 'song';
    drawSinger(ctx, 192, 162, 1, sing ? { anim: 'sing', t, mouth: b.mid > 0.32 ? 2 : b.mid > 0.2 ? 1 : 0, beat: bt, armUp: beat > 0.6 && (C.beatCount % 4 < 2) } : { anim: C.phase === 'outro' ? 'celebrate' : 'idle', t });
    for (const q of Game.parts) { ctx.globalAlpha = clamp(q.life / q.max * 1.5, 0, 1); if (q.note) drawText(ctx, '~', q.x, q.y, q.col); } ctx.globalAlpha = 1;
    // crowd
    for (const p of C.crowd) {
      const baseY = 186 + p.row * 11, bob = Math.round(Math.sin(t * 4.6 + p.ph) * (C.phase === 'intro' ? 0.5 : 1.2) - p.jump * 4);
      const col = ['#141020', '#1a1428', '#100c18'][p.row], skin = ['#2a2238', '#30283e', '#262032'][p.row];
      const x = Math.round(p.x), y = baseY + bob;
      ctx.fillStyle = col; ctx.fillRect(x, y, 10, 30);
      ctx.fillStyle = skin; ctx.fillRect(x + 2, y - 7, 6, 7);
      const up = p.arms || p.jump > 0.3 || C.phase === 'outro';
      if (up) { ctx.fillStyle = col; ctx.fillRect(x - 1, y - 12 - (p.jump > 0.3 ? 2 : 0), 2, 12); ctx.fillRect(x + 9, y - 12 - (p.jump > 0.3 ? 2 : 0), 2, 12); }
      if (p.phone && up) { ctx.fillStyle = (t * 2 + p.ph | 0) % 3 ? '#cfe8ff' : '#fff'; ctx.fillRect(x + 9, y - 15, 2, 3); }
    }
    for (const c of C.conf) { ctx.fillStyle = c.c; ctx.fillRect(Math.round(c.x), Math.round(c.y), 2, 1 + ((c.life * 8 | 0) % 2)); }
    // progress
    const st = Concert.songTime(), dur = C.songDur, fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    ctx.fillStyle = '#000a'; ctx.fillRect(VW / 2 - 80, VH - 9, 160, 8);
    ctx.fillStyle = '#333'; ctx.fillRect(VW / 2 - 50, VH - 6, 100, 2); ctx.fillStyle = '#ffd34f'; ctx.fillRect(VW / 2 - 50, VH - 6, 100 * clamp(st / dur, 0, 1), 2);
    drawText(ctx, fmt(st), VW / 2 - 76, VH - 8, '#fff'); drawText(ctx, fmt(dur), VW / 2 + 56, VH - 8, '#fff');
    if (C.phase === 'intro') drawTextC(ctx, t < 1.5 ? 'THE BAND IS BACK TOGETHER!' : 'GET READY...', VW / 2, 112, '#fff', 1);
    if (C.phase === 'outro') drawTextC(ctx, 'THANK YOU, GOODNIGHT!', VW / 2, 112, '#ffd34f', 2, '#000');
    drawText(ctx, 'ESC PAUSE', VW - 40, 3, '#666');
    if (!C.hasAudio && C.phase === 'song') drawTextC(ctx, '(AUDIO UNAVAILABLE)', VW / 2, 120, '#f88');
  }
};

// ---------------- title / menu backdrop ----------------
const MenuScene = {
  t: 0,
  update(dt) { this.t += dt; },
  draw(ctx) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#070414'); g.addColorStop(1, '#2a1240'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = i % 3 ? '#6a5a9a' : '#b9a8ff'; ctx.fillRect((i * 97) % VW, (i * 53) % 110, 1, 1); }
    ctx.fillStyle = 'rgba(255,240,200,0.10)'; ctx.beginPath(); ctx.moveTo(192, 0); ctx.lineTo(150, 170); ctx.lineTo(234, 170); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a1a12'; ctx.fillRect(0, 170, VW, 46); ctx.fillStyle = '#4a2e1c'; ctx.fillRect(0, 170, VW, 2);
    // empty instrument silhouettes (band kidnapped)
    ctx.globalAlpha = 0.35; drawDrumKit(ctx, 290, 170, t, false, true); ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff22'; drawText(ctx, '?', 110, 140, '#fff3', 2); drawText(ctx, '?', 260, 140, '#fff3', 2);
    drawSinger(ctx, 192, 170, 1, { anim: 'idle', t });
  }
};
