'use strict';
// =====================================================================
//  HUD (drawn on the pixel canvas)
// =====================================================================
const HUD = {
  draw(ctx) {
    const p = Game.player, t = Game.time, training = Game.mode === 'training', nonStage = Game.mode !== 'play';
    // top bar
    ctx.fillStyle = '#0009'; ctx.fillRect(0, 0, VW, 22);
    for (let i = 0; i < p.maxHp; i++) drawHeart(ctx, 5 + i * 9, 4, i < p.hp);
    drawText(ctx, Game.mode === 'tutorial' ? 'PROLOGUE' : training ? 'TRAINING' : 'STAGE ' + Game.stage + '/3', 5, 13, '#cfd');
    // band rescued counter
    const rescued = Game.sv ? Game.sv.rescued : [];
    const bx = 120; drawText(ctx, 'BAND', bx, 4, '#fff');
    BAND_ORDER.forEach((id, i) => {
      const on = rescued.includes(id), x = bx + 18 + i * 9;
      ctx.fillStyle = on ? BAND[id].skin : '#333'; ctx.fillRect(x, 4, 6, 6); ctx.fillStyle = on ? BAND[id].hair : '#222'; ctx.fillRect(x, 3, 6, 2);
      if (on) { ctx.fillStyle = '#000'; ctx.fillRect(x + 2, 6, 1, 1); ctx.fillRect(x + 4, 6, 1, 1); }
    });
    drawText(ctx, rescued.length + '/5', bx + 66, 4, rescued.length === 5 ? '#ffd34f' : '#fff');
    drawText(ctx, 'RESCUED', bx + 18, 13, '#889');
    // key status
    if (!nonStage) {
      const id = 'key-' + Game.stage, col = STAGE_COL[Game.stage];
      const st = p.keys.has(id) ? 'GOT IT' : (Game.cages.some(c => c.stage === Game.stage && c.state !== 'locked') ? 'USED' : 'NONE');
      const kx = 214; ctx.fillStyle = '#222'; ctx.fillRect(kx, 3, 13, 9);
      drawKeyShape(new Painter(ctx, 0, 0, 1), kx + 2, 5, st === 'NONE' ? '#555' : col);
      drawText(ctx, 'KEY ' + Game.stage, kx + 16, 4, '#fff'); drawText(ctx, st, kx + 16, 13, st === 'GOT IT' ? col : '#889');
    }
    // camera status
    const cs = Gesture.status, hands = Gesture.hands;
    let ctext = 'CAM OFF', ccol = '#888';
    if (cs === 'loading') { ctext = 'CAM LOADING'; ccol = '#ff4'; }
    else if (cs === 'error') { ctext = 'CAM ERROR'; ccol = '#f66'; }
    else if (cs === 'ready') { const n = (hands.R.present ? 1 : 0) + (hands.L.present ? 1 : 0); ctext = n === 2 ? 'CAM 2 HANDS' : n === 1 ? 'CAM 1 HAND' : 'CAM NO HANDS'; ccol = n === 2 ? '#7f7' : n ? '#ff4' : '#f96'; }
    drawText(ctx, ctext, VW - 5 - textWidth(ctext), 4, ccol);
    drawText(ctx, 'ESC PAUSE', VW - 5 - textWidth('ESC PAUSE'), 13, '#889');
    // hands panel
    HUD.hands(ctx, 4, VH - 34);
    // boss / guardian bar
    const b = Game.bossBar;
    if (b && !b.dead) {
      const w = 150, x = Gesture.S.enabled ? VW - w - 8 : (VW - w) / 2, y = VH - 14;
      ctx.fillStyle = '#000b'; ctx.fillRect(x - 3, y - 9, w + 6, 15);
      drawTextC(ctx, b.name, x + w / 2, y - 7, b.phase2 ? '#f66' : '#fff', 1, null);
      ctx.fillStyle = '#400'; ctx.fillRect(x, y, w, 3); ctx.fillStyle = b.phase2 ? '#f33' : '#e34'; ctx.fillRect(x, y, w * Math.max(0, b.hp) / b.maxHp, 3);
    }
    // messages
    Game.msgs.forEach((m, i) => { const y = 30 + i * 10; const w = textWidth(m.text) + 8; ctx.fillStyle = '#000a'; ctx.fillRect((VW - w) / 2, y - 2, w, 9); drawTextC(ctx, m.text, VW / 2, y, m.col, 1, null); });
    // training extras
    if (training) {
      ctx.fillStyle = '#0008'; ctx.fillRect(VW - 118, 26, 114, 84);
      drawText(ctx, 'EVENT LOG', VW - 114, 29, '#9cf');
      EventLog.items.slice(0, 8).forEach((e, i) => drawText(ctx, e.s.slice(0, 27), VW - 114, 38 + i * 7, now() - e.t < 600 ? '#fff' : '#889'));
      const s = Game.stats; drawText(ctx, `SWINGS ${s.swings} HITS ${s.hits} MISS ${s.misses} STOMPS ${s.stomps || 0}`, 6, 26, '#cfd');
      drawText(ctx, 'H = TAKE DAMAGE   ESC = MENU', 6, 34, '#889');
    }
    // stage title card
    if (Game.card) {
      const a = clamp(Game.card.t / 0.5, 0, 1); ctx.globalAlpha = a;
      ctx.fillStyle = '#000c'; ctx.fillRect(0, 70, VW, 62);
      drawTextC(ctx, Game.card.title, VW / 2, 78, '#ffd34f', 2); drawTextC(ctx, Game.card.sub, VW / 2, 96, '#fff', 2); drawTextC(ctx, Game.card.info, VW / 2, 116, '#9cf', 1);
      ctx.globalAlpha = 1;
    }
    if (Game.player.dead && Game.player.deadT > 0.6) { drawTextC(ctx, 'OUCH! RESPAWNING...', VW / 2, VH / 2 - 10, '#f88', 2); }
  },
  hands(ctx, x, y) {
    const S = Gesture.S, H = Gesture.hands;
    if (!S.enabled) { drawText(ctx, 'KEYS: A/D MOVE  SPACE JUMP  J ATTACK', x + 2, y + 24, '#667'); return; }
    const box = (bx, label, h, line, col) => {
      ctx.fillStyle = '#000a'; ctx.fillRect(bx, y, 74, 30); ctx.fillStyle = col; ctx.fillRect(bx, y, 74, 1);
      drawText(ctx, label, bx + 3, y + 3, col); drawHandIcon(ctx, bx + 4, y + 13, h.present ? h.stable : 'NONE', h.present ? '#fff' : '#555');
      drawText(ctx, h.present ? h.stable : 'LOST', bx + 18, y + 12, h.present ? '#fff' : '#f96');
      drawText(ctx, line, bx + 18, y + 21, col);
    };
    const R = H.R, dir = Gesture.moveDir();
    box(x + 78, 'R MOVE', R, !R.present ? 'STOPPED' : dir > 0 ? 'WALK >' : dir < 0 ? '< WALK' : 'STOP', '#4fe3ff');
    const L = H.L, fl = now() - L.flashT < 450 ? L.flash + '!' : (!L.present ? 'NO ACTION' : (L.stable === 'OPEN' ? 'READY' : (L.stable === L.lastAction ? 'HOLDING' : '...')));
    box(x, 'L ACTION', L, fl, now() - L.flashT < 450 ? '#ffd34f' : '#ff7ab8');
  }
};
