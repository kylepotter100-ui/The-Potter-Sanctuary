"""Original score and sound design for the film, synthesised from scratch.

Reads the same cue sheet as the picture (src/cues.json), so every sound is
placed on its visual beat: a thin tension tone that cuts when the shoulders
drop, a singing bowl and an exhale on the release, a mallet note as each hot
stone lands, steam and wind-chimes on the dissolve, a drop of oil that lands
in a ripple, a blade of air as the frame opens, three rising notes for the
studio, and a bowl and bell bloom as the daffodil grows. Underneath, a slow
ambient pad moves through D major.

    python3 design/social-ad/tools/score.py [out.wav]

No samples or third-party audio: everything is numpy/scipy synthesis.
"""
import json
import sys
from pathlib import Path

import numpy as np
from scipy import signal

HERE = Path(__file__).resolve().parents[1]
CUES = json.loads((HERE / "src" / "cues.json").read_text())
SR = 48000
DUR = CUES["duration"]
N = int(SR * DUR)
rng = np.random.default_rng(20261018)

dry = np.zeros((2, N))
send = np.zeros((2, N))  # reverb send
pad = np.zeros((2, N))  # pad bus, filtered as a whole


def ts(seconds):
    return np.arange(int(SR * seconds)) / SR


def place(bus, sig, t0, amp=1.0, pan=0.0):
    """Add a mono or stereo signal to a bus at t0 with equal-power pan."""
    i0 = int(round(t0 * SR))
    if sig.ndim == 1:
        th = (pan + 1) * np.pi / 4
        sig = np.vstack([sig * np.cos(th), sig * np.sin(th)]) * np.sqrt(2)
    n = sig.shape[1]
    a, b = max(0, i0), min(N, i0 + n)
    if b <= a:
        return
    bus[:, a:b] += amp * sig[:, a - i0 : b - i0]


def add(sig, t0, amp=1.0, pan=0.0, verb=0.3):
    place(dry, sig, t0, amp, pan)
    if verb > 0:
        place(send, sig, t0, amp * verb, pan)


def fade(sig, a=0.003, r=0.01):
    n = sig.shape[-1]
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e = np.ones(n)
    e[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    e[-nr:] = np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
    return sig * e


def osc(freq, n=None, phase=0.0):
    """Sine oscillator; freq may be a constant or a per-sample array."""
    if np.isscalar(freq):
        return np.sin(2 * np.pi * freq * np.arange(n) / SR + phase)
    return np.sin(2 * np.pi * np.cumsum(freq) / SR + phase)


def pink(n):
    w = rng.standard_normal(n)
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, w) * 3.5


def sos_band(lo, hi, order=2):
    return signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")


def sweep_bp(x, f0, f1, q=1.2, block=256):
    """Band-pass whose centre glides exponentially from f0 to f1."""
    out = np.zeros_like(x)
    nb = int(np.ceil(len(x) / block))
    zi = np.zeros(2)
    for k in range(nb):
        u = k / max(1, nb - 1)
        fc = f0 * (f1 / f0) ** u
        w0 = 2 * np.pi * fc / SR
        al = np.sin(w0) / (2 * q)
        b = np.array([al, 0, -al])
        a = np.array([1 + al, -2 * np.cos(w0), 1 - al])
        seg = x[k * block : (k + 1) * block]
        y, zi = signal.lfilter(b / a[0], a / a[0], seg, zi=zi)
        out[k * block : k * block + len(seg)] = y
    return out


def env_ar(n, a, r, curve=3.0):
    na = max(1, int(a * SR))
    e = np.zeros(n)
    e[:na] = np.linspace(0, 1, na) ** 2
    e[na:] = np.exp(-curve * np.arange(n - na) / max(1, int(r * SR)))
    return e


# ------------------------------------------------------------- instruments
def bowl(f0, dur=9.0, bright=1.0):
    """Singing bowl: inharmonic partials, each a beating detuned pair."""
    t = ts(dur)
    out = np.zeros_like(t)
    for ratio, amp, tau, beat in [(1, 1.0, 5.5, 0.9), (2.71, 0.55, 3.8, 1.7), (5.15, 0.3 * bright, 2.2, 2.6), (8.17, 0.14 * bright, 1.3, 3.4)]:
        f = f0 * ratio
        out += amp * np.exp(-t / tau) * 0.5 * (np.sin(2 * np.pi * f * t) + np.sin(2 * np.pi * (f + beat) * t + 0.7))
    strike = signal.sosfilt(sos_band(800, 5000), rng.standard_normal(len(t))) * np.exp(-t / 0.006) * 0.4
    return fade(out * (1 - np.exp(-t / 0.004)) + strike, 0.001, 0.4)


