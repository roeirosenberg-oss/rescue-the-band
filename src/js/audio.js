'use strict';
// =====================================================================
//  AUDIO MANAGER — central, event-driven. Buses: master > music/sfx/voice/ambient
// =====================================================================
const AudioMgr = (() => {
  const A = {
    ctx: null, ready: false, decoded: false, buffers: {},
    vol: Object.assign({ master: 0.8, music: 0.65, sfx: 0.8, voice: 0.8, ambient: 0.55, muted: false }, Store.get('rtb_audio', {})),
    bus: {}, music: { style: null, intensity: 'explore', step: 0, bar: 0, next: 0, on: false },
    cue: null, finale: null, amb: null, lastFoot: 0
  };
  // playback gains for embedded files (prepared cues are loudness-matched at build time)
  const FILE_GAIN = { rescue1: 0.9, rescue2: 0.95, rescue3: 0.8, finale: 0.85 };

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended' && !Game.paused) A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = A.ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(ctx.destination);
    const g = () => ctx.createGain();
    A.bus.master = g(); A.bus.master.connect(comp);
    for (const k of ['music', 'sfx', 'voice', 'ambient']) { A.bus[k] = g(); A.bus[k].connect(A.bus.master); }
    A.bus.bgm = g(); A.bus.bgm.connect(A.bus.music);           // procedural background music (duckable)
    A.bus.duck = A.bus.bgm.gain;
    A.layers = {};
    for (const k of ['pad', 'arp', 'bass', 'drums', 'hats', 'lead']) { A.layers[k] = g(); A.layers[k].gain.value = 0; A.layers[k].connect(A.bus.bgm); }
    // noise buffer
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.noiseBuf = nb;
    A.applyVolumes();
    A.ready = true;
    setInterval(A.tick, 25);
    A.decodeAll();
  };
  A.decodeAll = async function () {
    if (typeof AUDIO_DATA === 'undefined') { A.decoded = true; return; }
    for (const k of Object.keys(AUDIO_DATA)) {
      try {
        const bin = atob(AUDIO_DATA[k]); const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        A.buffers[k] = await A.ctx.decodeAudioData(u.buffer);
      } catch (e) { console.warn('decode failed', k, e); }
    }
    A.decoded = true;
  };
  A.applyVolumes = function () {
    if (!A.ctx) return;
    const t = A.ctx.currentTime, v = A.vol;
    A.bus.master.gain.setTargetAtTime(v.muted ? 0 : v.master, t, 0.02);
    A.bus.music.gain.setTargetAtTime(v.music, t, 0.02);
    A.bus.sfx.gain.setTargetAtTime(v.sfx, t, 0.02);
    A.bus.voice.gain.setTargetAtTime(v.voice, t, 0.02);
    A.bus.ambient.gain.setTargetAtTime(v.ambient, t, 0.02);
  };
  A.setVol = function (k, val) { A.vol[k] = val; A.applyVolumes(); Store.set('rtb_audio', A.vol); };
  A.suspend = function () { if (A.ctx && A.ctx.state === 'running') A.ctx.suspend(); };
  A.resume = function () { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };

  // ---------------- synthesis primitives ----------------
  function env(gn, t, a, peak, dur, rel = 0.05) {
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(peak, t + a);
    gn.gain.setValueAtTime(peak, t + Math.max(a, dur - rel));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(dest, type, f0, f1, t, dur, peak, o = {}) {
    const c = A.ctx, os = c.createOscillator(), gn = c.createGain();
    os.type = type; os.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) os.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (o.detune) os.detune.value = o.detune;
    let node = os;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 0.7; node.connect(f); node = f; }
    node.connect(gn); gn.connect(dest);
    env(gn, t, o.a || 0.004, peak, dur, o.rel || Math.min(0.08, dur * 0.5));
    os.start(t); os.stop(t + dur + 0.05);
    return os;
  }
  function noise(dest, t, dur, peak, type, f0, f1, q = 1, o = {}) {
    const c = A.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), gn = c.createGain();
    s.buffer = A.noiseBuf; s.loop = true;
    f.type = type; f.frequency.setValueAtTime(f0, t); f.Q.value = q;
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    s.connect(f); f.connect(gn); gn.connect(dest);
    env(gn, t, o.a || 0.003, peak, dur, o.rel || Math.min(0.06, dur * 0.6));
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  const VOWEL = { a: [800, 1150, 2900], o: [450, 800, 2830], e: [400, 1700, 2600], u: [325, 700, 2530], i: [300, 2200, 3000] };
  function vox(dest, t, p0, p1, v0, v1, dur, peak) {
    const c = A.ctx, os = c.createOscillator(), out = c.createGain();
    os.type = 'sawtooth'; os.frequency.setValueAtTime(p0, t); os.frequency.linearRampToValueAtTime(p1, t + dur);
    const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 6; vg.gain.value = p0 * 0.02; vib.connect(vg); vg.connect(os.frequency);
    const fa = VOWEL[v0], fb = VOWEL[v1];
    [1, 0.5, 0.25].forEach((amp, i) => {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6 + i * 3;
      bp.frequency.setValueAtTime(fa[i], t); bp.frequency.linearRampToValueAtTime(fb[i], t + dur);
      const g = c.createGain(); g.gain.value = amp; os.connect(bp); bp.connect(g); g.connect(out);
    });
    out.connect(dest); env(out, t, 0.02, peak, dur, dur * 0.4);
    os.start(t); vib.start(t); os.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
    noise(dest, t, Math.min(0.08, dur * 0.4), peak * 0.25, 'highpass', 2000, 3000, 0.5);
  }

  // ---------------- one-shot events ----------------
  const SFX = {
    footstep(o) {
      const t = A.ctx.currentTime, d = A.bus.sfx, v = (o.vol || 1) * rand(0.85, 1.1), p = rand(0.92, 1.08);
      switch (o.surface) {
        case 'wood': noise(d, t, 0.05, 0.22 * v, 'bandpass', 950 * p, 700, 1.4); tone(d, 'sine', 150 * p, 85, t, 0.07, 0.18 * v); break;
        case 'keys': noise(d, t, 0.04, 0.16 * v, 'bandpass', 1100 * p, 800, 1.4); tone(d, 'triangle', [523, 587, 659, 784, 880][irand(0, 4)], 0, t, 0.18, 0.05 * v); break;
        case 'stone': noise(d, t, 0.06, 0.28 * v, 'lowpass', 700 * p, 300, 0.8); noise(d, t, 0.015, 0.08 * v, 'highpass', 3500, 3500, 0.7); break;
        case 'metal': noise(d, t, 0.07, 0.14 * v, 'bandpass', 3200 * p, 2600, 7); tone(d, 'triangle', 1750 * p, 1650, t, 0.09, 0.035 * v); tone(d, 'sine', 120, 80, t, 0.05, 0.1 * v); break;
        case 'drum': tone(d, 'sine', 125 * p, 70, t, 0.13, 0.28 * v); noise(d, t, 0.04, 0.08 * v, 'bandpass', 300, 200, 1); break;
        default: noise(d, t, 0.05, 0.2 * v, 'lowpass', 900, 400, 0.8);
      }
    },
    jump() { const t = A.ctx.currentTime; noise(A.bus.sfx, t, 0.2, 0.22, 'bandpass', 420, 1900, 1.6, { a: 0.03 }); },
    land(o) { const t = A.ctx.currentTime, s = clamp(o.strength || 0.5, 0.2, 1); tone(A.bus.sfx, 'sine', 130, 48, t, 0.14, 0.4 * s); noise(A.bus.sfx, t, 0.09, 0.25 * s, 'lowpass', 500, 200, 0.8); },
    swing() { const t = A.ctx.currentTime; noise(A.bus.sfx, t, 0.16, 0.28, 'bandpass', 700, 2600, 2.2, { a: 0.04 }); noise(A.bus.sfx, t + 0.1, 0.1, 0.12, 'bandpass', 2400, 900, 2); },
    impact(o) {
      const t = A.ctx.currentTime, d = A.bus.sfx, s = o.heavy ? 1.2 : 1;
      tone(d, 'square', 190, 55, t, 0.11, 0.22 * s, { lp: 1800 }); noise(d, t, 0.07, 0.35 * s, 'bandpass', 1700, 900, 1.2);
      tone(d, 'triangle', 95, 60, t, 0.16, 0.35 * s); tone(d, 'sine', 2100, 1900, t, 0.12, 0.04); // mic ring
    },
    enemyHurt(o) { const t = A.ctx.currentTime; tone(A.bus.sfx, 'square', 760 * (o.pitch || 1), 300, t + 0.02, 0.1, 0.12, { lp: 3000 }); },
    enemyDie(o) { const t = A.ctx.currentTime; tone(A.bus.sfx, 'square', 520 * (o.pitch || 1), 70, t, 0.35, 0.16, { lp: 2500 }); noise(A.bus.sfx, t + 0.05, 0.25, 0.22, 'lowpass', 2000, 300, 0.7); tone(A.bus.sfx, 'triangle', 880, 1760, t + 0.25, 0.12, 0.08); },
    enemyAttack(o) { const t = A.ctx.currentTime; tone(A.bus.sfx, 'sawtooth', 130 * (o.pitch || 1), 85, t, 0.28, 0.12, { lp: 900 }); noise(A.bus.sfx, t, 0.2, 0.08, 'bandpass', 500, 300, 2); },
    warn(o) { const t = A.ctx.currentTime; const f = o.boss ? 440 : 880; tone(A.bus.sfx, 'square', f, f, t, 0.07, 0.07); tone(A.bus.sfx, 'square', f, f, t + 0.11, 0.07, 0.07); },
    shoot() { const t = A.ctx.currentTime; tone(A.bus.sfx, 'triangle', 600, 1000, t, 0.12, 0.12); },
    orb() { const t = A.ctx.currentTime; tone(A.bus.sfx, 'sine', 260, 180, t, 0.3, 0.16); tone(A.bus.sfx, 'square', 130, 90, t, 0.3, 0.05, { lp: 600 }); },
    pop() { const t = A.ctx.currentTime; tone(A.bus.sfx, 'triangle', 1200, 300, t, 0.08, 0.12); },
    shockwave() { const t = A.ctx.currentTime; noise(A.bus.sfx, t, 0.5, 0.45, 'lowpass', 400, 80, 0.8); tone(A.bus.sfx, 'sine', 70, 35, t, 0.5, 0.5); },
    roar() { const t = A.ctx.currentTime; tone(A.bus.sfx, 'sawtooth', 90, 55, t, 1.0, 0.2, { lp: 700, a: 0.08 }); tone(A.bus.sfx, 'sawtooth', 93, 57, t, 1.0, 0.15, { lp: 500, a: 0.08 }); noise(A.bus.sfx, t, 0.9, 0.12, 'bandpass', 400, 200, 1.5, { a: 0.1 }); },
    playerHurt() { const t = A.ctx.currentTime; noise(A.bus.sfx, t, 0.12, 0.3, 'bandpass', 1200, 400, 1); tone(A.bus.sfx, 'square', 320, 140, t, 0.16, 0.12, { lp: 1500 }); },
    keyDrop() { const t = A.ctx.currentTime; [1568, 1319, 1568, 2093].forEach((f, i) => tone(A.bus.sfx, 'triangle', f, f, t + i * 0.07, 0.12, 0.09)); },
    keyBounce() { const t = A.ctx.currentTime; tone(A.bus.sfx, 'triangle', 2400, 2200, t, 0.06, 0.06); },
    keyPickup() { const t = A.ctx.currentTime; [988, 1319, 1568, 1976, 2637].forEach((f, i) => tone(A.bus.sfx, 'square', f, f, t + i * 0.055, 0.1, 0.06, { lp: 5000 })); tone(A.bus.sfx, 'sine', 1976, 1976, t + 0.28, 0.5, 0.06); },
    locked() { const t = A.ctx.currentTime; tone(A.bus.sfx, 'square', 180, 150, t, 0.06, 0.12, { lp: 1200 }); tone(A.bus.sfx, 'square', 160, 140, t + 0.1, 0.06, 0.1, { lp: 1200 }); noise(A.bus.sfx, t, 0.18, 0.08, 'bandpass', 2500, 2500, 4); },
    unlock() { const t = A.ctx.currentTime; noise(A.bus.sfx, t, 0.04, 0.3, 'bandpass', 2600, 2600, 3); tone(A.bus.sfx, 'triangle', 420, 380, t + 0.05, 0.15, 0.2); tone(A.bus.sfx, 'triangle', 640, 600, t + 0.08, 0.15, 0.12);[1568, 2093, 2637].forEach((f, i) => tone(A.bus.sfx, 'sine', f, f, t + 0.15 + i * 0.08, 0.5, 0.08)); },
    cageOpen() { const t = A.ctx.currentTime; tone(A.bus.sfx, 'sawtooth', 180, 270, t, 0.45, 0.06, { lp: 900 }); noise(A.bus.sfx, t + 0.4, 0.12, 0.25, 'lowpass', 900, 300, 1); },
    checkpoint() { const t = A.ctx.currentTime;[523, 659, 784, 1047].forEach((f, i) => tone(A.bus.sfx, 'square', f, f, t + i * 0.07, 0.12, 0.06, { lp: 4000 })); },
    door() { const t = A.ctx.currentTime; tone(A.bus.sfx, 'square', 200, 420, t, 0.35, 0.08, { lp: 1500 });[784, 988, 1175, 1568].forEach((f, i) => tone(A.bus.sfx, 'triangle', f, f, t + 0.35 + i * 0.09, 0.2, 0.08)); },
    ui() { const t = A.ctx.currentTime; tone(A.bus.sfx, 'square', 660, 660, t, 0.04, 0.05, { lp: 3000 }); },
    deny() { const t = A.ctx.currentTime; tone(A.bus.sfx, 'square', 200, 160, t, 0.12, 0.06, { lp: 1200 }); },
    heal() { const t = A.ctx.currentTime;[659, 880, 1319].forEach((f, i) => tone(A.bus.sfx, 'sine', f, f, t + i * 0.06, 0.15, 0.1)); },
    thunder() { const t = A.ctx.currentTime; noise(A.bus.ambient, t, 2.6, 0.45, 'lowpass', 180, 60, 0.7, { a: 0.05, rel: 2 }); tone(A.bus.ambient, 'sine', 55, 35, t, 1.5, 0.25); },
    cheer(o) { crowd(A.bus.sfx, A.ctx.currentTime, o.dur || 2.5, o.strength || 0.6); },
    // voice bus
    effort() { const t = A.ctx.currentTime; Math.random() < 0.5 ? vox(A.bus.voice, t, rand(190, 215), 165, 'a', 'a', 0.15, 0.28) : vox(A.bus.voice, t, 225, 245, 'u', 'a', 0.12, 0.25); },
    jumpGrunt() { const t = A.ctx.currentTime; vox(A.bus.voice, t, 240, 270, 'u', 'u', 0.09, 0.14); },
    pain() { const t = A.ctx.currentTime; vox(A.bus.voice, t, rand(255, 275), 140, 'u', 'o', 0.28, 0.34); },
    defeat() { const t = A.ctx.currentTime; vox(A.bus.voice, t, 240, 110, 'o', 'u', 0.85, 0.3); },
    yeah() { const t = A.ctx.currentTime; vox(A.bus.voice, t, 200, 290, 'e', 'a', 0.45, 0.32); },
    woo(o) { const t = A.ctx.currentTime + (o.delay || 0), p = o.pitch || 1; vox(A.bus.voice, t, 330 * p, 520 * p, 'o', 'u', 0.42, 0.22); }
  };
  function crowd(dest, t, dur, s) {
    for (let i = 0; i < 14; i++) {
      const c = A.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = A.noiseBuf; src.loop = true; f.type = 'bandpass'; f.frequency.value = rand(600, 2600); f.Q.value = rand(1.5, 4);
      src.connect(f); f.connect(g); g.connect(dest);
      const st = t + rand(0, 0.25), pk = 0.09 * s;
      g.gain.setValueAtTime(0.0001, st); g.gain.linearRampToValueAtTime(pk, st + rand(0.1, 0.35));
      for (let k = 0.4; k < dur; k += 0.25) g.gain.linearRampToValueAtTime(pk * rand(0.55, 1), st + k);
      g.gain.exponentialRampToValueAtTime(0.0001, st + dur + rand(0.3, 0.9));
      src.start(st, Math.random()); src.stop(st + dur + 1);
    }
    for (let i = 0; i < Math.round(3 + s * 5); i++) { const st = t + rand(0.1, dur * 0.8); tone(dest, 'sine', rand(1700, 2300), rand(2500, 3100), st, rand(0.25, 0.45), 0.035 * s); }
    for (let i = 0; i < Math.round(2 + s * 4); i++) { const st = t + rand(0, dur * 0.7), p = rand(0.8, 1.5); vox(dest, st, 300 * p, 480 * p, 'o', 'u', rand(0.3, 0.6), 0.06 * s); }
  }
  A.play = function (name, o = {}) {
    if (!A.ready || A.ctx.state !== 'running') return;
    const f = SFX[name]; if (!f) return;
    try { f(o); } catch (e) { console.warn(e); }
    if (Game.mode === 'training' && name !== 'ui') EventLog.push('SND ' + name + (o.surface ? ' ' + o.surface : ''));
  };

  // ---------------- background music (procedural, layered) ----------------
  const N = m => 440 * Math.pow(2, (m - 69) / 12);
  const tri = (r, q) => q === 'm' ? [r, r + 3, r + 7] : [r, r + 4, r + 7];
  const STYLES = {
    menu: { bpm: 84, ch: [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']], kick: [0, 10], snare: [8], hat: 4, bass: [0, 7, 10], arp: 4, lead: [0, 2, 4, 7] },
    s1: { bpm: 104, ch: [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']], kick: [0, 8, 10], snare: [4, 12], hat: 2, bass: [0, 6, 8, 14], arp: 2, lead: [12, 11, 7, 4, 7, 9, 7, 0] },
    s2: { bpm: 92, ch: [[52, 'm'], [52, 'm'], [48, 'M'], [50, 'M']], kick: [0, 3, 8, 11], snare: [4, 12], hat: 2, bass: [0, 3, 6, 8, 10, 11, 14], arp: 4, lead: [7, 10, 12, 10, 7, 5, 3, 0] },
    s3: { bpm: 128, ch: [[50, 'm'], [46, 'M'], [48, 'M'], [45, 'M']], kick: [0, 4, 8, 12, 14], snare: [4, 12], hat: 1, bass: [0, 2, 4, 6, 8, 10, 12, 14], arp: 2, lead: [12, 13, 12, 10, 8, 7, 8, 10] },
    train: { bpm: 100, ch: [[60, 'M'], [57, 'm'], [53, 'M'], [55, 'M']], kick: [0, 8], snare: [4, 12], hat: 2, bass: [0, 8, 11], arp: 2, lead: [0, 4, 7, 12] }
  };
  const MIX = {
    explore: { pad: 0.55, arp: 0.45, bass: 0.35, drums: 0.0, hats: 0.35, lead: 0 },
    combat: { pad: 0.4, arp: 0.35, bass: 0.7, drums: 0.75, hats: 0.55, lead: 0 },
    danger: { pad: 0.3, arp: 0.3, bass: 0.8, drums: 0.95, hats: 0.7, lead: 0.6 },
    silent: { pad: 0, arp: 0, bass: 0, drums: 0, hats: 0, lead: 0 }
  };
  A.setMusic = function (style, intensity = 'explore') {
    if (!A.ready) return;
    const M = A.music;
    if (style && style !== M.style) { M.style = style; M.bar = 0; M.step = 0; M.next = A.ctx.currentTime + 0.1; }
    if (!style) intensity = 'silent';
    M.on = !!style;
    A.setIntensity(intensity, true);
  };
  A.setIntensity = function (intensity, force) {
    const M = A.music; if (!A.ready || (!force && M.intensity === intensity)) return;
    M.intensity = intensity; const mx = MIX[intensity] || MIX.explore, t = A.ctx.currentTime;
    for (const k in A.layers) A.layers[k].gain.setTargetAtTime(mx[k] * 0.9, t, intensity === 'silent' ? 0.4 : 0.7);
  };
  A.duck = function (on) { if (!A.ready) return; A.bus.duck.setTargetAtTime(on ? 0.12 : 1, A.ctx.currentTime, on ? 0.15 : 0.8); };
  function scheduleStep(t, S, step, bar) {
    const L = A.layers, sd = 60 / S.bpm / 4, chd = S.ch[bar % S.ch.length], tr = tri(chd[0], chd[1]);
    if (step === 0) { tr.forEach(m => { tone(L.pad, 'sawtooth', N(m), 0, t, sd * 16, 0.035, { lp: 900, a: 0.25, rel: 0.4, detune: -7 }); tone(L.pad, 'sawtooth', N(m), 0, t, sd * 16, 0.035, { lp: 900, a: 0.25, rel: 0.4, detune: 7 }); }); }
    if (step % S.arp === 0) { const seq = [0, 1, 2, 1, 2, 0, 1, 2]; const k = (step / S.arp) | 0; const m = tr[seq[k % seq.length]] + 12 + (k % 8 >= 4 ? 12 : 0); tone(L.arp, 'square', N(m), 0, t, sd * 1.4, 0.04, { lp: 2600 }); }
    if (S.bass.includes(step)) { const m = chd[0] - 12 + (step % 8 === 6 ? 7 : 0) + (S === STYLES.s3 && step % 4 === 2 ? 12 : 0); tone(L.bass, 'triangle', N(m), 0, t, sd * 1.7, 0.22, {}); tone(L.bass, 'square', N(m), 0, t, sd * 1.2, 0.05, { lp: 420 }); }
    if (S.kick.includes(step)) tone(L.drums, 'sine', 150, 42, t, 0.2, 0.7);
    if (S.snare.includes(step)) { noise(L.drums, t, 0.13, 0.28, 'bandpass', 1900, 1500, 0.9); tone(L.drums, 'triangle', 210, 160, t, 0.07, 0.15); }
    if (step % S.hat === 0) noise(L.hats, t, 0.035, step % 4 === 2 ? 0.1 : 0.06, 'highpass', 7500, 7500, 0.7);
    if (step % 2 === 0) { const li = ((bar % 2) * 8 + step / 2) | 0; const deg = S.lead[li % S.lead.length]; if ((step / 2) % 2 === 0 || bar % 2 === 1) tone(L.lead, 'square', N(chd[0] + 12 + deg), 0, t, sd * 1.8, 0.045, { lp: 3200 }); }
  }
  // ---------------- ambience ----------------
  const AMB = {
    s1: { type: 'bandpass', f: 500, q: 0.6, g: 0.08, ev: 'chime' },
    s2: { type: 'lowpass', f: 220, q: 0.8, g: 0.22, ev: 'drip' },
    s3: { type: 'lowpass', f: 380, q: 0.6, g: 0.16, ev: null },
    train: { type: 'bandpass', f: 700, q: 0.5, g: 0.05, ev: null },
    concert: { type: 'bandpass', f: 1300, q: 0.4, g: 0.05, ev: null },
    menu: { type: 'lowpass', f: 300, q: 0.5, g: 0.06, ev: null }
  };
  A.setAmbient = function (key) {
    if (!A.ready) return;
    if (A.amb && A.amb.key === key) return;
    const t = A.ctx.currentTime;
    if (A.amb) { const old = A.amb; old.g.gain.setTargetAtTime(0, t, 0.5); setTimeout(() => { try { old.src.stop(); old.lfo.stop(); } catch (e) { } }, 3000); A.amb = null; }
    const cfg = AMB[key]; if (!cfg) return;
    const c = A.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    src.buffer = A.noiseBuf; src.loop = true; f.type = cfg.type; f.frequency.value = cfg.f; f.Q.value = cfg.q;
    lfo.frequency.value = 0.07; lg.gain.value = cfg.f * 0.35; lfo.connect(lg); lg.connect(f.frequency);
    src.connect(f); f.connect(g); g.connect(A.bus.ambient); g.gain.value = 0; g.gain.setTargetAtTime(cfg.g, t, 1);
    src.start(); lfo.start();
    A.amb = { key, src, g, lfo, cfg, nextEv: t + rand(2, 5) };
  };
  function ambientEvent(t, ev) {
    const d = A.bus.ambient;
    if (ev === 'chime') { const f = [1047, 1319, 1568, 1760][irand(0, 3)]; tone(d, 'sine', f, f, t, 1.4, 0.03, { a: 0.01, rel: 1.2 }); }
    if (ev === 'drip') { tone(d, 'sine', 1400, 600, t, 0.06, 0.06); }
    if (ev === 'thunder') { noise(d, t, 2.5, 0.3, 'lowpass', 160, 60, 0.7, { a: 0.3, rel: 1.8 }); }
  }
  // ---------------- scheduler tick ----------------
  A.tick = function () {
    if (!A.ready || A.ctx.state !== 'running') return;
    const t = A.ctx.currentTime, M = A.music;
    if (M.on && M.style) {
      const S = STYLES[M.style]; const sd = 60 / S.bpm / 4;
      if (M.next < t - 0.5) M.next = t + 0.05;
      while (M.next < t + 0.12) { try { scheduleStep(M.next, S, M.step, M.bar); } catch (e) { } M.next += sd; M.step = (M.step + 1) % 16; if (M.step === 0) M.bar++; }
    }
    if (A.amb && A.amb.cfg.ev && t > A.amb.nextEv) { ambientEvent(t + 0.02, A.amb.cfg.ev); A.amb.nextEv = t + (A.amb.cfg.ev === 'thunder' ? rand(9, 16) : A.amb.cfg.ev === 'drip' ? rand(1.2, 4) : rand(4, 9)); }
  };

  // ---------------- prepared cues & finale ----------------
  // Rescue cue: prepared 8 s file, always played from its own beginning, never alongside its stems.
  A.playCue = function (stage, onEnd) {
    if (!A.ready) { onEnd && setTimeout(onEnd, 0); return null; }
    if (A.cue) { try { A.cue.src.onended = null; A.cue.src.stop(); } catch (e) { } A.cue = null; }
    const buf = A.buffers['rescue' + stage];
    EventLog.push('CUE stage-' + stage + '-rescue');
    A.cueLog.push({ stage, t: now() });
    if (!buf) { onEnd && onEnd(); return null; }
    const src = A.ctx.createBufferSource(), g = A.ctx.createGain();
    src.buffer = buf; g.gain.value = FILE_GAIN['rescue' + stage];
    src.connect(g); g.connect(A.bus.music);
    A.duck(true);
    src.onended = () => { if (A.cue && A.cue.src === src) A.cue = null; A.duck(false); onEnd && onEnd(); };
    src.start(A.ctx.currentTime + 0.02, 0);
    A.cue = { src, stage, start: A.ctx.currentTime, dur: buf.duration };
    return A.cue;
  };
  A.cueLog = [];
  A.analyser = null;
  A.playFinale = function (onEnd) {
    A.stopFinale();
    if (!A.ready || !A.buffers.finale) { return null; }
    const c = A.ctx, src = c.createBufferSource(), g = c.createGain(), an = c.createAnalyser();
    an.fftSize = 512; an.smoothingTimeConstant = 0.6;
    src.buffer = A.buffers.finale; g.gain.value = FILE_GAIN.finale;
    src.connect(g); g.connect(an); an.connect(A.bus.music);
    A.analyser = an; A.fdata = new Uint8Array(an.frequencyBinCount);
    src.onended = () => { if (A.finale && A.finale.src === src) { A.finale.done = true; onEnd && onEnd(); } };
    const st = c.currentTime + 0.05; src.start(st, 0);
    A.finale = { src, start: st, dur: A.buffers.finale.duration, done: false };
    return A.finale;
  };
  A.stopFinale = function () { if (A.finale) { try { A.finale.src.onended = null; A.finale.src.stop(); } catch (e) { } A.finale = null; A.analyser = null; } };
  A.finaleTime = function () { return A.finale ? clamp(A.ctx.currentTime - A.finale.start, 0, A.finale.dur) : 0; };
  A.bands = function () {
    if (!A.analyser) return { low: 0, mid: 0, high: 0 };
    A.analyser.getByteFrequencyData(A.fdata); const d = A.fdata; let l = 0, m = 0, h = 0;
    for (let i = 1; i < 6; i++) l += d[i]; for (let i = 8; i < 40; i++) m += d[i]; for (let i = 50; i < 120; i++) h += d[i];
    return { low: l / 5 / 255, mid: m / 32 / 255, high: h / 70 / 255 };
  };
  return A;
})();
