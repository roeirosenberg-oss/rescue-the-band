'use strict';
// =====================================================================
//  UI: screens, menus, settings, calibration, keyboard, main loop
// =====================================================================
const $ = id => document.getElementById(id);
const UI = {
  cur: null, ret: 'menu', debugHit: false,
  show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
    const el = $('scr-' + id); if (el) el.classList.add('on'); UI.cur = id;
    if (id === 'menu') UI.refreshMenu();
    if (id === 'gesture') UI.refreshGesture();
    if (id === 'audio') UI.refreshAudio();
    if (id === 'calibration') Calib.open();
    if (id === 'pause') UI.refreshPause();
    UI.camBoxVis();
  },
  hideAll() { document.querySelectorAll('.screen').forEach(s => s.classList.remove('on')); UI.cur = null; if (document.activeElement) document.activeElement.blur(); UI.camBoxVis(); },
  openSub(id) { UI.ret = UI.cur; UI.show(id); },
  back() { UI.show(UI.ret || 'menu'); },
  setPlayingUI() { UI.camBoxVis(); },
  camBoxVis() {
    const S = Gesture.S, playing = (Game.mode === 'play' || Game.mode === 'training' || Game.mode === 'tutorial') && !UI.cur;
    $('camBox').style.display = (S.enabled && S.showPreview && Gesture.status === 'ready' && (playing || UI.cur === 'gesture')) ? 'block' : 'none';
    $('camBtn').style.display = (S.enabled && playing) ? 'block' : 'none';
    $('camBtn').textContent = S.showPreview ? 'HIDE CAM' : 'SHOW CAM';
    fit();
  },
  camStatus() {
    const G = Gesture, txt = G.status === 'ready' ? 'Camera ready (processed locally in your browser)' : G.status === 'loading' ? G.msg : G.status === 'error' ? 'Camera error: ' + G.msg : 'Camera off — keyboard controls active';
    document.querySelectorAll('.camstat').forEach(e => { e.textContent = txt; e.className = 'camstat ' + G.status; });
    document.querySelectorAll('.camtoggle').forEach(b => b.textContent = (G.status === 'ready' || G.status === 'loading') ? 'DISABLE CAMERA' : 'ENABLE CAMERA');
    UI.camBoxVis();
  },
  toggleCam() { if (Gesture.status === 'ready' || Gesture.status === 'loading') Gesture.stop(); else Gesture.start(); },
  refreshMenu() {
    const s = Game.loadSave(), b = $('btnContinue');
    if (s && (s.rescued.length > 0 || s.stage > 1 || s.checkpoint || s.prologueDone === false)) { b.style.display = ''; b.textContent = s.rescued.length === 5 ? 'CONTINUE (FINAL CONCERT)' : (s.prologueDone === false && !s.rescued.length && s.stage === 1 && !s.checkpoint) ? 'CONTINUE (PROLOGUE)' : `CONTINUE (STAGE ${s.stage}/3 · ${s.rescued.length}/5)`; }
    else b.style.display = 'none';
    $('btnConcert').style.display = s && s.rescued.length === 5 ? '' : 'none';
    UI.camStatus();
  },
  refreshPause() { $('btnRestartCp').style.display = Game.mode === 'play' ? '' : 'none'; $('pauseTitle').textContent = Game.mode === 'concert' ? 'CONCERT PAUSED' : Game.mode === 'training' ? 'TRAINING PAUSED' : (Game.mode === 'tutorial' || Game.mode === 'prologue') ? 'PROLOGUE PAUSED' : 'PAUSED'; $('btnPausePreview').textContent = Gesture.S.showPreview ? 'HIDE CAMERA PREVIEW' : 'SHOW CAMERA PREVIEW'; },
  refreshAudio() { const v = AudioMgr.vol; for (const k of ['master', 'music', 'sfx', 'voice', 'ambient']) { $('vol-' + k).value = Math.round(v[k] * 100); $('vol-' + k + '-v').textContent = Math.round(v[k] * 100); } $('vol-mute').checked = !!v.muted; },
  refreshGesture() {
    const S = Gesture.S;
    $('g-swap').checked = S.swap; $('g-preview').checked = S.showPreview; $('g-lm').checked = S.showLandmarks;
    $('g-sensR').value = Math.round(S.R.sens * 100); $('g-sensL').value = Math.round(S.L.sens * 100);
    $('g-stab').value = S.stability; $('g-loss').value = S.lossMs;
    UI.liveGesture();
  },
  liveGesture() {
    const H = Gesture.hands, S = Gesture.S;
    $('g-sensR-v').textContent = Math.round(S.R.sens * 100); $('g-sensL-v').textContent = Math.round(S.L.sens * 100);
    $('g-stab-v').textContent = S.stability + ' frames'; $('g-loss-v').textContent = S.lossMs + ' ms';
    const line = r => { const h = H[r]; return `${r === 'R' ? 'RIGHT (move)' : 'LEFT (action)'}: ${h.present ? 'seen' : 'not seen'} | raw ${h.raw} | stable ${h.stable} | fingers ${h.ext.map(v => v.toFixed(2)).join(' ')} | ${S[r].thr ? 'calibrated' : 'default thresholds'}`; };
    $('g-live').textContent = line('R') + '\n' + line('L') + `\ndetection ${Gesture.fps.toFixed(0)} fps`;
  },
  drawLandmarks() {
    const cv = $('camOverlay'), x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height);
    if (!Gesture.S.showLandmarks || $('camBox').style.display === 'none') return;
    for (const r of ['R', 'L']) { const h = Gesture.hands[r]; if (h.present && h.lm) drawHandLm(x, h.lm, cv.width, cv.height, r === 'R' ? '#4fe3ff' : '#ff7ab8', false); }
  }
};
const HAND_LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
function drawHandLm(x, lm, w, h, col, mirror) {
  const P = i => [mirror ? (1 - lm[i].x) * w : lm[i].x * w, lm[i].y * h];
  x.strokeStyle = col; x.lineWidth = 2; x.beginPath();
  for (const [a, b] of HAND_LINKS) { const A = P(a), B = P(b); x.moveTo(A[0], A[1]); x.lineTo(B[0], B[1]); } x.stroke();
  x.fillStyle = '#fff'; for (let i = 0; i < 21; i++) { const A = P(i); x.fillRect(A[0] - 2, A[1] - 2, 4, 4); }
}

