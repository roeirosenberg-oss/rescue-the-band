"""'Back On Stage' - original theme song for Rescue the Band.
Renders six stems (vocals, piano, other, bass, guitar, drums) + full mix, all sample-aligned.
128 BPM, A minor, 80 bars (~150 s)."""
import numpy as np, json, sys
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 44100
BPM = 128
BEAT = 60 / BPM
BAR = BEAT * 4
NBARS = 80
LEN = int((NBARS * BAR + 3.0) * SR)
rng = np.random.default_rng(7)
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def buf(): return np.zeros((LEN, 2), np.float32)
def tb(bar, beat=0.0): return bar * BAR + beat * BEAT

def lp(x, f, order=2): return sosfilt(butter(order, min(f, SR * 0.45), 'low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)
def bp(x, f, q=1.0, order=2):
    lo, hi = f / (2 ** (0.5 / q)), f * (2 ** (0.5 / q))
    return sosfilt(butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos'), x)

def add(dst, sig, t, pan=0.0, gain=1.0):
    i = int(t * SR)
    if i >= LEN: return
    n = min(len(sig), LEN - i)
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    if sig.ndim == 1:
        dst[i:i + n, 0] += sig[:n] * l * gain * 1.414
        dst[i:i + n, 1] += sig[:n] * r * gain * 1.414
    else:
        dst[i:i + n] += sig[:n] * gain

def env_adsr(n, a=0.005, d=0.1, s=0.7, r=0.05, sustain_len=None):
    t = np.arange(n) / SR
    e = np.ones(n) * s
    an = max(1, int(a * SR)); dn = max(1, int(d * SR))
    e[:an] = np.linspace(0, 1, an)
    if an + dn < n: e[an:an + dn] = np.linspace(1, s, dn)
    else: e[an:] = np.linspace(1, s, n - an)
    rn = int(r * SR)
    if rn > 0 and rn < n: e[-rn:] *= np.linspace(1, 0, rn)
    return e

def saw(f, n, phase=0.0):
    # band-limited (polyBLEP) sawtooth to avoid harsh aliasing
    t = np.arange(n) / SR
    if np.ndim(f) == 0: ph = f * t + phase; dt = np.full(n, f / SR)
    else: ph = np.cumsum(f) / SR + phase; dt = np.asarray(f) / SR
    p = ph - np.floor(ph)
    y = 2 * p - 1
    m1 = p < dt; x1 = p[m1] / dt[m1]; y[m1] -= 2 * x1 - x1 * x1 - 1
    m2 = p > 1 - dt; x2 = (p[m2] - 1) / dt[m2]; y[m2] -= x2 * x2 + 2 * x2 + 1
    return y

def sq(f, n):
    t = np.arange(n) / SR
    return np.sign(np.sin(2 * np.pi * f * t))

# ------------------------------------------------------------------ harmony
CH = {'Am': (57, [0, 3, 7]), 'F': (53, [0, 4, 7]), 'C': (48, [0, 4, 7]), 'G': (55, [0, 4, 7]),
      'Em': (52, [0, 3, 7]), 'E': (52, [0, 4, 7])}
VERSE = ['Am', 'F', 'C', 'G']
CHORUS = ['F', 'G', 'Em', 'Am']
SOLO = ['Am', 'G', 'F', 'E']
SECT = {}
def section(name, start, n, prog):
    for i in range(n): SECT[start + i] = (name, prog[i % len(prog)] if prog else None)
section('intro', 0, 8, VERSE)
section('verse', 8, 16, VERSE)
section('chorus', 24, 16, CHORUS)
section('break', 40, 8, VERSE)
section('solo', 48, 8, SOLO)
section('drumbreak', 56, 4, None)
section('chorus2', 60, 16, CHORUS)
section('outro', 76, 4, ['Am'])

def chord_notes(ch, lo=55, hi=72):
    root, iv = CH[ch]
    pcs = [(root + i) % 12 for i in iv]
    return [m for m in range(lo, hi + 1) if m % 12 in pcs]

stems = {k: buf() for k in ['vocals', 'piano', 'other', 'bass', 'guitar', 'drums']}

# ------------------------------------------------------------------ PIANO
def piano_note(m, dur, vel=0.6):
    f = mtof(m); n = int((dur + 1.2) * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    for k in range(1, 9):
        fk = f * k * (1 + 0.0004 * k * k)
        if fk > SR * 0.45: break
        x += (1 / k ** 1.3) * np.sin(2 * np.pi * fk * t + rng.random()) * np.exp(-t * (0.9 + 0.45 * k) * (1 + (m - 60) / 60))
    e = np.ones(n); e[:int(0.003 * SR)] = np.linspace(0, 1, int(0.003 * SR))
    off = int(dur * SR); rel = int(0.12 * SR)
    if off + rel < n: e[off:off + rel] *= np.linspace(1, 0, rel); e[off + rel:] = 0
    click = np.zeros(n); cn = int(0.01 * SR); click[:cn] = rng.standard_normal(cn) * np.linspace(1, 0, cn) * 0.15
    return (x * e + hp(click, 2000)) * vel * 0.35

def piano_part():
    P = stems['piano']
    for bar in range(NBARS):
        name, ch = SECT[bar]
        if ch is None: continue
        root = CH[ch][0]; notes = chord_notes(ch, 57, 72)[:3]
        if name in ('intro', 'break'):
            # flowing arpeggio
            arp = [root - 12, root - 5] + notes + [notes[-1] + 5 if False else notes[0] + 12]
            seq = [0, 2, 3, 4, 5, 4, 3, 2]
            for i, s in enumerate(seq):
                m = arp[min(s, len(arp) - 1)]
                add(P, piano_note(m, BEAT * 0.9, 0.55 if i % 4 else 0.7), tb(bar, i * 0.5), pan=(m - 64) / 40)
        elif name == 'verse':
            add(P, piano_note(root - 12, BAR * 0.95, 0.5), tb(bar), pan=-0.2)
            for b in (1, 2.5, 3.5):
                for m in notes: add(P, piano_note(m, BEAT * 0.4, 0.38), tb(bar, b), pan=(m - 64) / 40)
        elif name in ('chorus', 'chorus2'):
            add(P, piano_note(root - 12, BAR * 0.95, 0.55), tb(bar), pan=-0.2)
            for b in range(4):
                for m in notes + [notes[0] + 12]: add(P, piano_note(m, BEAT * 0.8, 0.42 if b else 0.5), tb(bar, b), pan=(m - 64) / 40)
        elif name == 'solo':
            for b in (0, 2):
                for m in notes: add(P, piano_note(m, BEAT * 1.8, 0.3), tb(bar, b), pan=(m - 64) / 40)
        elif name == 'outro' and bar == 76:
            for m in [45, 57, 60, 64, 69, 72, 76]: add(P, piano_note(m, BAR * 3.5, 0.6), tb(bar), pan=(m - 64) / 40)
    # breakdown piano melody (singing the hook on the keys)
    mel = [(None, 1), (76, .5), (81, .5), (81, 1), (79, .5), (81, .5),
           (84, 1.5), (81, .5), (77, 1), (None, 1),
           (76, .5), (79, .5), (79, 1), (76, .5), (79, .5), (84, 1),
           (83, 1.5), (81, .5), (79, 1), (None, 1)]
    for rep in range(2):
        t = tb(40 + rep * 4)
        for m, d in mel:
            if m: add(P, piano_note(m, d * BEAT * 0.95, 0.75), t, pan=0.15)
            t += d * BEAT

# ------------------------------------------------------------------ OTHER (synth pad + arp)
def pad_note(m, dur, vel=0.5):
    f = mtof(m); n = int((dur + 0.6) * SR)
    x = sum(saw(f * 2 ** (c / 1200), n, rng.random()) for c in (-11, -4, 4, 11)) / 4
    x = lp(x, 1600 + 800 * vel)
    e = env_adsr(n, a=0.25, d=0.3, s=0.8, r=0.55)
    return x * e * vel * 0.25

def pluck(m, dur, vel=0.5):
    f = mtof(m); n = int((dur + 0.15) * SR); t = np.arange(n) / SR
    x = 0.6 * sq(f, n) + 0.4 * saw(f * 1.003, n)
    x = lp(x, 3000) * np.exp(-t * 9)
    return x * vel * 0.22

def other_part():
    O = stems['other']
    for bar in range(NBARS):
        name, ch = SECT[bar]
        if ch is None: continue
        notes = chord_notes(ch, 60, 76)[:3]
        if name != 'drumbreak':
            vol = 0.35 if name in ('verse', 'solo') else 0.5
            for i, m in enumerate(notes): add(O, pad_note(m, BAR, vol), tb(bar), pan=[-0.5, 0, 0.5][i])
        if name in ('intro', 'chorus', 'chorus2', 'break') and not (name == 'intro' and bar < 4):
            arp = chord_notes(ch, 69, 88)
            pat = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 4, 3, 2, 1]
            for i, s in enumerate(pat):
                m = arp[s % len(arp)]
                add(O, pluck(m, BEAT * 0.22, 0.55 if i % 4 == 0 else 0.4), tb(bar, i * 0.25), pan=0.4 * np.sin(i * 0.8))
        if name == 'outro' and bar == 76:
            for i, m in enumerate([57, 64, 69, 72]): add(O, pad_note(m, BAR * 3.5, 0.5), tb(bar), pan=[-0.6, -0.2, 0.2, 0.6][i])

# ------------------------------------------------------------------ BASS
def bass_note(m, dur, vel=0.7):
    f = mtof(m); n = int((dur + 0.05) * SR); t = np.arange(n) / SR
    x = 0.55 * saw(f, n) + 0.6 * np.sin(2 * np.pi * f * t)
    x = lp(x, 500 + 900 * vel, 2)
    e = env_adsr(n, a=0.004, d=0.12, s=0.75, r=0.03)
    return np.tanh(x * e * 1.6) * vel * 0.5

def bass_part():
    B = stems['bass']
    for bar in range(NBARS):
        name, ch = SECT[bar]
        if name == 'drumbreak':
            add(B, bass_note(33, BEAT * 0.9, 0.9), tb(bar)); continue
        if ch is None or name == 'break': continue
        r = CH[ch][0] - 24
        if r < 28: r += 12
        if name == 'intro':
            if bar >= 4: add(B, bass_note(r, BAR * 0.95, 0.7), tb(bar))
        elif name == 'verse':
            for i in range(8): add(B, bass_note(r + (12 if i == 6 else 0), BEAT * 0.45, 0.75 if i % 2 == 0 else 0.6), tb(bar, i * 0.5))
        elif name in ('chorus', 'chorus2'):
            for i in range(8): add(B, bass_note(r + (12 if i % 2 else 0), BEAT * 0.45, 0.8), tb(bar, i * 0.5))
        elif name == 'solo':
            fig = [0, 0, 12, 0, 7, 0, 10, 12]
            for i, s in enumerate(fig): add(B, bass_note(r + s, BEAT * 0.42, 0.85 if i % 2 == 0 else 0.7), tb(bar, i * 0.5))
        elif name == 'outro' and bar == 76:
            add(B, bass_note(33, BAR * 3, 0.85), tb(bar))

# ------------------------------------------------------------------ GUITAR
def dist(x, g): return np.tanh(x * g) / np.tanh(g)
def cab(x): return lp(hp(x, 90), 4200, 4)
def power_chord(m, dur, mute=False, vel=0.7):
    n = int((dur + (0.05 if mute else 0.4)) * SR); t = np.arange(n) / SR
    x = sum(saw(mtof(mm) * 2 ** (c / 1200), n, rng.random()) for mm in (m, m + 7, m + 12) for c in (-6, 6)) / 6
    x = dist(x, 6.0)
    if mute: x = lp(x, 1100) * np.exp(-t * 14)
    else: x = x * env_adsr(n, a=0.004, d=0.3, s=0.75, r=0.35)
    return cab(x) * vel * 0.3

def lead_note(m, dur, vel=0.7, bend=False):
    n = int((dur + 0.08) * SR); t = np.arange(n) / SR
    f = mtof(m) * (1 + 0.012 * np.sin(2 * np.pi * 6 * t) * np.clip((t - 0.15) * 4, 0, 1))
    if bend: f = f * 2 ** ((-1 + np.clip(t * 6, 0, 1)) / 12)
    x = saw(f, n) * 0.7 + saw(f * 1.004, n) * 0.3
    x = dist(lp(x, 2500), 8.0)
    return cab(x) * env_adsr(n, a=0.006, d=0.2, s=0.85, r=0.06) * vel * 0.28

def guitar_part():
    G = stems['guitar']
    for bar in range(NBARS):
        name, ch = SECT[bar]
        if ch is None: continue
        r = CH[ch][0] - 12
        if r < 40: r += 12
        if name == 'verse':
            for i in range(8): add(G, power_chord(r, BEAT * 0.4, mute=True, vel=0.7), tb(bar, i * 0.5), pan=-0.55)
            for i in range(8): add(G, power_chord(r, BEAT * 0.4, mute=True, vel=0.65), tb(bar, i * 0.5 + 0.01), pan=0.55)
        elif name in ('chorus', 'chorus2'):
            for b, d in ((0, 1.5), (1.5, 1.0), (2.5, 1.5)):
                add(G, power_chord(r, d * BEAT, vel=0.75), tb(bar, b), pan=-0.6)
                add(G, power_chord(r, d * BEAT, vel=0.7), tb(bar, b + 0.012), pan=0.6)
        elif name == 'solo':
            add(G, power_chord(r, BAR * 0.95, vel=0.45), tb(bar), pan=-0.6)
        elif name == 'outro' and bar == 76:
            add(G, power_chord(45, BAR * 3, vel=0.8), tb(bar), pan=-0.6); add(G, power_chord(45, BAR * 3, vel=0.75), tb(bar, 0.01), pan=0.6)
    solo = [[(69, .5), (72, .5), (76, .5), (81, 1), (79, .5), (76, .5), (74, .5)],
            [(74, .5), (71, .5), (74, .5), (79, 1.5, 1), (77, .5), (74, .5)],
            [(72, .5), (77, .5), (81, 1), (79, .5), (77, .5), (76, 1)],
            [(76, .5), (80, .5), (83, 1), (81, .5), (80, .5), (76, 1)],
            [(81, .25), (79, .25), (76, .25), (74, .25), (72, .5), (69, .5), (72, .5), (74, .5), (76, 1)],
            [(83, 2, 1), (81, .5), (79, .5), (74, 1)],
            [(77, .5), (76, .5), (72, .5), (69, .5), (77, 1), (76, 1)],
            [(76, .25), (77, .25), (80, .5), (83, 1), (88, 2, 1)]]
    for i, ph in enumerate(solo):
        t = tb(48 + i)
        for nt in ph:
            m, d = nt[0], nt[1]
            add(G, lead_note(m, d * BEAT * 0.97, 0.8, bend=len(nt) > 2), t, pan=0.1)
            t += d * BEAT

# ------------------------------------------------------------------ DRUMS
def kick(v=1.0):
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 28); ph = np.cumsum(f) / SR
    x = np.sin(2 * np.pi * ph) * np.exp(-t * 7)
    x[:200] += rng.standard_normal(200) * np.linspace(0.5, 0, 200)
    return np.tanh(x * 1.5) * v * 0.9
def snare(v=1.0):
    n = int(0.3 * SR); t = np.arange(n) / SR
    nz = bp(rng.standard_normal(n), 2200, 0.6) * np.exp(-t * 16)
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 25)
    return (nz * 1.4 + tone * 0.6) * v * 0.55
def hat(v=1.0, open_=False):
    n = int((0.35 if open_ else 0.06) * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000, 4) * np.exp(-t * (9 if open_ else 70)) * v * 0.22
def crash(v=1.0):
    n = int(2.2 * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 4500, 2) * np.exp(-t * 2.2) * v * 0.28
def tom(f0, v=1.0):
    n = int(0.4 * SR); t = np.arange(n) / SR
    f = f0 * (0.7 + 0.3 * np.exp(-t * 15)); ph = np.cumsum(f) / SR
    return np.sin(2 * np.pi * ph) * np.exp(-t * 8) * v * 0.6

def drums_part():
    D = stems['drums']
    for bar in range(NBARS):
        name, _ = SECT[bar]
        if name == 'intro' and bar < 4: continue
        if name == 'break':
            for i in range(8): add(D, hat(0.5), tb(bar, i * 0.5), pan=0.3)
            continue
        if name == 'outro':
            if bar == 76: add(D, kick(1), tb(bar)); add(D, crash(1.2), tb(bar), pan=-0.3); add(D, crash(1.0), tb(bar, 0.02), pan=0.3)
            continue
        if name == 'drumbreak':
            # 4-bar drum feature: groove, then tom fills
            for i in range(16):
                b = i * 0.25
                if bar < 58:
                    if i in (0, 6, 10): add(D, kick(1), tb(bar, b))
                    if i in (4, 12): add(D, snare(1), tb(bar, b))
                    if i in (14, 15): add(D, snare(0.6), tb(bar, b))
                    add(D, hat(0.7 if i % 2 == 0 else 0.45), tb(bar, b), pan=0.3)
                elif bar == 58:
                    if i % 4 == 0: add(D, kick(1), tb(bar, b))
                    add(D, snare(0.5 + 0.03 * i), tb(bar, b))
                else:
                    add(D, tom([220, 220, 180, 180, 150, 150, 120, 120][i // 2], 0.9), tb(bar, b), pan=0.5 - i / 15)
                    if i % 4 == 0: add(D, kick(1), tb(bar, b))
            if bar == 56: add(D, crash(1), tb(bar))
            continue
        full = name in ('chorus', 'chorus2')
        for i in range(16):
            b = i * 0.25
            if full:
                if i % 4 == 0: add(D, kick(1), tb(bar, b))
                if i in (4, 12): add(D, snare(1), tb(bar, b))
                if i % 2 == 0: add(D, hat(0.7, open_=(i % 4 == 2)), tb(bar, b), pan=0.3)
            else:
                if i in (0, 6, 8, 11): add(D, kick(0.95), tb(bar, b))
                if i in (4, 12): add(D, snare(0.9), tb(bar, b))
                if i % 2 == 0: add(D, hat(0.6 if i % 4 == 0 else 0.4), tb(bar, b), pan=0.3)
        if bar in (8, 24, 32, 40, 48, 60, 68): add(D, crash(1), tb(bar), pan=-0.3)
        # fills into sections
        if bar + 1 in (8, 24, 48, 60, 76) and name not in ('drumbreak',):
            for i, f0 in enumerate([200, 200, 160, 160, 130, 130, 110, 110]): add(D, tom(f0, 0.8), tb(bar, 2 + i * 0.25), pan=0.5 - i / 7)

# ------------------------------------------------------------------ VOCALS (wordless synth singer)
VOW = {'a': ([800, 1150, 2900], [1, .5, .25]), 'o': ([450, 800, 2830], [1, .4, .15]), 'e': ([400, 1900, 2600], [1, .35, .2]),
       'u': ([325, 700, 2530], [1, .3, .1]), 'i': ([300, 2300, 3000], [1, .3, .2])}
def sing(m, dur, vowel='a', vel=0.7, detune=0.0):
    n = int((dur + 0.12) * SR); t = np.arange(n) / SR
    vib = 1 + 0.009 * np.sin(2 * np.pi * 5.6 * t) * np.clip((t - 0.18) * 3, 0, 1)
    scoop = 2 ** ((-0.6 * np.exp(-t * 25)) / 12)
    f = mtof(m) * vib * scoop * 2 ** (detune / 1200)
    src = saw(f, n) + 0.15 * rng.standard_normal(n) * 0.3
    fs, gs = VOW[vowel]; x = np.zeros(n)
    for fc, g in zip(fs, gs): x += bp(src, fc, 4.0, 2) * g
    x *= 0.25 / (np.sqrt((x ** 2).mean()) + 1e-9)   # even loudness across pitches/vowels
    breath = bp(rng.standard_normal(n), 2500, 1.0) * 0.02
    e = env_adsr(n, a=0.04, d=0.15, s=0.85, r=0.12)
    return (x + breath) * e * vel * 1.4

VERSE_MEL = [[(None, 1), (64, .5), (69, .5), (69, 1), (67, .5), (69, .5)],
             [(72, 1.5), (69, .5), (65, 1), (None, 1)],
             [(64, .5), (67, .5), (67, 1), (64, .5), (67, .5), (72, 1)],
             [(71, 1.5), (69, .5), (67, 1), (None, 1)]]
VERSE_END = [(67, .5), (69, .5), (71, .5), (72, .5), (74, 2)]
CHORUS_MEL = [[(72, 1), (72, .5), (74, .5), (76, 1.5), (74, .5)],
              [(74, 1), (71, .5), (67, .5), (74, 1.5), (72, .5)],
              [(71, 1), (67, .5), (64, .5), (71, 1), (72, .5), (71, .5)],
              [(69, 3), (None, 1)]]
CHORUS_END = [(69, 1), (72, 1), (76, 2)]
VOWELS_V = 'aoeaoiaeo'
VOWELS_C = 'aoaeaoae'

AMIN = {9, 11, 0, 2, 4, 5, 7}
def dia_below(m, steps=2):
    for _ in range(steps):
        m -= 1
        while m % 12 not in AMIN: m -= 1
    return m

def vocal_line(start_bar, phrases, vowels, doubled=False, vel=0.7):
    V = stems['vocals']; k = 0
    for i, ph in enumerate(phrases):
        t = tb(start_bar + i)
        for m, d in ph:
            if m:
                vw = vowels[k % len(vowels)]; k += 1
                add(V, sing(m, d * BEAT * 0.95, vw, vel), t, pan=0.0)
                if doubled:
                    add(V, sing(m, d * BEAT * 0.95, vw, vel * 0.55, detune=-9), t + 0.012, pan=-0.45)
                    add(V, sing(dia_below(m), d * BEAT * 0.95, vw, vel * 0.35, detune=7), t + 0.008, pan=0.45)
            t += d * BEAT

def vocals_part():
    for rep in range(4):
        ph = [VERSE_MEL[0], VERSE_MEL[1], VERSE_MEL[2], VERSE_END if rep == 3 else VERSE_MEL[3]]
        vocal_line(8 + rep * 4, ph, VOWELS_V, vel=0.65)
    for start in (24, 60):
        for rep in range(4):
            ph = [CHORUS_MEL[0], CHORUS_MEL[1], CHORUS_MEL[2], CHORUS_END if rep % 2 else CHORUS_MEL[3]]
            vocal_line(start + rep * 4, ph, VOWELS_C, doubled=True, vel=0.75)
    vocal_line(76, [[(69, 4)], [(None, 4)]], 'o', doubled=True, vel=0.7)

# ------------------------------------------------------------------ render, reverb, levels
for fn in (piano_part, other_part, bass_part, guitar_part, drums_part, vocals_part):
    fn(); print('rendered', fn.__name__, flush=True)

def reverb(x, secs, wet):
    n = int(secs * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t * 6.5 / secs)[:, None]
    ir[:int(0.012 * SR)] = 0; ir /= np.sqrt((ir ** 2).sum(0))
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[:LEN] for c in range(2)], 1)
    y = np.stack([lp(y[:, c], 6000) for c in range(2)], 1)
    return x + y * wet
REV = {'vocals': (1.8, 0.35), 'piano': (1.6, 0.25), 'other': (2.2, 0.35), 'guitar': (1.2, 0.15), 'drums': (1.0, 0.10), 'bass': (0.5, 0.0)}
TARGET = {'drums': -15.5, 'bass': -19.0, 'guitar': -20.0, 'piano': -20.5, 'other': -21.5, 'vocals': -17.5}
def rms_db(x, active=True):
    a = np.abs(x).mean(1); m = a > 1e-4 if active else np.ones(len(a), bool)
    return 20 * np.log10(np.sqrt((x[m] ** 2).mean()) + 1e-12)
info = {}
for k in stems:
    if REV[k][1] > 0: stems[k] = reverb(stems[k], *REV[k])
    g = TARGET[k] - rms_db(stems[k]); stems[k] *= 10 ** (g / 20); info[k] = float(round(rms_db(stems[k]), 1))
mix = sum(stems.values())
# gentle master glue: soft limiter
pk = np.abs(mix).max(); pre = 10 ** (-1.0 / 20) / pk * 1.6
scale = pre
mix_l = np.tanh(mix * scale) / np.tanh(1.6) * 10 ** (-1.0 / 20)
# keep stems consistent with the mix's overall gain (they're played separately in rescue cues anyway)
for k, x in stems.items(): wavfile.write(f'{OUT}/{k}.wav', SR, (x * scale / 1.6).astype(np.float32))
wavfile.write(f'{OUT}/full.wav', SR, mix_l.astype(np.float32))
json.dump({'bpm': BPM, 'bar_s': BAR, 'bars': NBARS, 'sections': {'intro': 0, 'verse': 8, 'chorus': 24, 'break': 40, 'solo': 48, 'drumbreak': 56, 'chorus2': 60, 'outro': 76},
           'stem_rms_db_active': info, 'duration_s': LEN / SR}, open(f'{OUT}/song.json', 'w'), indent=1)
print('done', LEN / SR, info)