def mallet(f, dur=2.4):
    """Soft marimba-like note with a wooden 'tok' on the attack."""
    t = ts(dur)
    tone = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.75)
            + 0.22 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / 0.14)
            + 0.06 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / 0.05))
    tok = signal.sosfilt(sos_band(500, 1800), rng.standard_normal(len(t))) * np.exp(-t / 0.012) * 0.5
    thump = np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.05) * 0.35
    return fade((tone + tok + thump) * (1 - np.exp(-t / 0.0015)), 0.0005, 0.3)


def keys(f, dur=3.2):
    """Felt-piano-ish note: harmonic series with per-partial decay."""
    t = ts(dur)
    out = np.zeros_like(t)
    for k in range(1, 9):
        fk = f * k * (1 + 0.0004 * k * k)
        out += (1 / k ** 1.45) * np.sin(2 * np.pi * fk * t + k) * np.exp(-t / (1.6 / k ** 0.7))
    hammer = signal.sosfilt(sos_band(1200, 4000), rng.standard_normal(len(t))) * np.exp(-t / 0.004) * 0.08
    return fade((out + hammer) * (1 - np.exp(-t / 0.006)), 0.001, 0.5)


def bell(f, dur=3.0, index=2.4):
    """FM bell (carrier:modulator 1:3.5), index decaying with the note."""
    t = ts(dur)
    idx = index * np.exp(-t / 0.5)
    out = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * 3.5 * t)) * np.exp(-t / 1.1)
    return fade(out * (1 - np.exp(-t / 0.002)), 0.0005, 0.4)


def breath(dur=1.6, f0=1300, f1=420):
    x = pink(int(dur * SR))
    x = sweep_bp(x, f0, f1, q=0.7)
    n = len(x)
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.5 * np.exp(-np.linspace(0, 1.2, n))
    return fade(x * e)


def whoosh(dur, f0, f1, q=1.1, shape=(0.6, 0.4)):
    x = sweep_bp(pink(int(dur * SR)), f0, f1, q)
    n = len(x)
    up = int(n * shape[0])
    e = np.concatenate([np.linspace(0, 1, up) ** 2, np.linspace(1, 0, n - up) ** 1.5])
    return fade(x * e)


def boom(f0=70, f1=40, dur=1.4, tau=0.45):
    t = ts(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.18)
    return fade(osc(f) * np.exp(-t / tau) * (1 - np.exp(-t / 0.01)), 0.002, 0.3)


def plink():
    """A drop of oil landing: pitch-falling blip plus a bubble resonance."""
    t = ts(0.6)
    f = 650 + 900 * np.exp(-t / 0.012)
    blip = osc(f) * np.exp(-t / 0.07)
    bubble = signal.sosfilt(sos_band(800, 1100, 3), rng.standard_normal(len(t))) * np.exp(-t / 0.09) * 0.6
    return fade(blip + bubble, 0.0005, 0.2)


def shimmer(dur=1.8, base=2200, count=7):
    t = ts(dur)
    out = np.zeros_like(t)
    for k in range(count):
        f = base * (1 + 0.37 * k) * (1 + 0.01 * rng.standard_normal())
        out += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * (0.6 + 0.4 * np.sin(2 * np.pi * (3 + k) * t)) / count
    return fade(out * np.exp(-t / (dur * 0.35)) * (1 - np.exp(-t / 0.02)), 0.002, 0.3)


def crackle(t0, t1, count, amp):
    for _ in range(count):
        tt = rng.uniform(t0, t1)
        n = int(SR * 0.012)
        c = signal.sosfilt(sos_band(1800, 6000), rng.standard_normal(n)) * np.exp(-np.arange(n) / (SR * 0.002))
        add(fade(c, 0.0003, 0.004), tt, amp * rng.uniform(0.3, 1.0), rng.uniform(-0.6, 0.2), 0.15)


# ------------------------------------------------------------------ pad bed
def pad_note(f, dur, voices=(-7, 0, 6)):
    t = ts(dur)
    out = np.zeros_like(t)
    for c in voices:
        fr = f * 2 ** (c / 1200) * (1 + 0.0012 * np.sin(2 * np.pi * 0.17 * t + c))
        ph = 2 * np.pi * np.cumsum(fr) / SR
        out += np.sin(ph) + 0.28 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph) + 0.05 * np.sin(4 * ph)
    return out / len(voices)