// ---------------- calibration wizard ----------------
const Calib = {
  steps: [
    { role: 'R', kind: 'check', text: 'Raise only your RIGHT hand (palm toward the camera).' },
    { role: 'R', kind: 'rec', g: 'OPEN', text: 'RIGHT hand: hold an OPEN PALM.' },
    { role: 'R', kind: 'rec', g: 'FIST', text: 'RIGHT hand: make a fully CLOSED FIST.' },
    { role: 'R', kind: 'verify', g: 'INDEX', text: 'RIGHT hand: fist with only the INDEX finger extended.' },
    { role: 'L', kind: 'check', text: 'Now raise only your LEFT hand.' },
    { role: 'L', kind: 'rec', g: 'OPEN', text: 'LEFT hand: hold an OPEN PALM.' },
    { role: 'L', kind: 'rec', g: 'FIST', text: 'LEFT hand: make a fully CLOSED FIST.' },
    { role: 'L', kind: 'verify', g: 'INDEX', text: 'LEFT hand: fist with only the INDEX finger extended.' }
  ],
  i: 0, t: 0, prog: 0, samples: [], data: { R: {}, L: {} }, lastFrame: -1, wrong: 0, done: false,
  open() { Calib.i = 0; Calib.reset(); Calib.done = false; Calib.data = { R: {}, L: {} }; Calib.render(); },
  reset() { Calib.t = 0; Calib.prog = 0; Calib.samples = []; Calib.wrong = 0; $('calSwap').style.display = 'none'; },
  next() { if (Calib.i < Calib.steps.length - 1) { Calib.i++; Calib.reset(); } else { Calib.done = true; Gesture.save(); } Calib.render(); },
  render() {
    const s = Calib.steps[Calib.i];
    $('calStep').textContent = Calib.done ? 'DONE' : `STEP ${Calib.i + 1}/${Calib.steps.length}`;
    $('calText').textContent = Calib.done ? 'Calibration saved for both hands. You can fine-tune sensitivity in Gesture Settings.' : (Gesture.status !== 'ready' ? 'Enable the camera to calibrate.' : s.text);
    $('calEnable').style.display = Gesture.status === 'ready' ? 'none' : '';
  },
  update(dt) {
    if (UI.cur !== 'calibration') return;
    Calib.draw();
    if (Gesture.status !== 'ready' || Calib.done) { $('calProg').style.width = (Calib.done ? 100 : 0) + '%'; return; }
    const s = Calib.steps[Calib.i], h = Gesture.hands[s.role], o = Gesture.hands[s.role === 'R' ? 'L' : 'R'];
    const fresh = Gesture.frames !== Calib.lastFrame; Calib.lastFrame = Gesture.frames;
    let info = '';
    if (s.kind === 'check') {
      if (h.present && !o.present) Calib.prog += dt / 1.0;
      if (!h.present && o.present) { Calib.wrong += dt; if (Calib.wrong > 1.2) { $('calSwap').style.display = ''; info = 'That hand is being detected as your ' + (s.role === 'R' ? 'LEFT' : 'RIGHT') + '. If you are using the correct hand, press SWAP HANDS.'; } }
      else Calib.wrong = Math.max(0, Calib.wrong - dt);
      if (!info) info = h.present ? 'Detected ' + (s.role === 'R' ? 'RIGHT' : 'LEFT') + ' hand ✓' : 'Waiting for the ' + (s.role === 'R' ? 'RIGHT' : 'LEFT') + ' hand...';
    } else if (s.kind === 'rec') {
      if (h.present) { Calib.t += dt; if (Calib.t > 0.6 && fresh) Calib.samples.push(h.ext.slice()); }
      Calib.prog = Calib.samples.length / 24;
      info = h.present ? 'Hold still...' : 'Show your ' + (s.role === 'R' ? 'RIGHT' : 'LEFT') + ' hand';
      if (Calib.prog >= 1) {
        const mean = [0, 1, 2, 3].map(f => Calib.samples.reduce((a, v) => a + v[f], 0) / Calib.samples.length);
        Calib.data[s.role][s.g] = mean;
        const d = Calib.data[s.role];
        if (d.OPEN && d.FIST) {
          Gesture.S[s.role].thr = [0, 1, 2, 3].map(f => { const gap = d.OPEN[f] - d.FIST[f]; return gap > 0.08 ? clamp(d.FIST[f] + gap * 0.45, 0.95, 1.7) : 1.18; });
          Gesture.save();
        }
      }
    } else if (s.kind === 'verify') {
      if (h.present && h.raw === s.g && fresh) Calib.prog += 1 / 14;
      info = h.present ? 'Recognised as: ' + h.raw : 'Show your ' + (s.role === 'R' ? 'RIGHT' : 'LEFT') + ' hand';
    }
    $('calInfo').textContent = info;
    $('calProg').style.width = Math.round(clamp(Calib.prog, 0, 1) * 100) + '%';
    if (Calib.prog >= 1) { AudioMgr.play('ui'); Calib.next(); }
  },
  draw() {
    const cv = $('calCanvas'), x = cv.getContext('2d'), v = Gesture.video;
    x.fillStyle = '#111'; x.fillRect(0, 0, cv.width, cv.height);
    if (v && v.readyState >= 2 && Gesture.status === 'ready') { x.save(); x.translate(cv.width, 0); x.scale(-1, 1); x.drawImage(v, 0, 0, cv.width, cv.height); x.restore(); }
    else { x.fillStyle = '#888'; x.font = '12px monospace'; x.fillText('Camera off', 20, 30); }
    for (const r of ['R', 'L']) { const h = Gesture.hands[r]; if (h.present && h.lm) { drawHandLm(x, h.lm, cv.width, cv.height, r === 'R' ? '#4fe3ff' : '#ff7ab8', true); const w = h.lm[0]; x.fillStyle = r === 'R' ? '#4fe3ff' : '#ff7ab8'; x.font = 'bold 16px monospace'; x.fillText((r === 'R' ? 'RIGHT ' : 'LEFT ') + h.raw, (1 - w.x) * cv.width - 40, w.y * cv.height + 26); } }
  }
};

