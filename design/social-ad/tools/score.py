"""Therapeutic score and UI sound design for the film, synthesised from scratch.

A slow spa piece in D major at 72 BPM — felt piano melody over flowing
arpeggios, harp glissandi (Karplus–Strong) into each transition, warm
strings, a soft sub, singing bowls and chimes. The film is cut to this grid
(src/cues.json): every screen change lands on a bar line and every tap on a
beat, and the melody's notes fall on the words, taps and reveals. Soft,
pitched UI sounds (taps, elastic pops, the stone landing, the success chime,
the CTA press) sit just under the music.

    python3 design/social-ad/tools/score.py [out.wav]

No samples or third-party audio: everything is numpy/scipy synthesis.
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np
from scipy import signal

HERE = Path(__file__).resolve().parents[1]
C = json.loads((HERE / "src" / "cues.json").read_text())
SR = 48000
DUR = C["duration"]
N = int(SR * (DUR + 0.2))
BEAT = 60.0 / C["bpm"]
rng = np.random.default_rng(72)

dry = np.zeros((2, N))
send = np.zeros((2, N))


def beat(b):
    return b * BEAT


def ts(seconds):
    return np.arange(int(SR * seconds)) / SR


def place(bus, sig, t0, amp=1.0, pan=0.0):
    i0 = int(round(t0 * SR))
    if sig.ndim == 1:
        th = (pan + 1) * np.pi / 4
        sig = np.vstack([sig * np.cos(th), sig * np.sin(th)]) * np.sqrt(2)
    a, b = max(0, i0), min(N, i0 + sig.shape[1])
    if b > a:
        bus[:, a:b] += amp * sig[:, a - i0 : b - i0]


def add(sig, t0, amp=1.0, pan=0.0, verb=0.3):
    place(dry, sig, t0, amp, pan)
    if verb > 0:
        place(send, sig, t0, amp * verb, pan)


def fade(sig, a=0.003, r=0.02):
    n = sig.shape[-1]
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e = np.ones(n)
    e[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    e[-nr:] = np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
    return sig * e


NOTE = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}


def hz(name):
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[pitch] + 12 * (octave - 4)) / 12)


def pink(n):
    w = rng.standard_normal(n)
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, w) * 3.5


def band(lo, hi, order=2):
    return signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")


def sweep_bp(x, f0, f1, q=1.2, block=256):
    out = np.zeros_like(x)
    nb = int(np.ceil(len(x) / block))
    zi = np.zeros(2)
    for k in range(nb):
        fc = f0 * (f1 / f0) ** (k / max(1, nb - 1))
        w0 = 2 * np.pi * fc / SR
        al = np.sin(w0) / (2 * q)
        bb = np.array([al, 0, -al])
        aa = np.array([1 + al, -2 * np.cos(w0), 1 - al])
        seg = x[k * block : (k + 1) * block]
        y, zi = signal.lfilter(bb / aa[0], aa / aa[0], seg, zi=zi)
        out[k * block : k * block + len(seg)] = y
    return out


# ------------------------------------------------------------- instruments
def piano(f, vel=0.6, dur=4.5, bright=0.0):
    """Felt piano: stretched partials, two-stage decay, unison strings."""
    t = ts(dur)
    out = np.zeros_like(t)
    B = 0.00032 * (f / 261.6) ** 0.5
    tau0 = 2.6 * (261.6 / f) ** 0.45 + 0.5
    dim = 1.2 - 0.6 * vel - 0.4 * bright  # felt hammers: softer playing dims the top
    for k in range(1, 15):
        fk = f * k * np.sqrt(1 + B * k * k)
        if fk > 15000:
            break
        amp = (1 / k ** 1.2) * np.exp(-(k - 1) * dim * 0.55)
        tau = tau0 / (1 + 0.55 * (k - 1))
        env = 0.7 * np.exp(-t / (tau * 0.3)) + 0.3 * np.exp(-t / tau)
        if k <= 3:
            tone = (np.sin(2 * np.pi * fk * t) + np.sin(2 * np.pi * fk * 1.0004 * t + 1.3) + np.sin(2 * np.pi * fk * 0.99965 * t + 2.1)) / 3
        else:
            tone = np.sin(2 * np.pi * fk * t + k)
        out += amp * env * tone
    hammer = signal.sosfilt(band(600, 2600), rng.standard_normal(len(t))) * np.exp(-t / 0.006) * 0.1
    out = out * (1 - np.exp(-t / 0.004)) + hammer
    return fade(out * vel, 0.001, 0.6)


def harp(f, dur=3.6, bright=0.55):
    """Karplus–Strong string with an allpass for exact tuning."""
    n = int(dur * SR)
    period = SR / f
    D = int(np.floor(period - 1.5))
    d = period - D - 0.5
    c = (1 - d) / (1 + d)
    t60 = 4.2 * (146.8 / f) ** 0.55
    g = 10 ** (-3 / (f * t60))
    exc = rng.standard_normal(D)
    exc = signal.sosfilt(signal.butter(2, 1800 + 4200 * bright, fs=SR, output="sos"), exc)
    exc *= np.hanning(D) ** 0.5
    x = np.zeros(n)
    x[:D] = exc
    a = np.zeros(D + 3)
    a[0], a[1] = 1.0, c
    a[D] -= g / 2 * c
    a[D + 1] -= g / 2 * (1 + c)
    a[D + 2] -= g / 2
    y = signal.lfilter([1.0, c], a, x)
    y = y / (np.max(np.abs(y)) + 1e-9)
    return fade(y, 0.001, 0.4)


def strings(freqs, dur, a=1.2, r=1.5):
    """Warm string pad: detuned saws, gentle vibrato, low-passed."""
    t = ts(dur)
    out = np.zeros((2, len(t)))
    for i, f in enumerate(freqs):
        for j, cents in enumerate((-9, -3, 3, 9)):
            fr = f * 2 ** (cents / 1200) * (1 + 0.0016 * np.sin(2 * np.pi * (4.6 + 0.3 * j) * t + i + j))
            ph = 2 * np.pi * np.cumsum(fr) / SR + rng.uniform(0, 6.28)
            saw = signal.sawtooth(ph)
            out[j % 2] += saw / (1 + 0.15 * i)
    out = signal.sosfilt(signal.butter(2, 3000, fs=SR, output="sos"), out, axis=1)
    out = signal.sosfilt(signal.butter(1, 120, "high", fs=SR, output="sos"), out, axis=1)
    env = np.ones(len(t))
    na, nr = int(a * SR), int(r * SR)
    env[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    env[-nr:] = np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
    return out * env / (len(freqs) * 2)


def sub(f, dur=3.4):
    t = ts(dur)
    return fade(np.sin(2 * np.pi * f * t) * (1 - np.exp(-t / 0.08)) * np.exp(-t / 2.8), 0.01, 0.4)


def bowl(f0, dur=9.0, bright=1.0):
    t = ts(dur)
    out = np.zeros_like(t)
    for ratio, amp, tau, bt in [(1, 1.0, 5.5, 0.9), (2.71, 0.5, 3.8, 1.7), (5.15, 0.26 * bright, 2.2, 2.6), (8.17, 0.12 * bright, 1.3, 3.4)]:
        fr = f0 * ratio
        out += amp * np.exp(-t / tau) * 0.5 * (np.sin(2 * np.pi * fr * t) + np.sin(2 * np.pi * (fr + bt) * t + 0.7))
    strike = signal.sosfilt(band(800, 5000), rng.standard_normal(len(t))) * np.exp(-t / 0.006) * 0.3
    return fade(out * (1 - np.exp(-t / 0.004)) + strike, 0.001, 0.4)


def bell(f, dur=3.0, index=2.0):
    t = ts(dur)
    idx = index * np.exp(-t / 0.5)
    out = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * 3.5 * t)) * np.exp(-t / 1.1)
    return fade(out * (1 - np.exp(-t / 0.002)), 0.0005, 0.4)


def whoosh(dur, f0, f1, q=1.0, peak=0.6):
    x = sweep_bp(pink(int(dur * SR)), f0, f1, q)
    n = len(x)
    up = int(n * peak)
    e = np.concatenate([np.linspace(0, 1, up) ** 2, np.linspace(1, 0, n - up) ** 1.6])
    return fade(x * e)


def shimmer_line(dur):
    """The sound of the line drawing: a fine, airy hiss that brightens."""
    x = sweep_bp(signal.sosfilt(signal.butter(2, 3000, "high", fs=SR, output="sos"), pink(int(dur * SR))), 4500, 8500, 2.2)
    n = len(x)
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return fade(x * e)


def ui_tap(pitch):
    t = ts(0.45)
    click = signal.sosfilt(band(1800, 4800), rng.standard_normal(len(t))) * np.exp(-t / 0.0022) * 0.5
    body = np.sin(2 * np.pi * pitch * t) * np.exp(-t / 0.11) * (1 - np.exp(-t / 0.002))
    thump = np.sin(2 * np.pi * 150 * t) * np.exp(-t / 0.018) * 0.35
    return fade(click + 0.5 * body + thump, 0.0003, 0.1)


def pop(pitch):
    t = ts(0.25)
    f = pitch * (0.62 + 0.38 * (1 - np.exp(-t / 0.018)))
    return fade(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.06) * (1 - np.exp(-t / 0.002)), 0.0005, 0.05)


def clack():
    t = ts(0.5)
    tone = (np.sin(2 * np.pi * 2150 * t) + 0.7 * np.sin(2 * np.pi * 3380 * t + 1)) * np.exp(-t / 0.022)
    click = signal.sosfilt(band(1500, 6000), rng.standard_normal(len(t))) * np.exp(-t / 0.003)
    thump = np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.05)
    return fade(0.35 * tone + 0.4 * click + 0.6 * thump, 0.0003, 0.1)


# ------------------------------------------------------------ the music
# Bars start on beat 2 (a two-beat pickup), four beats each.
def bar(n):
    return 2 + 4 * (n - 1)


CHORDS = [  # (bar, beats-into-bar, pad voicing, arpeggio (eighths), bass)
    (1, 0, ["D3", "A3", "F#4", "C#5", "E5"], ["D3", "A3", "E4", "F#4", "A4", "F#4", "E4", "A3"], "D2"),
    (2, 0, ["B2", "F#3", "D4", "A4", "E5"], ["B2", "F#3", "D4", "E4", "A4", "E4", "D4", "F#3"], "B1"),
    (3, 0, ["G2", "D3", "B3", "F#4", "A4"], ["G2", "D3", "A3", "B3", "F#4", "B3", "A3", "D3"], "G1"),
    (4, 0, ["E3", "B3", "D4", "F#4", "G4"], ["E3", "B3", "F#4", "G4"], "E2"),
    (4, 2, ["A2", "E3", "B3", "C#4", "E4"], ["A2", "E3", "B3", "C#4"], "A1"),
    (5, 0, ["F#2", "D3", "A3", "C#4", "E4"], ["F#2", "D3", "A3", "E4", "F#4", "E4", "A3", "D3"], "F#2"),
    (6, 0, ["G2", "D3", "B3", "C#4", "F#4"], ["G2", "D3", "B3", "C#4", "F#4", "C#4", "B3", "D3"], "G2"),
    (7, 0, ["E2", "B2", "G3", "D4", "F#4"], ["E2", "B2", "G3", "D4"], "E2"),
    (7, 2, ["A2", "E3", "A3", "D4", "E4"], ["A2", "E3", "A3", "D4"], "A1"),
    (8, 0, ["D3", "A3", "C#4", "E4", "A4"], ["D2", "A2", "E3", "A3"], "D2"),
    (8, 2, ["D3", "G3", "B3", "D4", "G4"], ["D2", "G2", "B2", "D3"], "D2"),
    (9, 0, ["D3", "A3", "C#4", "F#4", "A4"], ["D2", "A2", "F#3", "A3", "D4", "E4", "F#4", "A4"], "D2"),
]
END_BEAT = 34 + 4.5  # the cadence lands on the CTA tap and rings past the picture

# strings: the intro swells from silence, then each chord crossfades into the next
spans = []
for i, (b, off, pad_v, arp, bass) in enumerate(CHORDS):
    start = bar(b) + off
    stop = bar(CHORDS[i + 1][0]) + CHORDS[i + 1][1] if i + 1 < len(CHORDS) else END_BEAT
    spans.append((start, stop, pad_v, arp, bass))
spans[0] = (0.15, spans[0][1], spans[0][2], spans[0][3], spans[0][4])
for start, stop, pad_v, arp, bass in spans:
    t0, t1 = beat(start) - 0.25, beat(stop) + 0.6
    place(dry, strings([hz(n) for n in pad_v], t1 - t0, a=0.9 if start > 1 else 1.6, r=1.1), t0, 0.42)
    place(send, strings([hz(n) for n in pad_v], t1 - t0, a=0.9 if start > 1 else 1.6, r=1.1), t0, 0.18)
    add(sub(hz(bass), min(3.6, t1 - t0 + 0.8)), beat(max(start, 2)), 0.15, 0, 0.05)
    # left hand: flowing eighths
    if start >= 2:
        for k, nm in enumerate(arp):
            v = 0.32 + (0.06 if k % 4 == 0 else 0) + 0.02 * rng.standard_normal()
            add(piano(hz(nm), v, 3.8), beat(start + k * 0.5) + 0.004 * rng.standard_normal(), 0.5, -0.35 + 0.1 * (k % 3), 0.45)

# right hand: the melody, each note on its word, tap or reveal
MELODY = [
    (3.0, "A4", 0.45), (4.0, "F#5", 0.5), (5.5, "E5", 0.42),                       # logo
    (6, "F#5", 0.62), (7, "E5", 0.6), (8, "D5", 0.62), (9.5, "A4", 0.45),         # relax · restore · glow
    (10, "B4", 0.56), (11.5, "D5", 0.5), (12, "E5", 0.6), (13, "D5", 0.5),        # menu, the tap
    (14, "F#5", 0.66), (16, "E5", 0.55), (17, "C#5", 0.5),                        # the stone lands
    (18.5, "D5", 0.56), (19.5, "E5", 0.56), (20.5, "F#5", 0.6),                    # whipped · plant-based · small-batch
    (22, "B5", 0.6), (24, "A5", 0.55), (25, "F#5", 0.5),                          # trust
    (26, "G5", 0.55), (27, "F#5", 0.57), (28, "E5", 0.57), (29, "D5", 0.6),       # date · time · confirm
    (30, "A5", 0.62), (33, "F#5", 0.5),                                           # the logo again
    (34, "D6", 0.55), (34, "A5", 0.4),                                            # the CTA
]
for b, nm, v in MELODY:
    add(piano(hz(nm), v, 5.0, bright=1.0), beat(b) + 0.006, 0.62, 0.2, 0.55)

# harp glissandi into each transition
PENT = ["D", "E", "F#", "A", "B"]


def gliss(t0, t1, lo, count, up=True, amp=0.16, pan=0.25):
    names = []
    octv, idx = int(lo[-1]), PENT.index(lo[:-1])
    for _ in range(count):
        names.append(f"{PENT[idx]}{octv}")
        idx += 1
        if idx == len(PENT):
            idx, octv = 0, octv + 1
    if not up:
        names = names[::-1]
    for k, nm in enumerate(names):
        u = k / max(1, count - 1)
        add(harp(hz(nm), 3.2), t0 + (t1 - t0) * u ** 1.15, amp * (0.75 + 0.25 * u), pan - 0.5 + u, 0.5)


gliss(0.95, 1.62, "D4", 8)
gliss(C["arch"]["fill"][0] + 0.1, C["arch"]["fill"][1] - 0.05, "F#4", 9)
gliss(C["menu"]["expand"][0] + 0.05, C["menu"]["expand"][1] - 0.1, "A3", 9, amp=0.14)
gliss(C["stones"]["iris"][0], C["stones"]["iris"][1] - 0.05, "D4", 9)
gliss(C["book"]["out"][0], C["end"]["grow"][0] + 0.05, "F#4", 7, amp=0.14)

# ----------------------------------------------------------- sound design
H = C
add(bowl(hz("D3")), 0.22, 0.2, -0.1, 0.5)
add(shimmer_line(H["logo"]["draw"][1] - H["logo"]["draw"][0]), H["logo"]["draw"][0], 0.018, 0.1, 0.6)
add(bell(hz("D6"), 3.0, 1.2), H["logo"]["draw"][1] - 0.05, 0.05, 0.3, 0.7)
add(shimmer_line(H["arch"]["draw"][1] - H["arch"]["draw"][0]), H["arch"]["draw"][0], 0.015, 0, 0.6)
add(whoosh(0.9, 300, 1400, 0.9, 0.85), H["arch"]["fill"][0], 0.05, 0, 0.3)
for tw, nm in zip(H["glow"]["words"], ["F#5", "E5", "D5"]):
    add(pop(hz(nm)), tw, 0.11, 0, 0.3)
add(shimmer_line(0.55), H["glow"]["loop"][0], 0.012, 0.2, 0.5)
add(whoosh(0.55, 500, 3200, 1.0, 0.55), H["push"][0], 0.07, -0.2, 0.25)
for i in range(4):
    add(pop(hz(["B4", "D5", "E5", "F#5"][i]) * 0.5), H["menu"]["cards"] + i * 0.09, 0.06, 0.1, 0.3)
add(ui_tap(hz("E5")), H["menu"]["tap"], 0.30, 0.15, 0.25)
add(whoosh(0.85, 260, 2200, 0.9, 0.7), H["menu"]["expand"][0], 0.06, 0, 0.3)
add(bell(hz("A6"), 2.6, 1.0), H["menu"]["expand"][1] - 0.1, 0.03, 0.3, 0.7)
add(clack(), H["stones"]["drop"], 0.30, 0, 0.35)
add(pop(hz("A5")), H["stones"]["card"] + 0.7, 0.08, 0.4, 0.3)
add(shimmer_line(0.55), H["stones"]["circle"][0], 0.015, 0, 0.6)
add(whoosh(0.7, 2400, 300, 0.9, 0.35), H["stones"]["iris"][0], 0.06, 0, 0.3)
add(bell(hz("F#6"), 3.0, 1.2), H["stones"]["iris"][1], 0.035, -0.2, 0.7)
for tw, nm in zip(H["jar"]["words"], ["D5", "E5", "F#5"]):
    add(pop(hz(nm)), tw, 0.11, 0, 0.3)
add(pop(hz("A5")), H["jar"]["pill"], 0.08, 0.35, 0.3)
add(whoosh(0.55, 1800, 400, 0.9, 0.4), H["jar"]["shrink"][0], 0.05, 0, 0.3)
add(shimmer_line(0.6), H["trust"]["ring"][0], 0.014, 0, 0.6)
for i, nm in enumerate(["D6", "E6", "F#6", "A6", "B6"]):
    add(bell(hz(nm), 2.2, 0.9), H["trust"]["stars"] + i * 0.1, 0.03, -0.4 + 0.2 * i, 0.7)
for tc, nm in zip(H["trust"]["chips"], ["F#5", "A5"]):
    add(pop(hz(nm)), tc, 0.08, 0, 0.3)
add(whoosh(0.55, 600, 2600, 1.0, 0.4), H["trust"]["out"][0], 0.05, 0, 0.3)
add(shimmer_line(0.55), H["book"]["outline"][0], 0.014, 0, 0.6)
add(ui_tap(hz("F#5")), H["book"]["dateTap"], 0.28, 0.1, 0.25)
for i in range(4):
    add(pop(hz(["D5", "E5", "F#5", "A5"][i])), H["book"]["chips"] + i * 0.08, 0.065, -0.3 + 0.2 * i, 0.3)
add(ui_tap(hz("E5")), H["book"]["timeTap"], 0.28, -0.1, 0.25)
add(ui_tap(hz("D5")), H["book"]["confirmTap"], 0.32, 0, 0.25)
add(bell(hz("A5"), 2.6, 1.0), H["book"]["check"][1] - 0.05, 0.06, -0.1, 0.6)
add(bell(hz("D6"), 2.8, 1.0), H["book"]["check"][1] + 0.08, 0.06, 0.1, 0.6)
add(whoosh(0.5, 400, 1600, 0.9, 0.5), H["book"]["out"][0], 0.04, 0, 0.3)
add(bowl(hz("D3"), 9.0, 0.8), H["end"]["grow"][0] + 0.05, 0.16, 0, 0.55)
add(shimmer_line(H["end"]["grow"][1] - H["end"]["grow"][0]), H["end"]["grow"][0], 0.014, 0, 0.6)
add(pop(hz("A5")), H["end"]["cta"], 0.08, 0, 0.3)
add(shimmer_line(H["end"]["trace"][1] - H["end"]["trace"][0]), H["end"]["trace"][0], 0.014, 0.2, 0.6)
add(ui_tap(hz("D6")), H["end"]["tap"], 0.34, 0.1, 0.25)
for k in range(9):
    add(bell(hz(["D6", "F#6", "A6", "B6", "D7"][k % 5]) * (1 + 0.003 * k), 1.8, 0.7), H["end"]["tap"] + 0.05 + k * 0.07, 0.018, rng.uniform(-0.7, 0.7), 0.8)

# ------------------------------------------------------------------ reverb
def impulse(seconds, seed):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros(n)
    for lo, hi, rt in [(40, 400, 3.8), (400, 2000, 3.1), (2000, 6000, 2.2), (6000, 16000, 1.3)]:
        ir += signal.sosfilt(band(lo, hi), r.standard_normal(n)) * np.exp(-6.91 * t / rt)
    pre = int(0.024 * SR)
    ir = np.concatenate([np.zeros(pre), ir])[:n]
    ir[pre : pre + int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return ir / np.sqrt(np.sum(ir ** 2))


wet = np.vstack([signal.fftconvolve(send[c], impulse(4.0, 21 + c))[:N] for c in range(2)])
mix = dry + wet * 0.6


def biquad(kind, f0, gain_db, q=0.707):
    """RBJ shelving/peaking EQ as an sos section."""
    A, w0 = 10 ** (gain_db / 40), 2 * np.pi * f0 / SR
    cw, al = np.cos(w0), np.sin(w0) / (2 * q)
    if kind == "peak":
        b = [1 + al * A, -2 * cw, 1 - al * A]
        a = [1 + al / A, -2 * cw, 1 - al / A]
    else:
        sq = 2 * np.sqrt(A) * al
        sgn = 1 if kind == "high" else -1
        b = [A * ((A + 1) + sgn * (A - 1) * cw + sq), -2 * sgn * A * ((A - 1) + sgn * (A + 1) * cw), A * ((A + 1) + sgn * (A - 1) * cw - sq)]
        a = [(A + 1) - sgn * (A - 1) * cw + sq, 2 * sgn * ((A - 1) - sgn * (A + 1) * cw), (A + 1) - sgn * (A - 1) * cw - sq]
    return np.hstack([np.array(b) / a[0], np.array(a) / a[0]])[None, :]


eq = np.vstack([biquad("low", 110, -2.5), biquad("peak", 2400, 3.0, 0.7), biquad("high", 5000, 5.0)])
mix = signal.sosfilt(eq, mix, axis=1)

# --------------------------------------------------------------- mastering
# gentle bus compression and a soft tail; loudness (-14 LUFS, -1 dBTP) is
# set by ffmpeg at mux time.
mono = np.sqrt(np.mean(mix ** 2, axis=0))
envl = signal.sosfilt(signal.butter(1, 5, fs=SR, output="sos"), mono)
lvl = 20 * np.log10(np.maximum(envl, 1e-6))
mix *= 10 ** (np.where(lvl > -20, -(lvl + 20) * (1 - 1 / 1.7), 0) / 20)
tail = np.ones(N)
i0, i1 = int(29.0 * SR), int(DUR * SR)
tail[i0:i1] = np.cos(np.linspace(0, np.pi / 2, i1 - i0)) ** 1.5
tail[i1:] = 0
mix *= tail
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.05) / np.tanh(1.05) * 0.89
mix = mix[:, : int(SR * DUR)]

out = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "out" / "score.wav"
out.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype(np.int16).tobytes())
print(f"wrote {out}  {DUR:.1f}s")