def chord(freqs, t0, t1, amp=0.034, a=1.4, r=1.6):
    dur = t1 - t0
    n = int(dur * SR)
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    e[-nr:] = np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
    for i, f in enumerate(freqs):
        pan = np.linspace(-0.55, 0.55, len(freqs))[i]
        w = 1.0 / (1 + 0.25 * i) * (0.85 if f < 130 else 1.0)
        place(pad, pad_note(f, dur) * e * w, t0, amp, pan)


H, S, D = CUES["hook"], CUES["stones"], CUES["drop"]
D2, A2, D3, Fs3, A3, Cs4, D4, E4, Fs4, G4, A4, B4, Cs5, D5, E5, Fs5, A5 = (
    73.42, 110.0, 146.83, 185.0, 220.0, 277.18, 293.66, 329.63, 369.99, 392.0, 440.0, 493.88, 554.37, 587.33, 659.26, 739.99, 880.0)
B1, G2, B2, E3, B3, Fs2, G3, D6, Fs6, A6, D7 = 61.74, 98.0, 123.47, 164.81, 246.94, 92.5, 196.0, 1174.66, 1479.98, 1760.0, 2349.32

rel = H["release"]
chord([D2, A2, Fs3, Cs4, E4, A4], rel - 0.1, S["develop"][0] + 0.2, 0.034, a=1.8)
chord([B1, Fs3, A3, D4, E4, A4], S["develop"][0] - 0.5, CUES["steam"]["dissolve"][0] + 0.3)
chord([G2, D3, B3, Fs4, A4, D5], CUES["steam"]["dissolve"][0] - 0.3, D["thread"][0] + 0.4)
chord([A2, E3, D4, Fs4, B4, E5], D["thread"][0] - 0.1, CUES["scalp"]["impact"] + 0.5, 0.03, a=0.8, r=0.9)
chord([Fs2, D3, A3, D4, Fs4, Cs5], CUES["scalp"]["impact"] - 0.05, CUES["split"]["open"][0] + 0.4, 0.034, a=0.6)
chord([G2, G3, B3, D4, Fs4, D5], CUES["split"]["open"][0] - 0.3, CUES["portal"]["trace"][0] + 0.5)
chord([A2, E3, A3, D4, E4, A4], CUES["portal"]["trace"][0], CUES["end"]["grow"][0] + 0.5, 0.034, a=0.8, r=0.9)
chord([D2, D3, A3, Cs4, E4, A4, E5], CUES["end"]["grow"][0] - 0.05, DUR, 0.038, a=0.9, r=1.3)

# pad tone: dark under the hook, opening as the shoulders drop and as the
# film moves into light
def cutoff_at(t):
    pts = [(0, 300), (rel, 400), (rel + 1.5, 1500), (S["develop"][1], 2400), (12.0, 2600), (16.4, 3400), (20.4, 4200), (DUR, 3800)]
    xs, ys = zip(*pts)
    return float(np.exp(np.interp(t, xs, np.log(ys))))


block = 512
for ch in range(2):
    zi = np.zeros(4)
    y = np.zeros(N)
    for k in range(0, N, block):
        sos = signal.butter(2, cutoff_at(k / SR), fs=SR, output="sos")
        if k == 0:
            zi = signal.sosfilt_zi(sos) * 0
        seg, zi = signal.sosfilt(sos, pad[ch, k : k + block], zi=zi)
        y[k : k + block] = seg
    pad[ch] = y
dry += pad
send += pad * 0.45

# ------------------------------------------------------------------- events
# hook: low hum and a thin, beating tension tone that cuts on the release
t = ts(rel + 0.1)
hum = (np.sin(2 * np.pi * D2 * t) + 0.3 * np.sin(2 * np.pi * 2 * D2 * t)) * np.clip(t / 0.8, 0, 1)
add(fade(hum, 0.2, 0.25), 0.0, 0.05, 0, 0.1)
tension = (np.sin(2 * np.pi * 1318.5 * t) + np.sin(2 * np.pi * 1325.0 * t)) * np.clip((t - 0.2) / 1.1, 0, 1) ** 2
add(fade(tension, 0.05, 0.07), 0.0, 0.010, 0.1, 0.2)
add(boom(72, 44, 1.6, 0.6), rel, 0.32, 0, 0.2)
add(breath(1.5, 1100, 380), rel - 0.06, 0.16, 0, 0.35)
add(bowl(D3), rel + 0.02, 0.22, -0.1, 0.5)
add(breath(1.7, 1400, 450), H["breathe"] + 0.02, 0.12, 0.05, 0.4)
add(shimmer(1.6, 2600, 6), H["breathe"] + 0.1, 0.02, 0.2, 0.6)

