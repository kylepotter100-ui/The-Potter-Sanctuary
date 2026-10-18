// Motion-graphics kit: the UI pieces the film animates — cards, pills,
// a touch indicator and its ripple, stars, glossy orbs, circular type —
// and the outlines the signature line traces between screens.

export const COL = {
  sage: "#8A9E85",
  sageDeep: "#6E8068",
  sageMid: "#A8B498",
  sagePale: "#D6DCC9",
  cream: "#EFE8D6",
  creamSoft: "#F5EFE0",
  bone: "#FBF7EC",
  ink: "#3A3F31",
  inkSoft: "#5A6149",
};

/** Rounded card with a soft, lifted shadow. */
export function card(ctx, x, y, w, h, { r = 36, fill = COL.creamSoft, shadow = 0.22, lift = 1, alpha = 1 } = {}) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (shadow > 0) {
    ctx.shadowColor = `rgba(34,42,30,${shadow})`;
    ctx.shadowBlur = 46 * lift;
    ctx.shadowOffsetY = 20 * lift;
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

/** Pill centred on (cx, cy). */
export function pill(ctx, cx, cy, w, h, { fill = null, stroke = null, lw = 2, alpha = 1, shadow = 0 } = {}) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
  if (fill) {
    if (shadow > 0) {
      ctx.shadowColor = `rgba(34,42,30,${shadow})`;
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 12;
    }
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = "rgba(0,0,0,0)";
  }
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  ctx.restore();
}

/** A fingertip: soft white disc that dips when pressed. */
export function tap(ctx, x, y, { alpha = 1, press = 0 } = {}) {
  if (alpha <= 0.001) return;
  const r = 38 * (1 - 0.2 * press);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.shadowColor = "rgba(20,26,18,0.28)";
  ctx.shadowBlur = 24 * (1 - press * 0.6);
  ctx.shadowOffsetY = 10 * (1 - press * 0.7);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "rgba(0,0,0,0)";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.stroke();
  ctx.restore();
}

/** Expanding ring from a tap; p runs 0 → 1. */
export function ripple(ctx, x, y, p, { rgb = "255,255,255", r0 = 24, r1 = 150, width = 3, alpha = 0.7 } = {}) {
  if (p <= 0 || p >= 1) return;
  const e = 1 - (1 - p) ** 3;
  ctx.save();
  ctx.globalAlpha *= alpha * (1 - p) ** 1.5;
  ctx.strokeStyle = `rgb(${rgb})`;
  ctx.lineWidth = width * (1 - p * 0.6);
  ctx.beginPath();
  ctx.arc(x, y, r0 + (r1 - r0) * e, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function starPath(ctx, cx, cy, R, r = R * 0.45, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r : R;
    const a = rot + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/** A glossy pearl: shaded sphere with a soft highlight and contact shadow. */
export function orb(ctx, cx, cy, r, base, deep, { alpha = 1 } = {}) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = "rgba(30,36,28,0.18)";
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.1, cy + r * 0.9, r * 0.8, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r * 1.05);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.18, base);
  g.addColorStop(1, deep);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const h = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.45, 0, cx - r * 0.38, cy - r * 0.45, r * 0.42);
  h.addColorStop(0, "rgba(255,255,255,0.85)");
  h.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = h;
  ctx.fill();
  ctx.restore();
}

/** Type set around a circle, centred on angle a0. */
export function circleText(ctx, text, cx, cy, R, a0, font, color, tracking = 0) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const widths = [...text].map((ch) => ctx.measureText(ch).width + tracking);
  const total = widths.reduce((a, b) => a + b, 0);
  let a = a0 - total / R / 2;
  [...text].forEach((ch, i) => {
    const w = widths[i];
    a += w / 2 / R;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += w / 2 / R;
  });
  ctx.restore();
}

// ---- outlines for the line to trace (polylines, frame px) ----------------
/** Arch: up the left side, over a semicircle, down the right. */
export function archPts(x0, x1, yTop, yBottom, step = 10) {
  const r = (x1 - x0) / 2, cx = x0 + r, cy = yTop + r, pts = [];
  for (let y = yBottom; y > cy; y -= step) pts.push([x0, y]);
  for (let i = 0; i <= 64; i++) {
    const a = Math.PI + (i / 64) * Math.PI;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  for (let y = cy + step; y <= yBottom; y += step) pts.push([x1, y]);
  return pts;
}
export function archPath(ctx, x0, x1, yTop, yBottom) {
  const r = (x1 - x0) / 2;
  ctx.beginPath();
  ctx.moveTo(x0, yBottom);
  ctx.lineTo(x0, yTop + r);
  ctx.arc(x0 + r, yTop + r, r, Math.PI, 0);
  ctx.lineTo(x1, yBottom);
  ctx.closePath();
}

/** Rounded rectangle perimeter, starting top-centre, clockwise. */
export function roundRectPts(x, y, w, h, r, n = 4) {
  const pts = [[x + w / 2, y]];
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= 12; i++) {
      const a = a0 + (i / 12) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  pts.push([x + w - r, y]);
  corner(x + w - r, y + r, -Math.PI / 2);
  pts.push([x + w, y + h - r]);
  corner(x + w - r, y + h - r, 0);
  pts.push([x + r, y + h]);
  corner(x + r, y + h - r, Math.PI / 2);
  pts.push([x, y + r]);
  corner(x + r, y + r, Math.PI);
  pts.push([x + w / 2, y]);
  // densify straight runs so the ribbon tapers smoothly
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (n * 3)));
    for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  out.push(pts.at(-1));
  return out;
}

/** Circle, starting at angle a0, clockwise. */
export function circlePts(cx, cy, r, a0 = -Math.PI / 2, n = 120) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

/** A hand-drawn loop around a word: slightly open, slightly tilted. */
export function loopPts(cx, cy, rx, ry, n = 90) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = -2.6 + u * Math.PI * 2.18;
    const wob = 1 + 0.04 * Math.sin(u * 9.0);
    pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob + (u - 0.5) * 10]);
  }
  return pts;
}

export function checkPts(cx, cy, s) {
  return [[cx - 0.42 * s, cy + 0.02 * s], [cx - 0.12 * s, cy + 0.3 * s], [cx + 0.44 * s, cy - 0.3 * s]];
}
