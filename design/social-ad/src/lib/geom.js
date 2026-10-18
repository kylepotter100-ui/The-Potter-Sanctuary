// Polylines and splines. Shapes are authored as anchor lists; two shapes with
// the same anchor count morph by interpolating anchors, then re-splining.

import { lerp } from "./math.js";

function crPoint(p0, p1, p2, p3, t, alpha) {
  // Centripetal Catmull-Rom (Barry & Goldman) — no cusps or self-loops on
  // unevenly spaced anchors.
  const d = (a, b) => Math.max(1e-4, Math.hypot(b[0] - a[0], b[1] - a[1]) ** alpha);
  const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
  const tt = lerp(t1, t2, t);
  const mix = (a, b, ta, tb) => {
    const k = (tt - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };
  const a1 = mix(p0, p1, t0, t1), a2 = mix(p1, p2, t1, t2), a3 = mix(p2, p3, t2, t3);
  const b1 = mix(a1, a2, t0, t2), b2 = mix(a2, a3, t1, t3);
  return mix(b1, b2, t1, t2);
}

/** Dense polyline through the anchors. */
export function spline(anchors, samples = 14, alpha = 0.5) {
  const n = anchors.length;
  if (n < 2) return anchors.map((p) => [p[0], p[1]]);
  const ext = [
    [2 * anchors[0][0] - anchors[1][0], 2 * anchors[0][1] - anchors[1][1]],
    ...anchors,
    [2 * anchors[n - 1][0] - anchors[n - 2][0], 2 * anchors[n - 1][1] - anchors[n - 2][1]],
  ];
  const out = [];
  for (let i = 1; i < n; i++) {
    for (let s = 0; s < samples; s++) out.push(crPoint(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], s / samples, alpha));
  }
  out.push([anchors[n - 1][0], anchors[n - 1][1]]);
  return out;
}

export function cumlen(pts) {
  const s = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i++) s[i] = s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

export const lerpPts = (A, B, t) => A.map((p, i) => [lerp(p[0], B[i][0], t), lerp(p[1], B[i][1], t)]);

/** Point + tangent angle at arc length `at`. */
export function pointAt(pts, s, at) {
  const L = s[s.length - 1];
  at = Math.max(0, Math.min(L, at));
  let lo = 0, hi = s.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (s[m] < at) lo = m; else hi = m;
  }
  const seg = s[hi] - s[lo] || 1;
  const k = (at - s[lo]) / seg;
  const a = pts[lo], b = pts[hi];
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}