// ---------------- game flow ----------------
const Flow = {
  startGate() {
    if (UI.cur !== 'gate') return;
    AudioMgr.init(); Game.mode = 'menu';
    AudioMgr.setMusic('menu', 'explore'); AudioMgr.setAmbient('menu');
    UI.show('menu');
    if (Gesture.S.enabled) Gesture.start();
  },
  beginPlay() { Game.paused = false; Game.mode = 'play'; Input.clear(); UI.hideAll(); Game.fade = 1; Game.fadeTo(0); },
  newGame() { Game.sv = Game.newSave(); Game.sv.prologueDone = false; Store.set('rtb_save', Game.sv); Game.stats = { hits: 0, swings: 0, misses: 0 }; Prologue.start(); },
  continueGame() {
    const s = Game.loadSave(); if (!s) return Flow.newGame();
    Game.sv = s;
    if (s.prologueDone === false && !s.rescued.length && s.stage === 1 && !s.checkpoint) { Game.stats = { hits: 0, swings: 0, misses: 0 }; Prologue.start(); return; }
    if (BAND_ORDER.every(m => s.rescued.includes(m))) { Flow.beginPlay(); Concert.start(); return; }
    let st = s.stage; while (s.completed.includes(st) && st < 3) st++; s.stage = st;
    Flow.beginPlay(); Game.loadStage(st);
  },
  training() { Game.sv = Game.loadSave() || Game.newSave(); Game.paused = false; Game.mode = 'training'; Input.clear(); UI.hideAll(); Game.stats = { hits: 0, swings: 0, misses: 0 }; EventLog.items = []; Game.fade = 1; Game.fadeTo(0); Game.loadStage('train'); },
  watchConcert() { Game.sv = Game.loadSave(); if (Game.sv) { Flow.beginPlay(); Concert.start(); } },
  toMenu() {
    AudioMgr.resume(); AudioMgr.stopFinale(); AudioMgr.stopCue && AudioMgr.stopCue();
    Game.paused = false; Game.mode = 'menu'; Game.cut = null; Game.fade = 0; Game.fadeTarget = 0; Game.onFadeDone = null; Game.transitioning = false;
    AudioMgr.setMusic('menu', 'explore'); AudioMgr.setAmbient('menu'); AudioMgr.duck(false);
    Tip.reset(); Tutorial.hideUI(); UI.show('menu');
  },
  pause() {
    if (!['play', 'training', 'tutorial', 'prologue', 'concert'].includes(Game.mode) || Game.paused || Game.frozen) return;
    Game.paused = true; AudioMgr.suspend(); UI.show('pause');
  },
  resume() { if (!Game.paused) return; Game.paused = false; Input.clear(); UI.hideAll(); AudioMgr.resume(); },
  restartCheckpoint() { Flow.resume(); AudioMgr.stopCue && AudioMgr.stopCue(); Game.loadStage(Game.stage, { noCard: true }); }
};
AudioMgr.stopCue = function () { if (AudioMgr.cue) { try { AudioMgr.cue.src.onended = null; AudioMgr.cue.src.stop(); } catch (e) { } AudioMgr.cue = null; AudioMgr.duck(false); } };

