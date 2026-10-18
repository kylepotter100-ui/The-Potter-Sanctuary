// The Line: a hand-drawn ribbon with tapered ends, drawn on by arc length.

import { cumlen, pointAt } from "./geom.js";
import { smooth } from "./math.js";

/**
 * Clear a canvas to transparent and restore its default state (transform,
 * alpha, filter, compositing) in one call — every frame starts from scratch.
 */
export function wipe(ctx) {
  if (ctx.reset) ctx.reset();
  else ctx.canvas.width = ctx.canvas.width;
}

/**
 * Fill a variable-width ribbon along `pts`.
 *  a, b      draw range as fractions of total arc length
 *  w         base width in px; wf(u) multiplies it (u = arc fraction 0..1)
 *  taper     [startPx, endPx] taper lengths measured from the drawn ends
 *  minTaper  width fraction at a fully tapered end
 */
export function ribbon(ctx, pts, o = {}) {
  const { a = 0, b = 1, w = 6, wf = null, taper = [40, 40], minTaper = 0.12, color = "#EFE8D6", alpha = 1, s = cumlen(pts) } = o;
  const L = s[s.length - 1];
  if (L <= 0 || alpha <= 0) return;
  const sa = Math.max(0, a * L), sb = Math.min(L, b * L);
  if (sb - sa < 0.5) return;

  // Collect points in [sa, sb] with interpolated ends.
  const P = [], S = [];
  const pa = pointAt(pts, s, sa);
  P.push([pa.x, pa.y]);
  S.push(sa);
  for (let i = 0; i < pts.length; i++) {
    if (s[i] > sa + 0.25 && s[i] < sb - 0.25) {
      P.push(pts[i]);
      S.push(s[i]);
    }
  }
  const pb = pointAt(pts, s, sb);
  P.push([pb.x, pb.y]);
  S.push(sb);

  const n = P.length;
  const left = new Array(n), right = new Array(n), W = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = P[Math.max(0, i - 1)], q = P[Math.min(n - 1, i + 1)];
    let tx = q[0] - p[0], ty = q[1] - p[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const u = S[i] / L;
    let wi = w * (wf ? wf(u, S[i]) : 1);
    const ta = taper[0] > 0 ? minTaper + (1 - minTaper) * smooth(Math.min(1, (S[i] - sa) / taper[0])) : 1;
    const tb = taper[1] > 0 ? minTaper + (1 - minTaper) * smooth(Math.min(1, (sb - S[i]) / taper[1])) : 1;
    wi *= ta * tb;
    W[i] = wi;
    const hx = -ty * wi * 0.5, hy = tx * wi * 0.5;
    left[i] = [P[i][0] + hx, P[i][1] + hy];
    right[i] = [P[i][0] - hx, P[i][1] - hy];
  }

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill("nonzero");
  // round the ends so blunt (untapered) ends don't look cut
  for (const i of [0, n - 1]) {
    if (W[i] > 1.2) {
      ctx.beginPath();
      ctx.arc(P[i][0], P[i][1], W[i] / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  return { head: pb, tail: pa, length: L };
}

/**
 * Draw something into a scratch layer, then add it back blurred (bloom).
 * The bloom follows the caller's transform and opacity, so a glowing stroke
 * inside a moving, scaling or fading group blooms where it is drawn.
 */
export function glow(ctx, scratch, blur, strength, draw) {
  const sc = scratch.getContext("2d");
  wipe(sc);
  const k = scratch.width / ctx.canvas.width;
  const m = ctx.getTransform();
  sc.setTransform(k * m.a, k * m.b, k * m.c, k * m.d, k * m.e, k * m.f);
  draw(sc);
  const a = ctx.globalAlpha;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = strength * a;
  ctx.filter = `blur(${blur * k}px)`;
  ctx.drawImage(scratch, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/** The luminous point at the drawing end of the line — the hand. */
export function penTip(ctx, x, y, r, alpha, color = "255,248,232") {
  if (alpha <= 0) return;
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${color},${0.95 * alpha})`);
  g.addColorStop(0.18, `rgba(${color},${0.55 * alpha})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Ribbon with an explicit width per point (logo strokes). */
export function ribbonPts(ctx, P, Wd) {
  const n = P.length;
  if (n < 2) return;
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const p = P[Math.max(0, i - 1)], q = P[Math.min(n - 1, i + 1)];
    let tx = q[0] - p[0], ty = q[1] - p[1];
    const tl = Math.hypot(tx, ty) || 1;
    const hx = (-ty / tl) * Wd[i] * 0.5, hy = (tx / tl) * Wd[i] * 0.5;
    left.push([P[i][0] + hx, P[i][1] + hy]);
    right.push([P[i][0] - hx, P[i][1] - hy]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill("nonzero");
  for (const i of [0, n - 1]) {
    if (Wd[i] > 0.8) {
      ctx.beginPath();
      ctx.arc(P[i][0], P[i][1], Wd[i] / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