# the line travelling into the reclining figure
m0, m1 = CUES["morph"]
x = sweep_bp(pink(int((m1 - m0) * SR)), 2600, 3800, 2.0)
n = len(x)
pen = np.vstack([x, x]) * np.sin(np.linspace(0, np.pi, n)) ** 2
panv = np.interp(np.linspace(0, 1, n), [0, 0.35, 0.65, 1], [0.7, -0.7, -0.5, 0.6])
pen[0] *= np.cos((panv + 1) * np.pi / 4) * np.sqrt(2)
pen[1] *= np.sin((panv + 1) * np.pi / 4) * np.sqrt(2)
place(dry, pen, m0, 0.025)
place(send, pen, m0, 0.01)

# four stones, four notes, panned to where each lands
for tl, f, xpos in zip(S["land"], [A4, D5, Fs5, A5], [424, 566, 716, 843]):
    add(mallet(f), tl, 0.17, (xpos / 1080) * 2 - 1, 0.35)

# zoom into the stone and out of the stack
z0, z1 = S["zoomIn"]
add(whoosh(z1 - z0 + 0.05, 300, 2600, 1.0, (0.92, 0.08)), z0, 0.10, 0, 0.2)
add(boom(85, 38, 1.8, 0.5), z1, 0.28, 0, 0.3)
add(whoosh(S["zoomOut"][1] - S["zoomOut"][0] + 0.4, 2400, 260, 0.9, (0.05, 0.95)), z1, 0.08, 0, 0.3)
crackle(S["zoomOut"][1], CUES["steam"]["dissolve"][1], 14, 0.035)

# steam: air rising and a few wind-chime notes
sd0, sd1 = CUES["steam"]["dissolve"]
add(whoosh(sd1 - CUES["steam"]["wisp"][0] + 0.3, 380, 2600, 0.8, (0.7, 0.3)), CUES["steam"]["wisp"][0], 0.07, 0.15, 0.5)
for k, (dt, f) in enumerate([(0.05, D6), (0.38, A5 * 2), (0.66, Fs6), (0.95, E5 * 2)]):
    add(bell(f, 2.6, 1.2), sd0 + dt, 0.035, [-0.5, 0.4, -0.2, 0.55][k], 0.7)
crackle(sd1, D["thread"][0], 16, 0.03)

# the drop of oil
add(osc(np.linspace(1900, 900, int(0.32 * SR))) * np.hanning(int(0.32 * SR)), D["thread"][0], 0.018, 0, 0.6)
fa, fb = D["fall"]
swell = pink(int((fb - fa + 0.12) * SR))
swell = signal.sosfilt(signal.butter(2, 900, fs=SR, output="sos"), swell) * np.linspace(0, 1, len(swell)) ** 3
add(fade(swell, 0.01, 0.01), fa - 0.12, 0.06, 0, 0.2)
imp = CUES["scalp"]["impact"]
add(plink(), imp, 0.30, 0, 0.55)
add(boom(62, 40, 1.4, 0.5), imp, 0.25, 0, 0.3)
add(shimmer(2.2, 2100, 8), imp + 0.03, 0.05, 0, 0.8)

# the blade, left to right, and the frame opening
b0, b1 = CUES["split"]["blade"]
x = sweep_bp(signal.sosfilt(signal.butter(2, 2500, "high", fs=SR, output="sos"), pink(int((b1 - b0 + 0.15) * SR))), 3500, 9000, 1.4)
n = len(x)
e = np.sin(np.linspace(0, np.pi, n)) ** 2
panv = np.linspace(-0.85, 0.85, n)
bl = np.vstack([x * e * np.cos((panv + 1) * np.pi / 4), x * e * np.sin((panv + 1) * np.pi / 4)]) * np.sqrt(2)
place(dry, bl, b0, 0.09)
place(send, bl, b0, 0.04)
add(bell(D7, 2.2, 0.8), b1 - 0.02, 0.03, 0.6, 0.6)
o0, o1 = CUES["split"]["open"]
for ch, p in ((0, -0.9), (1, 0.9)):
    add(whoosh(o1 - o0 + 0.3, 900, 220, 0.8, (0.35, 0.65)), o0, 0.07, p, 0.3)