// ---------------- bindings ----------------
function bindUI() {
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', e => { AudioMgr.play('ui'); fn(e); }); };
  $('scr-gate').addEventListener('pointerdown', () => Flow.startGate());
  on('btnContinue', Flow.continueGame); on('btnNew', () => { const s = Game.loadSave(); if (s && (s.rescued.length || s.stage > 1)) UI.show('confirm'); else Flow.newGame(); });
  on('btnYesNew', Flow.newGame); on('btnNoNew', () => UI.show('menu'));
  on('btnTrain', Flow.training); on('btnConcert', Flow.watchConcert);
  document.querySelectorAll('.camtoggle').forEach(b => b.addEventListener('click', () => { AudioMgr.play('ui'); UI.toggleCam(); }));
  on('btnCalib', () => UI.openSub('calibration')); on('btnGest', () => UI.openSub('gesture')); on('btnAudio', () => UI.openSub('audio')); on('btnHelp', () => UI.openSub('help'));
  document.querySelectorAll('.backbtn').forEach(b => b.addEventListener('click', () => { AudioMgr.play('ui'); UI.back(); }));
  on('btnResume', Flow.resume); on('btnRestartCp', Flow.restartCheckpoint); on('btnPauseMenu', Flow.toMenu);
  on('btnPauseAudio', () => UI.openSub('audio')); on('btnPauseGest', () => UI.openSub('gesture')); on('btnPauseCalib', () => UI.openSub('calibration'));
  on('btnPausePreview', () => { Gesture.S.showPreview = !Gesture.S.showPreview; Gesture.save(); UI.refreshPause(); });
  on('btnReplay', () => { UI.hideAll(); Concert.start(); }); on('btnEndMenu', Flow.toMenu); on('btnEndNew', Flow.newGame);
  $('tutNext').addEventListener('click', () => { Tutorial.advanceLine(); $('tutNext').blur(); });
  $('skipTut').addEventListener('click', () => { AudioMgr.play('ui'); $('skipTut').blur(); Tutorial.skip(); });
  $('tipOk').addEventListener('click', () => { AudioMgr.play('ui'); Tip.ok(); });
  $('camBtn').addEventListener('click', () => { Gesture.S.showPreview = !Gesture.S.showPreview; Gesture.save(); UI.camBoxVis(); $('camBtn').blur(); });
  // audio settings
  for (const k of ['master', 'music', 'sfx', 'voice', 'ambient']) $('vol-' + k).addEventListener('input', e => { AudioMgr.setVol(k, e.target.value / 100); $('vol-' + k + '-v').textContent = e.target.value; });
  $('vol-mute').addEventListener('change', e => AudioMgr.setVol('muted', e.target.checked));
  on('testMusic', () => { const st = AudioMgr.music.style; AudioMgr.setMusic(st || 'menu', 'combat'); setTimeout(() => AudioMgr.setIntensity('explore'), 2500); });
  on('testSfx', () => { AudioMgr.play('swing'); setTimeout(() => AudioMgr.play('impact', {}), 120); setTimeout(() => AudioMgr.play('keyPickup'), 500); });
  on('testVoice', () => { AudioMgr.play('effort'); setTimeout(() => AudioMgr.play('yeah'), 450); });
  on('testAmb', () => AudioMgr.play('thunder'));
  // gesture settings
  const G = Gesture.S;
  $('g-swap').addEventListener('change', e => { G.swap = e.target.checked; Gesture.resetHands(); Gesture.save(); });
  $('g-preview').addEventListener('change', e => { G.showPreview = e.target.checked; Gesture.save(); UI.camBoxVis(); });
  $('g-lm').addEventListener('change', e => { G.showLandmarks = e.target.checked; Gesture.save(); });
  $('g-sensR').addEventListener('input', e => { G.R.sens = e.target.value / 100; Gesture.save(); });
  $('g-sensL').addEventListener('input', e => { G.L.sens = e.target.value / 100; Gesture.save(); });
  $('g-stab').addEventListener('input', e => { G.stability = +e.target.value; Gesture.save(); });
  $('g-loss').addEventListener('input', e => { G.lossMs = +e.target.value; Gesture.save(); });
  on('g-resetR', () => { G.R.thr = null; G.R.sens = 0.5; Gesture.save(); UI.refreshGesture(); });
  on('g-resetL', () => { G.L.thr = null; G.L.sens = 0.5; Gesture.save(); UI.refreshGesture(); });
  on('g-calib', () => { UI.show('calibration'); });
  on('calSwap', () => { G.swap = !G.swap; Gesture.resetHands(); Gesture.save(); Calib.reset(); });
  on('calSkip', () => Calib.next()); on('calRestart', () => Calib.open());
  on('calEnable', () => { Gesture.start().then(() => Calib.render()); });
  setInterval(() => { if (UI.cur === 'gesture') UI.liveGesture(); }, 120);

  // keyboard
  const GAMEKEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  window.addEventListener('keydown', e => {
    if (UI.cur === 'gate') { Flow.startGate(); e.preventDefault(); return; }
    const tag = (e.target && e.target.tagName) || '';
    if (Game.frozen) { // tip/countdown: no gameplay input, no pause, keys can't activate OK
      Input.keys[e.code] = true; if (e.code !== 'Tab') e.preventDefault(); return;
    }
    const inGame = (Game.mode === 'play' || Game.mode === 'training' || Game.mode === 'tutorial') && !Game.paused && !UI.cur;
    if (GAMEKEYS.includes(e.code) && (inGame || tag !== 'INPUT')) { if (inGame) e.preventDefault(); }
    Input.keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'Escape') {
      if (Game.paused && UI.cur === 'pause') Flow.resume();
      else if (['play', 'training', 'tutorial', 'prologue', 'concert'].includes(Game.mode) && !Game.paused && !UI.cur) Flow.pause();
      else if (['audio', 'gesture', 'calibration', 'help'].includes(UI.cur)) UI.back();
      else if (UI.cur === 'confirm') UI.show('menu');
      e.preventDefault(); return;
    }
    if (e.code === 'Enter' && Game.mode === 'prologue' && !Game.paused && !UI.cur) { Prologue.skipIntro(); return; }
    if (!inGame) return;
    if (e.code === 'Enter' && Game.mode === 'tutorial') { e.preventDefault(); Tutorial.advanceLine(); }
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') Input.press('jump', 'kb');
    if (e.code === 'KeyJ') Input.press('attack', 'kb');
    if (e.code === 'KeyC') { Gesture.S.showPreview = !Gesture.S.showPreview; Gesture.save(); UI.camBoxVis(); }
    if (e.code === 'KeyH' && Game.mode === 'training') Game.hurtPlayer(1, Game.player.x + Game.player.w / 2 + Game.player.f * 10);
    if (e.code === 'KeyB' && e.shiftKey) UI.debugHit = !UI.debugHit;
  });
  window.addEventListener('keyup', e => { Input.keys[e.code] = false; });
  window.addEventListener('blur', () => { Input.keys = {}; if (['play', 'training', 'tutorial', 'prologue', 'concert'].includes(Game.mode)) Flow.pause(); });
  window.addEventListener('resize', fit); fit();
}
const CAM_COL = 176; // width reserved beside the game for the webcam preview when needed
function scaleFor(W, H) { let s = Math.min(W / VW, H / VH); if (s >= 2) s = Math.floor(s * 2) / 2; return s; }
function fit() {
  const W = window.innerWidth, H = window.innerHeight, wr = $('wrap');
  let s = scaleFor(W, H), reserve = false;
  if ($('camBox').style.display === 'block') {
    const side = (W - VW * s) / 2, below = (H - VH * s) / 2;
    if (side < CAM_COL && below < 140) { const s2 = scaleFor(W - CAM_COL - 8, H); if (s2 >= 2) { s = s2; reserve = true; } }
  }
  const w = Math.floor(VW * s), h = Math.floor(VH * s);
  wr.style.width = w + 'px'; wr.style.height = h + 'px'; wr.style.setProperty('--u', (w / VW) + 'px');
  wr.style.marginRight = reserve ? (CAM_COL + 8) + 'px' : '0px';
  placeCam();
}
// Webcam preview placement: prefer the empty letterbox space beside or below the game so it never
// covers gameplay; only if there is no room, fall back to a compact box in the top-right sky area.
function placeCam() {
  const box = $('camBox'), btn = $('camBtn'), r = $('wrap').getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
  const side = W - r.right, below = H - r.bottom, gap = 8, BTN = 28;
  let bw, bx, by, mode;
  if (side - gap * 2 >= 140) { mode = 'side'; bw = Math.min(side - gap * 2, 360); bx = r.right + gap; by = r.bottom - bw * 0.75 - BTN; }
  else if (below - gap - BTN >= 96) { mode = 'below'; bw = Math.min((below - gap - BTN) * 4 / 3, 320); bx = r.right - bw; by = r.bottom + gap; }
  else { mode = 'inside'; bw = r.width * 0.17; bx = r.right - bw - r.width * 0.01; by = r.top + r.height * (26 / 216); }
  const bh = bw * 0.75;
  Object.assign(box.style, { left: bx + 'px', top: Math.max(gap, by) + 'px', width: bw + 'px', height: bh + 'px' });
  box.classList.toggle('inside', mode === 'inside'); box.dataset.mode = mode;
  Object.assign(btn.style, { left: (bx + bw) + 'px', top: (Math.max(gap, by) + bh + 4) + 'px', transform: 'translateX(-100%)' });
}
// One-time (per page session) keyboard tip after repeated deaths
// Opening it freezes gameplay; it stays until OK is clicked, then a 3-2-1 countdown runs before play resumes.
const Tip = {
  shown: false, state: null, cd: 0, shownNum: 0,
  open() {
    if (Tip.shown || Tip.state) return;
    Tip.shown = true; Tip.state = 'open'; Game.frozen = true; Input.clear();
    if (document.activeElement) document.activeElement.blur();
    $('tip').classList.add('on');
  },
  ok() {
    if (Tip.state !== 'open') return;
    $('tip').classList.remove('on'); if (document.activeElement) document.activeElement.blur();
    Tip.state = 'countdown'; Tip.cd = 3; Tip.shownNum = 0; Tip.update(0);
  },
  update(dt) {
    if (Tip.state !== 'countdown') return;
    Tip.cd -= dt; const n = Math.ceil(Tip.cd - 1e-6);
    if (n <= 0) { Tip.end(); return; }
    if (n !== Tip.shownNum) { Tip.shownNum = n; const el = $('tipCount'); el.textContent = n; el.classList.add('on'); AudioMgr.play('ui'); }
  },
  end() { Tip.state = null; $('tip').classList.remove('on'); $('tipCount').classList.remove('on'); Game.frozen = false; Input.clear(); MainLoop.acc = 0; },
  reset() { if (Tip.state) Tip.end(); }
};
// Input gate: gameplay actions are only accepted while actually playing
const _press = Input.press.bind(Input);
Input.press = function (a, src) { if (Game.paused || Game.frozen || !(Game.mode === 'play' || Game.mode === 'training' || Game.mode === 'tutorial') || UI.cur) return; _press(a, src); };

