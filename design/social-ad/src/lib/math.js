// Timing, easing and deterministic noise. Everything in the film is a pure
// function of time, so any frame can be rendered in isolation.

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Normalised progress of t through [a, b], clamped to 0..1. */
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);

export const inCubic = (t) => t * t * t;
export const outCubic = (t) => 1 - (1 - t) ** 3;
export const outQuart = (t) => 1 - (1 - t) ** 4;
export const inOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

/** CSS-style cubic-bezier easing. */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (u) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let t = u;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - u, d = dx(t);
      if (Math.abs(e) < 1e-7 || Math.abs(d) < 1e-7) break;
      t -= e / d;
    }
    if (!(t >= 0 && t <= 1) || Math.abs(sx(t) - u) > 1e-5) {
      let lo = 0, hi = 1;
      t = u;
      for (let i = 0; i < 50; i++) {
        const x = sx(t);
        if (Math.abs(x - u) < 1e-7) break;
        if (x < u) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return sy(t);
  };
}

// The film's house curves.
export const luxe = bezier(0.76, 0, 0.24, 1); // dramatic in-out: transitions
export const silk = bezier(0.62, 0, 0.32, 1); // softer in-out: camera, morphs
export const glide = bezier(0.33, 0, 0.18, 1); // quick start, long settle
export const lift = bezier(0.2, 0.9, 0.3, 1); // type reveals
export const gravity = bezier(0.6, 0, 0.94, 0.5); // things that fall

/** Unit step response of a damped spring: 0 → 1 with natural overshoot. */
export function spring(t, freq = 1.2, damp = 0.55) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  if (damp >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - damp * damp);
  return 1 - Math.exp(-damp * w * t) * (Math.cos(wd * t) + ((damp * w) / wd) * Math.sin(wd * t));
}

/** 0 → 1 over [a, b], hold, 1 → 0 over [c, d]. */
export function env(t, a, b, c, d, ein = smooth, eout = smooth) {
  if (t <= a || t >= d) return 0;
  if (t < b) return ein(prog(t, a, b));
  if (t <= c) return 1;
  return 1 - eout(prog(t, c, d));
}

// --- deterministic noise --------------------------------------------------
export function hash1(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
/** Smooth 1D value noise in [-1, 1]. */
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1(i + seed * 101.3), hash1(i + 1 + seed * 101.3), u) * 2 - 1;
}
export function fbm1(x, seed = 0, oct = 3) {
  let v = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    v += a * noise1(x * f, seed + i * 7.7);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return v / n;
}
export function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