# the studio: three notes rising with the three lines
for tt, f in zip(CUES["studio"]["lines"], [A4, D5, Fs5]):
    add(keys(f), tt, 0.15, -0.25, 0.45)
    add(keys(f / 2), tt, 0.045, -0.1, 0.45)

# the portal: a shimmer up the arch, then the push through
p0, p1 = CUES["portal"]["trace"]
for k, f in enumerate([D5, Fs5, A5, D6]):
    add(bell(f, 2.0, 1.0), p0 + k * (p1 - p0) / 4, 0.035, -0.3 + 0.2 * k, 0.6)
q0, q1 = CUES["portal"]["push"]
rise = signal.sosfilt(signal.butter(2, 3000, "high", fs=SR, output="sos"), pink(int((q1 - q0) * SR)))
rise *= np.exp(np.linspace(-5, 0, len(rise)))
add(fade(rise, 0.01, 0.03), q0, 0.10, 0, 0.3)
add(whoosh(q1 - q0 + 0.2, 200, 1400, 0.9, (0.9, 0.1)), q0, 0.07, 0, 0.3)

# the daffodil grows: bowl, sub bloom, a bell for each stage of growth
E = CUES["end"]
g0, g1 = E["grow"]
add(bowl(D3, 9.0, 0.7), g0 + 0.02, 0.2, 0, 0.55)
add(boom(66, 42, 1.6, 0.6), g0, 0.22, 0, 0.3)
for k, f in enumerate([D6, Fs6, A6, D7]):
    add(bell(f, 3.0, 1.6), g0 + 0.12 + k * (g1 - g0 - 0.2) / 3, 0.04, [-0.4, 0.3, -0.15, 0.4][k], 0.75)
add(shimmer(2.4, 3000, 7), g1 - 0.1, 0.03, 0, 0.8)
add(mallet(D5, 2.0) + mallet(A5, 2.0) * 0.7, E["cta"] + 0.05, 0.07, 0, 0.4)
for k, f in enumerate([2637.0, 3520.0, 4698.6]):
    add(bell(f, 1.4, 0.6), E["glint"] + 0.25 + k * 0.05, 0.012, 0.2 + 0.2 * k, 0.7)

# ------------------------------------------------------------------- reverb
def impulse(seconds, seed):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros(n)
    for lo, hi, rt in [(40, 400, 3.4), (400, 2000, 2.8), (2000, 6000, 2.0), (6000, 16000, 1.2)]:
        ir += signal.sosfilt(sos_band(lo, hi), r.standard_normal(n)) * np.exp(-6.91 * t / rt)
    pre = int(0.022 * SR)
    ir = np.concatenate([np.zeros(pre), ir])[:n]
    ir[pre : pre + int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
    return ir / np.sqrt(np.sum(ir ** 2))


wet = np.vstack([signal.fftconvolve(send[c], impulse(3.6, 11 + c))[:N] for c in range(2)])
mix = dry + wet * 0.55

# --------------------------------------------------------------- mastering
# gentle bus compression, a slow fade-out tail, then peak-normalise; final
# loudness (-14 LUFS, -1 dBTP) is set by ffmpeg loudnorm at mux time.
mono = np.sqrt(np.mean(mix ** 2, axis=0))
env = signal.sosfilt(signal.butter(1, 6, fs=SR, output="sos"), mono)
lvl = 20 * np.log10(np.maximum(env, 1e-6))
gain_db = np.where(lvl > -22, -(lvl + 22) * (1 - 1 / 1.8), 0)
mix *= 10 ** (gain_db / 20)
tail = np.ones(N)
nt = int(1.1 * SR)
tail[-nt:] = np.cos(np.linspace(0, np.pi / 2, nt)) ** 2
mix *= tail
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.1) / np.tanh(1.1) * 0.89

out = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "score.wav"
out.parent.mkdir(parents=True, exist_ok=True)
pcm = (np.clip(mix.T, -1, 1) * 32767).astype(np.int16)
import wave

with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"wrote {out}  {DUR:.1f}s  peak {np.max(np.abs(mix)):.3f}")