// ---------------- main loop ----------------
const MainLoop = {
  last: 0, acc: 0, ctx: null,
  start() {
    const cv = $('game'); MainLoop.ctx = cv.getContext('2d'); MainLoop.ctx.imageSmoothingEnabled = false;
    MainLoop.last = now(); requestAnimationFrame(MainLoop.frame);
  },
  step(dt) {
    if (Game.mode === 'play' || Game.mode === 'training') Game.update(dt);
    else if (Game.mode === 'tutorial') { Game.update(dt); Tutorial.update(dt); }
    else if (Game.mode === 'prologue') Prologue.update(dt);
    else if (Game.mode === 'concert') Concert.update(dt);
    else MenuScene.update(dt);
  },
  frame() {
    const t = now(); const dt = Math.min(0.05, (t - MainLoop.last) / 1000); MainLoop.last = t;
    try {
      Gesture.update();
      if (!Game.paused && Game.frozen) Tip.update(dt);
      if (!Game.paused && !Game.frozen) {
        MainLoop.acc += dt; let n = 0;
        while (MainLoop.acc >= 1 / 60 && n < 4) { MainLoop.step(1 / 60); MainLoop.acc -= 1 / 60; n++; }
        if (n === 4) MainLoop.acc = 0;
        Game.updateFade(dt);
      }
      Calib.update(dt);
      MainLoop.render();
    } catch (e) { console.error(e); }
    requestAnimationFrame(MainLoop.frame);
  },
  render() {
    const ctx = MainLoop.ctx;
    if ((Game.mode === 'play' || Game.mode === 'training' || Game.mode === 'tutorial') && Game.lvl) Game.render(ctx);
    else if (Game.mode === 'prologue') Prologue.draw(ctx);
    else if (Game.mode === 'concert') Concert.draw(ctx);
    else MenuScene.draw(ctx);
    if (Game.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${Game.fade})`; ctx.fillRect(0, 0, VW, VH); }
    if (Game.paused) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, VW, VH); }
  }
};
window.addEventListener('DOMContentLoaded', () => {
  bindUI(); UI.show('gate'); UI.camStatus(); MainLoop.start();
  window.RTB = { Prologue, Tutorial, LESSONS, Tip, placeCam, Game, Gesture, Input, AudioMgr, LEVELS, Concert, UI, Flow, Calib, EventLog, PHYS };
});
