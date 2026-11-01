'use strict';
// =====================================================================
//  INPUT: keyboard + two-hand gestures (MediaPipe Hand Landmarker, local)
// =====================================================================
const Input = {
  keys: {}, queue: [],
  press(action, src) { this.queue.push({ action, src, t: Game.time }); },
  consume(action) { const i = this.queue.findIndex(q => q.action === action); if (i < 0) return null; return this.queue.splice(i, 1)[0]; },
  clear() { this.queue.length = 0; },
  moveDir() {
    const k = this.keys; let d = 0;
    if (k.ArrowLeft || k.KeyA) d -= 1; if (k.ArrowRight || k.KeyD) d += 1;
    if (d !== 0) return d;
    return Gesture.moveDir();
  },
  jumpHeld() { const k = this.keys; return !!(k.Space || k.ArrowUp || k.KeyW) || Gesture.jumpHeld(); },
  interactHeld() { return !!this.keys.KeyE; }
};

const G_OPEN = 'OPEN', G_FIST = 'FIST', G_INDEX = 'INDEX', G_UNK = 'UNKNOWN', G_NONE = 'NONE';

const Gesture = (() => {
  const defHand = () => ({ sens: 0.5, thr: null });
  const S = Object.assign({
    enabled: false, swap: false, stability: 4, lossMs: 250, showPreview: true, showLandmarks: true,
    R: defHand(), L: defHand(), hv: 2
  }, Store.get('rtb_gesture', {}));
  S.R = Object.assign(defHand(), S.R); S.L = Object.assign(defHand(), S.L);
  // v2 handedness fix: real-camera testing showed the physical right hand was reported as LEFT with the old
  // default (swap on). Turn swap off, and move any calibration saved under the old (inverted) roles to the right hand.
  if (Store.get('rtb_gesture', {}).hv !== 2) { if (S.swap) { S.swap = false; const r = S.R; S.R = S.L; S.L = r; } S.hv = 2; Store.set('rtb_gesture', S); }

  const mkHand = role => ({
    role, present: false, lastSeen: -1e9, raw: G_NONE, hist: [], stable: G_NONE, lastAction: G_NONE,
    ext: [0, 0, 0, 0], lm: null, score: 0, label: '', flash: '', flashT: 0
  });
  const G = {
    S, status: 'off', msg: '', video: null, lm: null, lastVT: -1, lastDetect: 0, fps: 0,
    hands: { R: mkHand('R'), L: mkHand('L') }, frames: 0, onAction: null, rawResult: null
  };
  G.save = () => Store.set('rtb_gesture', S);

  // ---------- geometry & classification ----------
  const FINGERS = [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]];
  const DEF_THR = 1.18;
  G.extensions = function (lm, aspect = 4 / 3) {
    const P = i => [lm[i].x * aspect, lm[i].y];
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const w = P(0);
    return FINGERS.map(([m, p, t]) => d(w, P(t)) / Math.max(1e-6, d(w, P(p))));
  };
  G.threshold = function (role, f) {
    const h = S[role]; const base = h.thr ? h.thr[f] : DEF_THR;
    return base + (h.sens - 0.5) * 0.3;   // higher sensitivity => curled fingers detected more easily (fists register sooner)
  };
  G.classify = function (role, ext) {
    const e = ext.map((v, f) => v > G.threshold(role, f));
    const n = e.filter(Boolean).length;
    if (n === 0) return G_FIST;
    if (e[0] && !e[1] && !e[2] && !e[3]) return G_INDEX;
    if (n >= 4 || (n === 3 && e[0] && e[1])) return G_OPEN;
    return G_UNK;
  };

  // ---------- per-hand temporal smoothing + one-shot latches ----------
  G.feed = function (role, gesture, t, extra) {
    const h = G.hands[role];
    if (gesture === G_NONE) return;
    h.present = true; h.lastSeen = t; h.raw = gesture;
    if (extra) { h.ext = extra.ext; h.lm = extra.lm; h.score = extra.score; h.label = extra.label; }
    h.hist.push(gesture); while (h.hist.length > S.stability) h.hist.shift();
    if (h.hist.length >= S.stability && h.hist.every(g => g === gesture) && h.stable !== gesture) setStable(h, gesture, t);
  };
  G.checkLoss = function (t) {
    for (const role of ['R', 'L']) {
      const h = G.hands[role];
      if (h.present && t - h.lastSeen > S.lossMs) { h.present = false; h.hist.length = 0; h.raw = G_NONE; h.lm = null; setStable(h, G_NONE, t); }
    }
  };
  function setStable(h, g, t) {
    const prev = h.stable; h.stable = g;
    if (h.role === 'L') {
      // Tracking loss (NONE) and ambiguous shapes never re-arm; returning with the same gesture never re-fires.
      if (g === G_NONE || g === G_UNK) return;
      if (g === h.lastAction) return;
      h.lastAction = g;              // a genuine stable change: re-arms and possibly fires
      if (g === G_FIST) fire(h, 'attack', t);
      else if (g === G_INDEX) fire(h, 'jump', t);
    }
    if (G.onStable) G.onStable(h.role, prev, g);
  }
  function fire(h, action, t) {
    h.flash = action.toUpperCase(); h.flashT = t;
    Input.press(action, 'gesture');
    EventLog.push('L ' + h.stable + ' > ' + action.toUpperCase());
  }
  G.moveDir = function () {
    if (!S.enabled) return 0;
    const h = G.hands.R; if (!h.present) return 0;
    return h.stable === G_FIST ? 1 : h.stable === G_INDEX ? -1 : 0;
  };
  G.jumpHeld = function () { const h = G.hands.L; return S.enabled && h.present && h.stable === G_INDEX; };
  G.resetHands = function () { G.hands.R = mkHand('R'); G.hands.L = mkHand('L'); };

  // Assign physical roles strictly from handedness metadata (never from screen position or array order).
  // MediaPipe's label is used directly by default (verified with a real webcam); 'Swap handedness' inverts it if needed.
  G.assign = function (result) {
    const out = { R: null, L: null };
    const n = result && result.landmarks ? result.landmarks.length : 0;
    const cands = [];
    for (let i = 0; i < n; i++) {
      const hd = (result.handedness || result.handednesses || [])[i]; if (!hd || !hd[0]) continue;
      const label = hd[0].categoryName || hd[0].label; const score = hd[0].score;
      let role = label === 'Right' ? 'R' : 'L'; if (S.swap) role = role === 'R' ? 'L' : 'R';
      cands.push({ i, role, score, label });
    }
    cands.sort((a, b) => b.score - a.score);
    for (const c of cands) {
      if (!out[c.role]) out[c.role] = c;
      else { const other = c.role === 'R' ? 'L' : 'R'; if (!out[other] && c.score < 0.9) out[other] = Object.assign({}, c, { role: other, inferred: true }); }
    }
    return out;
  };
  G.process = function (result, t) {
    G.rawResult = result;
    const as = G.assign(result);
    for (const role of ['R', 'L']) {
      const c = as[role]; if (!c) continue;
      const lm = result.landmarks[c.i];
      const ext = G.extensions(lm, G.video ? (G.video.videoWidth / Math.max(1, G.video.videoHeight)) : 4 / 3);
      G.feed(role, G.classify(role, ext), t, { ext, lm, score: c.score, label: c.label });
    }
  };

  // ---------- camera + model ----------
  const MP_VER = '0.10.14';
  G.start = async function () {
    if (G.status === 'ready' || G.status === 'loading') return;
    G.status = 'loading'; G.msg = 'Starting camera...'; UI.camStatus();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Camera API unavailable in this browser/context');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
      const v = G.video = document.getElementById('camVideo');
      v.srcObject = stream; v.muted = true; v.playsInline = true; await v.play();
      G.msg = 'Loading hand model...'; UI.camStatus();
      if (!G.lm) {
        const vision = await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}/vision_bundle.mjs`);
        const fs = await vision.FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}/wasm`);
        const opts = d => ({
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: d },
          runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5
        });
        try { G.lm = await vision.HandLandmarker.createFromOptions(fs, opts('GPU')); }
        catch (e) { G.lm = await vision.HandLandmarker.createFromOptions(fs, opts('CPU')); }
      }
      S.enabled = true; G.save();
      G.status = 'ready'; G.msg = 'Camera ready'; UI.camStatus();
    } catch (e) {
      console.error(e); G.status = 'error';
      G.msg = (e && e.name === 'NotAllowedError') ? 'Camera permission denied' : (e && e.message ? e.message : 'Camera error');
      S.enabled = false;
      if (G.video && G.video.srcObject) { G.video.srcObject.getTracks().forEach(t => t.stop()); G.video.srcObject = null; }
      UI.camStatus();
    }
  };
  G.stop = function () {
    if (G.video && G.video.srcObject) { G.video.srcObject.getTracks().forEach(t => t.stop()); G.video.srcObject = null; }
    S.enabled = false; G.save(); G.status = 'off'; G.msg = 'Camera off'; G.resetHands(); UI.camStatus();
  };
  G.update = function () {
    const t = now();
    if (G.status === 'ready' && G.lm && G.video && G.video.readyState >= 2) {
      if (G.video.currentTime !== G.lastVT && t - G.lastDetect > 30) {
        G.lastVT = G.video.currentTime;
        const dt = t - G.lastDetect; G.lastDetect = t; G.fps = lerp(G.fps, 1000 / Math.max(1, dt), 0.1);
        try { const r = G.lm.detectForVideo(G.video, t); G.process(r, t); } catch (e) { console.warn(e); }
        G.frames++;
      }
    }
    G.checkLoss(t);
    UI.drawLandmarks();
  };
  return G;
})();
