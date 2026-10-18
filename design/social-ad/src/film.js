// The Potter Sanctuary — a 30-second social film.
//
// The daffodil is drawn by one luminous line, and that line carries the whole
// film: it opens on the logo drawing itself on sage, then draws the arch,
// the loop, the card outline, the circle and the check that each new screen
// opens from — and finally grows the daffodil again above a CTA that gets
// tapped. Every screen is designed (no photography), the imagery is rendered
// in code (src/beauty3d.js), and every value here is a pure function of time.

import { clamp, lerp, prog, smooth, env, spring, bezier, luxe, silk, glide, lift, inOutSine, outCubic, noise1, rng } from "./lib/math.js";
import { spline, cumlen } from "./lib/geom.js";
import { ribbon, ribbonPts, glow, penTip, wipe } from "./lib/stroke.js";
import { TypeLine } from "./lib/type.js";
import { COL, card, pill, tap, ripple, starPath, orb, circleText, archPts, archPath, roundRectPts, circlePts, loopPts, checkPts } from "./kit.js";

const LINE_W = 6.2;
// the logo's growth: the stem shoots up, the petals take their time
const grow = bezier(0.5, 0, 0.22, 1);
const STACK = [
  { c: [0.0, 0.94, -0.45], r: [0.44, 0.15, 0.35], yaw: 0.2 },
  { c: [0.03, 1.215, -0.45], r: [0.34, 0.125, 0.28], yaw: -0.35 },
  { c: [-0.02, 1.44, -0.45], r: [0.25, 0.1, 0.205], yaw: 0.5 },
  { c: [0.78, 0.29, 0.12], r: [0.16, 0.06, 0.13], yaw: 0.9 },
  { c: [-0.7, 0.285, 0.22], r: [0.13, 0.055, 0.11], yaw: -0.4 },
];

export function createFilm({ W, H, logo, cues: C, layers, b3, gobo, scale3d }) {
  const A = layers.A.getContext("2d");
  const O = layers.O.getContext("2d");
  let t = 0;
  let U = {};

  // ------------------------------------------------------------------ type
  const SERIF = "Cormorant Garamond", SANS = "Lora";
  const F = (size, style = "normal", weight = 300, family = SERIF) => ({ family, size, style, weight });
  const L = (text, f) => new TypeLine(O, text, f);
  const TX = {
    wm1: L("The Potter", F(132)),
    wm2: L("Sanctuary", F(150, "italic")),
    ebLogo: L("BODY THERAPY · BECK ROW, SUFFOLK", F(26, "normal", 500, SANS)),
    ebGlow: L("BODY THERAPIES TO", F(28, "normal", 500, SANS)),
    relax: L("Relax.", F(156)),
    restore: L("Restore.", F(156)),
    glowW: L("Glow.", F(168, "italic")),
    ebMenu: L("THE TREATMENT MENU", F(28, "normal", 500, SANS)),
    menuTitle: [L("Four", F(118)), L("rituals.", F(118, "italic"))],
    cards: [
      { name: L("Full Body Aromatherapy", F(50, "normal", 400)), meta: L("60 MIN · LIGHT – MEDIUM", F(22, "normal", 500, SANS)), price: L("£50", F(60, "normal", 400)), orb: ["#E9E4F0", "#A79BB8"] },
      { name: L("Back, Neck & Scalp", F(50, "normal", 400)), meta: L("30 MIN · MEDIUM – FIRM", F(22, "normal", 500, SANS)), price: L("£25", F(60, "normal", 400)), orb: ["#F4E7CF", "#C9A46A"] },
      { name: L("Hot Stones Full Body", F(50, "normal", 400)), meta: L("60 MIN · DEEP RELEASE", F(22, "normal", 500, SANS)), price: L("£60", F(60, "normal", 400)), orb: ["#6B6E68", "#121411"] },
      { name: L("Hot Stones Back", F(50, "normal", 400)), meta: L("30 MIN · BACK TENSION", F(22, "normal", 500, SANS)), price: L("£35", F(60, "normal", 400)), orb: ["#8F928B", "#2A2C28"] },
    ],
    ebStones: L("HOT STONES · 60 MIN", F(25, "normal", 500, SANS)),
    stonesLines: [L("Heat travels where", F(64)), L("pressure alone cannot reach.", F(64, "italic"))],
    price60: L("£60", F(40, "normal", 500)),
    jarWords: [L("Whipped.", F(110)), L("Plant-based.", F(110)), L("Small-batch.", F(110, "italic"))],
    jarPill: L("MADE BY PRECYSE BY NATURE", F(24, "normal", 500, SANS)),
    badgeA: L("Clarins", F(92, "italic", 400)),
    badgeB: L("TRAINED", F(26, "normal", 500, SANS)),
    trust: [L("A trained hand,", F(104)), L("a natural touch.", F(104, "italic"))],
    chips: [L("1:1 PRIVATE STUDIO", F(24, "normal", 500, SANS)), L("BY APPOINTMENT", F(24, "normal", 500, SANS))],
    ebBook: L("BOOK ONLINE", F(24, "normal", 500, SANS)),
    bookTitle: L("Choose a time.", F(76)),
    days: "MTWTFSS".split("").map((d) => L(d, F(22, "normal", 500, SANS))),
    dates: ["12", "13", "14", "15", "16", "17", "18"].map((d) => L(d, F(40, "normal", 400))),
    times: ["10:00", "11:30", "14:00", "16:30"].map((s) => L(s, F(30, "normal", 500, SANS))),
    sumName: L("Hot Stones Full Body", F(46, "normal", 400)),
    sumPrice: L("£60", F(46, "normal", 400)),
    sumMeta: L("60 MIN · FRI 16 · 11:30", F(22, "normal", 500, SANS)),
    confirm: L("Confirm booking", F(34, "normal", 500, SANS)),
    booked: L("You’re booked.", F(68, "italic")),
    cta: L("BOOK YOUR QUIET HOUR", F(30, "normal", 500, SANS)),
    url: L("thepottersanctuary.co.uk", F(34, "normal", 400, SANS)),
  };

  // --------------------------------------------------------------- helpers
  /** Sage screen with depth: soft key light, darker floor, drifting leaves. */
  function sage(ctx, leaf = 0.13) {
    ctx.fillStyle = COL.sage;
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(600, 620, 0, 600, 620, 1250);
    g.addColorStop(0, "rgba(222,228,208,0.32)");
    g.addColorStop(1, "rgba(222,228,208,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const v = ctx.createLinearGradient(0, 1150, 0, H);
    v.addColorStop(0, "rgba(52,62,48,0)");
    v.addColorStop(1, "rgba(52,62,48,0.28)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    leaves(ctx, leaf);
  }
  /** Leaf shadows drifting across whatever is underneath (multiply). */
  function leaves(ctx, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha *= alpha;
    ctx.translate(540, 760);
    ctx.rotate(-0.42 + 0.02 * Math.sin(t * 0.5));
    ctx.scale(1.75, 1.75);
    const ox = (t * 6) % 1024;
    const oy = noise1(t * 0.35, 8) * 6;
    for (const dx of [-1024, 0]) for (const dy of [-1024, 0]) ctx.drawImage(gobo, dx + ox - 300, dy + oy - 300);
    ctx.restore();
  }

  /** The Line, with its bloom. */
  function line(ctx, pts, o = {}) {
    const { a = 0, b = 1, w = LINE_W, alpha = 1, glowAmt = 0.55, tip = 0, taper = [60, 26], color = COL.cream, glowColor = "rgb(255,242,218)" } = o;
    if (alpha <= 0.001 || b - a <= 0.0005) return null;
    const s = cumlen(pts);
    if (glowAmt > 0) glow(ctx, layers.scratch, 12, glowAmt * alpha, (g) => ribbon(g, pts, { a, b, w: w * 2.2, taper, s, color: glowColor }));
    const r = ribbon(ctx, pts, { a, b, w, taper, s, alpha, color });
    if (tip > 0 && r) penTip(ctx, r.head.x, r.head.y, 46, tip * alpha);
    return r;
  }

  /** The logo, grown along geodesic distance from the stem tip. */
  function daffodil(ctx, ox, oy, k, D, { alpha = 1, color = COL.cream, taperPx = 14, wmul = 1 } = {}) {
    if (alpha <= 0.001 || D <= 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    const P = [], Wd = [];
    const flush = () => {
      if (P.length >= 2) ribbonPts(ctx, P.slice(), Wd.slice());
      P.length = 0;
      Wd.length = 0;
    };
    const push = (x, y, w, bt) => {
      P.push([ox + x * k, oy + y * k]);
      Wd.push(w * k * wmul * (0.25 + 0.75 * smooth(clamp((D - bt) / taperPx))));
    };
    for (const e of logo.edges) {
      for (let i = 0; i < e.length; i++) {
        const p = e[i], inside = p[3] <= D;
        if (i > 0) {
          const q = e[i - 1];
          if (inside !== q[3] <= D) {
            const u = (D - q[3]) / (p[3] - q[3]);
            push(lerp(q[0], p[0], u), lerp(q[1], p[1], u), lerp(q[2], p[2], u), D);
            if (!inside) flush();
          }
        }
        if (inside) push(p[0], p[1], p[2], p[3]);
      }
      flush();
    }
    ctx.restore();
  }
  function logoGlow(ctx, lg, D, strength) {
    glow(ctx, layers.scratch, 14, strength, (g) => daffodil(g, lg.ox, lg.oy, lg.k, D, { color: "rgb(255,244,222)", wmul: 2.1 }));
    daffodil(ctx, lg.ox, lg.oy, lg.k, D);
  }
  /** Logo placement for a scale and centre-top (art bbox 21–227 × 34–366). */
  const logoAt = (k, cx, top) => ({ k, ox: cx - 124 * k, oy: top - 34 * k, root: [cx - 124 * k + 148.6 * k, top - 34 * k + 363 * k] });
  /** The highest point on the growth front — where the pen light rides. */
  function frontPoint(D) {
    let best = null;
    for (const e of logo.edges) {
      for (let i = 1; i < e.length; i++) {
        const q = e[i - 1], p = e[i];
        if ((q[3] <= D) !== (p[3] <= D)) {
          const u = (D - q[3]) / (p[3] - q[3]);
          const pt = [lerp(q[0], p[0], u), lerp(q[1], p[1], u)];
          if (!best || pt[1] < best[1]) best = pt;
        }
      }
    }
    return best;
  }

  // masked rise: glyphs come up from behind their own baseline
  function rise(ctx, tl, x, y, t0, o = {}) {
    const { align = "center", color = COL.cream, stagger = 0.028, dur = 0.85, t1 = 1e9, word = false, tracking = 0 } = o;
    if (t < t0 || t > t1 + 1.2) return;
    const exiting = t >= t1;
    tl.draw(ctx, x, y, {
      align, color, tracking,
      clip: exiting ? null : [tl.f.size * 1.1, tl.f.size * 0.32],
      fx: (i) => {
        const d = t0 + (word ? tl.word[i] * 0.09 : i * stagger);
        const pe = lift(prog(t, d, d + dur));
        const px = inOutSine(prog(t, t1 + i * 0.012, t1 + i * 0.012 + 0.5));
        return { dy: (1 - pe) * tl.f.size * 1.02 - px * tl.f.size * 0.3, a: Math.min(1, pe * 1.8) * (1 - px), blur: px * 6 };
      },
    });
  }

  // elastic pop: each glyph springs up from nothing, overshoots, settles
  function elastic(ctx, tl, x, y, t0, o = {}) {
    const { align = "center", color = COL.cream, stagger = 0.035, freq = 1.9, damp = 0.36, t1 = 1e9, tracking = 0 } = o;
    if (t < t0 || t > t1 + 1) return;
    tl.draw(ctx, x, y, {
      align, color, tracking,
      fx: (i) => {
        const s = spring(t - t0 - i * stagger, freq, damp);
        if (s <= 0.001) return null;
        const px = inOutSine(prog(t, t1 + i * 0.012, t1 + i * 0.012 + 0.45));
        return { sc: Math.max(0.001, s * (1 - px * 0.3)), dy: (1 - Math.min(s, 1)) * tl.f.size * 0.28 - px * 30, rot: (1 - s) * 0.25, a: clamp(s * 4) * (1 - px) };
      },
    });
  }

  // small caps that settle their tracking as they fade in, letter by letter
  function eyebrow(ctx, tl, x, y, t0, o = {}) {
    const { color = COL.cream, alpha = 0.9, t1 = 1e9, align = "center", rules = true } = o;
    const pin = prog(t, t0, t0 + 1.0), pout = prog(t, t1, t1 + 0.45);
    if (pin <= 0 || pout >= 1) return;
    const tr = lerp(0.62, 0.36, glide(pin));
    const a = alpha * smooth(Math.min(1, pin * 1.8)) * (1 - smooth(pout));
    const st = 0.45 / Math.max(1, tl.text.length - 1);
    ctx.save();
    ctx.globalAlpha *= a;
    const r = tl.draw(ctx, x, y, { align, tracking: tr, color, fx: (i) => ({ a: smooth(prog(pin, i * st, i * st + 0.5)) }) });
    if (rules) {
      const rl = tl.f.size * 1.5 * outCubic(prog(pin, 0.15, 0.85)), yy = y - tl.f.size * 0.36;
      ctx.fillStyle = color;
      ctx.globalAlpha *= 0.7;
      ctx.fillRect(r.x0 - 24 - rl, yy, rl, 1.6);
      ctx.fillRect(r.x0 + r.width + 24 - tl.f.size * tr, yy, rl, 1.6);
    }
    ctx.restore();
  }

  /** Fingertip choreography: glides between keys [{t,x,y}] in arcs, dips on taps,
   *  then lifts away along `exit` after the last key so it never hides the result. */
  function finger(ctx, keys, taps, tIn, tOut, exit = [150, 230]) {
    const a = env(t, tIn, tIn + 0.25, tOut - 0.25, tOut);
    if (a <= 0) return;
    let x = keys[0].x, y = keys[0].y;
    const last = keys[keys.length - 1], away = glide(prog(t, taps[taps.length - 1] + 0.12, tOut));
    for (let i = 0; i < keys.length - 1; i++) {
      const k0 = keys[i], k1 = keys[i + 1];
      if (t >= k0.t && t <= k1.t) {
        const u = silk(prog(t, k0.t, k1.t));
        x = lerp(k0.x, k1.x, u);
        y = lerp(k0.y, k1.y, u) - Math.sin(Math.PI * u) * 60;
      } else if (t > k1.t) {
        x = k1.x;
        y = k1.y;
      }
    }
    if (t > last.t) {
      x += exit[0] * away;
      y += exit[1] * away;
    }
    let press = 0;
    for (const tp of taps) press = Math.max(press, env(t, tp - 0.1, tp, tp + 0.04, tp + 0.22));
    tap(ctx, x, y, { alpha: a, press });
  }
  /** Spring squish of a pressed element: 1 → dips → overshoots → settles. */
  const squish = (tp, depth = 0.05) => (t < tp - 0.1 ? 1 : t < tp ? 1 - depth * smooth(prog(t, tp - 0.1, tp)) : 1 - depth + depth * spring(t - tp, 2.2, 0.38));

  // ------------------------------------------------- rendered imagery (3D)
  // Rendered at 30 fps (the camera moves slowly) and kept between frames.
  const mkCache = () => ({ key: null, c: Object.assign(document.createElement("canvas"), { width: b3.W, height: b3.H }) });
  const cache = { stones: mkCache(), swirl: mkCache() };
  const keep = (slot, key, render) => {
    const s = cache[slot];
    if (s.key !== key) {
      const g = s.c.getContext("2d", { willReadFrequently: true });
      g.clearRect(0, 0, s.c.width, s.c.height);
      g.drawImage(render(), 0, 0);
      s.key = key;
    }
    return s.c;
  };
  function stonesImage() {
    const tq = Math.round(t * 30) / 30;
    return keep("stones", tq, () => {
      const p = silk(prog(tq, C.menu.expand[0], C.stones.iris[1]));
      const cam = [lerp(-0.42, 0.28, p), lerp(1.45, 1.72, p), lerp(4.25, 5.15, p)];
      // the top stone drops onto the stack on the downbeat, with a small bounce
      const td = C.stones.drop;
      let dy;
      if (tq < td - 0.32) dy = 9;
      else if (tq < td) dy = 1.6 * (1 - ((tq - (td - 0.32)) / 0.32) ** 2);
      else dy = 0.05 * Math.abs(Math.sin(Math.PI * Math.min(1, (tq - td) / 0.2))) * (tq - td < 0.2 ? 1 : 0);
      const stones = STACK.map((s, i) => (i === 2 ? { ...s, c: [s.c[0], s.c[1] + dy, s.c[2]] } : s));
      return b3.stones({ time: tq, cam, target: [0, 1.28, -0.6], fov: 0.6, stones, leafOff: [0.1 + tq * 0.004, 0.2] });
    });
  }
  const JAR = { c: [540, 640], r: 280 };
  function swirlImage() {
    const tq = Math.round(t * 30) / 30;
    return keep("swirl", tq, () => b3.swirl({ time: tq, c: [JAR.c[0] * scale3d, JAR.c[1] * scale3d], r: JAR.r * scale3d, rot: 0.6 + tq * 0.22 }));
  }

  // ================================================================ SCENES
  // ---- S1: the logo draws itself on sage --------------------------------
  const LOGO1 = logoAt(1.72, 540, 400);
  function sceneLogo(ctx) {
    sage(ctx);
    const push = 1 + 0.035 * smooth(prog(t, 0, C.arch.fill[1]));
    ctx.save();
    ctx.translate(540, 900);
    ctx.scale(push, push);
    ctx.translate(-540, -900);
    const D = logo.maxBirth * grow(prog(t, C.logo.draw[0], C.logo.draw[1]));
    const bloom = 0.42 + 0.55 * env(t, C.logo.draw[1] - 0.15, C.logo.draw[1] + 0.12, C.logo.draw[1] + 0.25, C.logo.draw[1] + 1.1);
    if (D > 0) logoGlow(ctx, LOGO1, D, bloom);
    if (D > 0 && t < C.logo.draw[1]) {
      const f = frontPoint(D);
      if (f) penTip(ctx, LOGO1.ox + f[0] * LOGO1.k, LOGO1.oy + f[1] * LOGO1.k, 42, 0.9);
    }
    rise(ctx, TX.wm1, 540, 1185, C.logo.wordmark, { stagger: 0.03 });
    rise(ctx, TX.wm2, 540, 1320, C.logo.wordmark + 0.18, { stagger: 0.03 });
    eyebrow(ctx, TX.ebLogo, 540, 1420, C.logo.eyebrow);
    ctx.restore();
  }

  // ---- T1: the line draws an arch around the logo, which fills cream ----
  const ARCH = { x0: 110, x1: 970, top: 300, bottom: 1760 };
  const ARCH_PTS = archPts(ARCH.x0, ARCH.x1, ARCH.top, ARCH.bottom);
  function archPanel(ctx, fillLevel, outline, lineAlpha = 1, rimAlpha = 0) {
    if (fillLevel > 0) {
      ctx.save();
      archPath(ctx, ARCH.x0, ARCH.x1, ARCH.top, ARCH.bottom);
      ctx.clip();
      const y = lerp(ARCH.bottom + 40, ARCH.top - 60, fillLevel);
      const wave = fillLevel < 1 ? 18 * (1 - fillLevel) : 0;
      ctx.fillStyle = COL.creamSoft;
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, y);
      for (let x = 0; x <= W; x += 30) ctx.lineTo(x, y + Math.sin(x * 0.012 + t * 7) * wave);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
      ctx.clip(); // the same leaf light falls on the cream
      leaves(ctx, 0.07);
      ctx.restore();
    }
    if (rimAlpha > 0) {
      ctx.save();
      ctx.globalAlpha *= rimAlpha;
      archPath(ctx, ARCH.x0, ARCH.x1, ARCH.top, ARCH.bottom);
      ctx.strokeStyle = COL.sageDeep;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    if (outline > 0) line(ctx, ARCH_PTS, { a: 0.5 - 0.5 * outline, b: 0.5 + 0.5 * outline, alpha: lineAlpha, glowAmt: 0.6, taper: [40, 40], tip: outline < 1 ? 0.8 : 0 });
  }

  // ---- S2: Relax. Restore. Glow. -----------------------------------------
  const MINI = logoAt(0.36, 540, 360);
  function sceneGlow(ctx) {
    sage(ctx);
    archPanel(ctx, 1, 0, 0, 0.35);
    const D = logo.maxBirth * grow(prog(t, C.glow.eyebrow - 0.1, C.glow.eyebrow + 0.9));
    daffodil(ctx, MINI.ox, MINI.oy, MINI.k, D, { color: COL.sageDeep, wmul: 1.3 });
    eyebrow(ctx, TX.ebGlow, 540, 560, C.glow.eyebrow + 0.2, { color: COL.sageDeep, alpha: 1 });
    const [w1, w2, w3] = C.glow.words;
    elastic(ctx, TX.relax, 540, 830, w1, { color: COL.sageDeep });
    elastic(ctx, TX.restore, 540, 1060, w2, { color: COL.sageDeep });
    elastic(ctx, TX.glowW, 540, 1300, w3, { color: COL.sageDeep });
    // the line circles "Glow." like a hand-drawn note
    const lp = luxe(prog(t, C.glow.loop[0], C.glow.loop[1]));
    if (lp > 0) line(ctx, loopPts(545, 1252, 230, 108), { b: lp, color: COL.sageDeep, glowAmt: 0, w: 5, taper: [30, 50] });
  }

  // ---- S3: the treatment menu ---------------------------------------------
  const CARD = (i) => ({ x: 80, y: 600 + i * 196, w: 920, h: 172 });
  const PICK = 2;
  function menuCard(ctx, cd, r, flash = 0) {
    card(ctx, r.x, r.y, r.w, r.h, { r: 34, fill: COL.creamSoft });
    if (flash > 0) card(ctx, r.x, r.y, r.w, r.h, { r: 34, fill: `rgba(255,255,255,${0.55 * flash})`, shadow: 0 });
    const cy = r.y + r.h / 2;
    orb(ctx, r.x + 88, cy, 46, cd.orb[0], cd.orb[1]);
    cd.name.draw(ctx, r.x + 168, cy + 2, { align: "left", color: COL.ink });
    cd.meta.draw(ctx, r.x + 170, cy + 46, { align: "left", tracking: 0.2, color: COL.sageDeep });
    cd.price.draw(ctx, r.x + r.w - 72, cy + 20, { align: "right", color: COL.sageDeep });
  }
  function sceneMenu(ctx, expandP = 0) {
    sage(ctx);
    const head = 1 - smooth(prog(expandP, 0, 0.4));
    if (head > 0) {
      ctx.save();
      ctx.globalAlpha = head;
      eyebrow(ctx, TX.ebMenu, 540, 345, C.menu.header);
      const [w0, w1] = [TX.menuTitle[0].width(), TX.menuTitle[1].width()], gap = 34;
      const x0 = 540 - (w0 + gap + w1) / 2;
      rise(ctx, TX.menuTitle[0], x0, 490, C.menu.header + 0.1, { align: "left" });
      rise(ctx, TX.menuTitle[1], x0 + w0 + gap, 490, C.menu.header + 0.22, { align: "left" });
      ctx.restore();
    }
    TX.cards.forEach((cd, i) => {
      if (i === PICK && expandP > 0) return;
      const s = spring(t - C.menu.cards - i * 0.09, 1.5, 0.62);
      if (s <= 0.001) return;
      const r = CARD(i);
      const recede = smooth(prog(expandP, 0, 0.6));
      const sc = (i === PICK ? squish(C.menu.tap, 0.045) : 1) * (1 - 0.06 * recede);
      ctx.save();
      ctx.globalAlpha = clamp(s * 2) * (1 - recede);
      ctx.translate(540, r.y + r.h / 2 + (1 - s) * 300);
      ctx.scale(sc, sc);
      ctx.translate(-540, -(r.y + r.h / 2));
      menuCard(ctx, cd, r, i === PICK ? env(t, C.menu.tap - 0.05, C.menu.tap + 0.05, C.menu.tap + 0.3, C.menu.tap + 0.7) : 0);
      ctx.restore();
    });
    // the tapped card is traced by the line before it opens
    if (t >= C.menu.tap && expandP <= 0) {
      const r = CARD(PICK), tb = traced();
      line(ctx, roundRectPts(r.x - 6, r.y - 6, r.w + 12, r.h + 12, 40), { b: tb, glowAmt: 0.7, w: 4.5, taper: [20 * (1 - tb), 40 * (1 - tb)] });
    }
  }

  const traced = () => luxe(prog(t, C.menu.tap, C.menu.tap + 0.42));

  // ---- T3 + S4: the card opens into the hot-stones set --------------------
  function sceneStones(ctx, expandP) {
    const r0 = CARD(PICK);
    const e = luxe(expandP);
    const rx = lerp(r0.x, 0, e), ry = lerp(r0.y, 0, e), rw = lerp(r0.w, W, e), rh = lerp(r0.h, H, e), rr = lerp(34, 0, e);
    ctx.save();
    if (expandP < 1) {
      card(ctx, rx, ry, rw, rh, { r: rr, fill: COL.creamSoft, shadow: 0.25 * (1 - e) });
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, rr);
      ctx.clip();
    }
    // the image is revealed through the growing window, not scaled with it
    ctx.globalAlpha = smooth(prog(expandP, 0.15, 0.75));
    ctx.drawImage(stonesImage(), 0, 0, W, H);
    ctx.restore();
    if (expandP < 1) {
      if (expandP > 0) {
        ctx.save();
        ctx.globalAlpha = 1 - smooth(prog(expandP, 0, 0.3));
        menuCard(ctx, TX.cards[PICK], { x: rx, y: ry, w: rw, h: r0.h });
        ctx.restore();
        const tb = traced();
        line(ctx, roundRectPts(rx - 6, ry - 6, rw + 12, rh + 12, rr + 6), { b: tb, glowAmt: 0.7, w: 4.5, alpha: 1 - smooth(prog(expandP, 0.6, 1)), taper: [20 * (1 - tb), 40 * (1 - tb)] });
      }
      return;
    }
    // the caption card, readable on cream
    const s = spring(t - C.stones.card, 1.4, 0.66);
    const out = smooth(prog(t, C.stones.out, C.stones.out + 0.4));
    if (s <= 0.001 || out >= 1) return;
    ctx.save();
    ctx.globalAlpha = clamp(s * 2) * (1 - out);
    ctx.translate(0, (1 - s) * 220 + out * 160);
    card(ctx, 70, 1120, 940, 310, { r: 38, fill: COL.creamSoft, shadow: 0.25 });
    eyebrow(ctx, TX.ebStones, 120, 1192, C.stones.card + 0.05, { color: COL.sageDeep, alpha: 1, align: "left", rules: false });
    rise(ctx, TX.stonesLines[0], 118, 1290, C.stones.card + 0.15, { align: "left", color: COL.ink, word: true });
    rise(ctx, TX.stonesLines[1], 118, 1372, C.stones.card + 0.27, { align: "left", color: COL.ink, word: true });
    const ps = spring(t - (C.stones.card + 0.55), 2.0, 0.4);
    if (ps > 0.001) {
      ctx.translate(868, 1182);
      ctx.scale(ps, ps);
      pill(ctx, 0, 0, 130, 64, { fill: COL.sageDeep });
      TX.price60.draw(ctx, 0, 14, { color: COL.cream });
    }
    ctx.restore();
  }

  // ---- T4: the line draws a circle; the room closes to it; the jar opens --
  const CIRCLE = circlePts(JAR.c[0], JAR.c[1], JAR.r * 1.17 + 4);
  function jar(ctx, scale = 1, swirlAlpha = 1) {
    const { c, r } = JAR;
    ctx.save();
    ctx.translate(c[0], c[1]);
    ctx.scale(scale, scale);
    ctx.translate(-c[0], -c[1]);
    const sh = ctx.createRadialGradient(c[0] + 26, c[1] + 40, r * 0.6, c[0] + 26, c[1] + 40, r * 1.5);
    sh.addColorStop(0, `rgba(38,46,34,${0.42 * swirlAlpha})`);
    sh.addColorStop(1, "rgba(38,46,34,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(c[0] - r * 2, c[1] - r * 2, r * 4, r * 4);
    ctx.globalAlpha *= swirlAlpha;
    ctx.drawImage(swirlImage(), 0, 0, W, H);
    ctx.restore();
  }
  function iris(ctx) {
    const ip = luxe(prog(t, C.stones.iris[0], C.stones.iris[1]));
    const xf = smooth(prog(t, C.stones.iris[0] + 0.2, C.stones.iris[1]));
    if (xf > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(JAR.c[0], JAR.c[1], JAR.r * 1.2, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = xf;
      sage(ctx, 0);
      jar(ctx, 1);
      ctx.restore();
    }
    if (ip > 0) {
      const R = lerp(1500, JAR.r * 1.19, ip);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.arc(JAR.c[0], JAR.c[1], R, 0, Math.PI * 2, true);
      ctx.clip("evenodd");
      sage(ctx);
      ctx.restore();
    }
    const cp = luxe(prog(t, C.stones.circle[0], C.stones.circle[1]));
    const fade = 1 - smooth(prog(t, C.stones.iris[1] - 0.4, C.stones.iris[1]));
    if (cp > 0) line(ctx, CIRCLE, { b: cp, alpha: fade, glowAmt: 0.7, taper: [30, 30], tip: cp < 1 ? 0.9 : 0 });
  }

  // ---- S5: whipped, plant-based, small-batch ------------------------------
  function sceneJar(ctx) {
    sage(ctx);
    const sp = prog(t, C.jar.shrink[0], C.jar.shrink[1]);
    const e = luxe(sp);
    jar(ctx, lerp(1, BADGE.r / (JAR.r * 1.17), e), 1 - smooth(prog(sp, 0.35, 0.9)));
    if (sp > 0) badgeDisc(ctx, smooth(prog(sp, 0.3, 1)));
    const out = C.jar.shrink[0] - 0.2;
    TX.jarWords.forEach((tl, i) => elastic(ctx, tl, 540, 1085 + i * 112, C.jar.words[i], { t1: out + i * 0.04 }));
    const ps = spring(t - C.jar.pill, 1.8, 0.42);
    const pOut = smooth(prog(t, out, out + 0.35));
    if (ps > 0.001 && pOut < 1) {
      ctx.save();
      ctx.globalAlpha = clamp(ps * 3) * (1 - pOut);
      ctx.translate(540 + (1 - Math.min(ps, 1.2)) * 300, 1400);
      const w = TX.jarPill.width(0.2) + 72;
      pill(ctx, 0, 0, w, 66, { stroke: COL.cream, lw: 2 });
      TX.jarPill.draw(ctx, 0, 9, { tracking: 0.2, color: COL.cream });
      ctx.restore();
    }
  }

  // ---- S6: Clarins-trained, five-star care --------------------------------
  const BADGE = { c: [540, 640], r: 205 };
  function badgeDisc(ctx, a) {
    if (a <= 0.001) return;
    const { c, r } = BADGE;
    ctx.save();
    ctx.globalAlpha *= a;
    const g = ctx.createRadialGradient(c[0] - 60, c[1] - 80, 20, c[0], c[1], r);
    g.addColorStop(0, "#7E9278");
    g.addColorStop(1, COL.sageDeep);
    ctx.shadowColor = "rgba(30,38,28,0.35)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 20;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function sceneTrust(ctx) {
    sage(ctx);
    const out = prog(t, C.trust.out[0], C.trust.out[1]);
    const eo = luxe(out);
    ctx.save();
    ctx.translate(BADGE.c[0], BADGE.c[1] - eo * 340);
    ctx.scale(1 - 0.75 * eo, 1 - 0.75 * eo);
    ctx.rotate(-eo * 0.6);
    ctx.translate(-BADGE.c[0], -BADGE.c[1]);
    ctx.globalAlpha = 1 - smooth(prog(out, 0.5, 1));
    badgeDisc(ctx, 1);
    line(ctx, circlePts(BADGE.c[0], BADGE.c[1], BADGE.r + 16), { b: luxe(prog(t, C.trust.ring[0], C.trust.ring[1])), glowAmt: 0.5, w: 3.6, taper: [20, 20] });
    line(ctx, circlePts(BADGE.c[0], BADGE.c[1], BADGE.r + 66, Math.PI / 2), { b: luxe(prog(t, C.trust.ring[0] + 0.12, C.trust.ring[1] + 0.12)), glowAmt: 0.35, w: 2.4, taper: [20, 20] });
    const ra = smooth(prog(t, C.trust.ring[0] + 0.3, C.trust.ring[1] + 0.4));
    if (ra > 0) {
      ctx.save();
      ctx.globalAlpha *= ra * 0.95;
      circleText(ctx, "FIVE-STAR CARE · PLANT-BASED · ONE GUEST AT A TIME · ", BADGE.c[0], BADGE.c[1], BADGE.r + 41, -Math.PI / 2 + t * 0.16, `500 21px "Lora"`, COL.cream, 3.2);
      ctx.restore();
    }
    for (let i = 0; i < 5; i++) {
      const s = spring(t - C.trust.stars - i * 0.1, 2.1, 0.38);
      if (s <= 0.001) continue;
      const a = -Math.PI / 2 + (i - 2) * 0.32;
      ctx.save();
      ctx.translate(BADGE.c[0] + Math.cos(a) * (BADGE.r - 58), BADGE.c[1] + Math.sin(a) * (BADGE.r - 58) + 6);
      ctx.scale(s, s);
      ctx.rotate((1 - s) * 0.8);
      ctx.fillStyle = COL.cream;
      starPath(ctx, 0, 0, 17, 7.5);
      ctx.fill();
      ctx.restore();
    }
    rise(ctx, TX.badgeA, BADGE.c[0], BADGE.c[1] + 36, C.trust.ring[0] + 0.25);
    eyebrow(ctx, TX.badgeB, BADGE.c[0], BADGE.c[1] + 104, C.trust.ring[0] + 0.45, { rules: false, alpha: 0.95 });
    ctx.restore();
    const ho = C.trust.out[0];
    rise(ctx, TX.trust[0], 540, 1050, C.trust.headline, { word: true, t1: ho });
    rise(ctx, TX.trust[1], 540, 1162, C.trust.headline + 0.18, { word: true, t1: ho + 0.05 });
    // the line underscores "a natural touch."
    const up = luxe(prog(t, C.trust.headline + 0.7, C.trust.headline + 1.2));
    const uo = 1 - smooth(prog(t, ho, ho + 0.4));
    if (up > 0) line(ctx, spline([[300, 1196], [420, 1188], [560, 1194], [700, 1186], [790, 1192]], 10), { b: up, alpha: uo, w: 4, glowAmt: 0.5, taper: [30, 60] });
    TX.chips.forEach((tl, i) => {
      const s = spring(t - C.trust.chips[i], 2.0, 0.42);
      if (s <= 0.001) return;
      const w = tl.width(0.2) + 70;
      ctx.save();
      ctx.globalAlpha = clamp(s * 3) * uo;
      ctx.translate(i === 0 ? 312 : 786, 1300);
      ctx.scale(s, s);
      pill(ctx, 0, 0, w, 68, { fill: "rgba(239,232,214,0.16)", stroke: COL.cream, lw: 1.8 });
      tl.draw(ctx, 0, 9, { tracking: 0.2, color: COL.cream });
      ctx.restore();
    });
  }

  // ---- S7: booking in three taps ------------------------------------------
  const BOOK = { x: 90, y: 400, w: 900, h: 1030 };
  const DATE_X = (i) => 192 + i * 116, DATE_Y = 760, PICK_DATE = 4;
  const TIME_X = (i) => 240 + i * 200, TIME_Y = 905, PICK_TIME = 1;
  const BTN = { cx: 540, cy: 1240, w: 760, h: 112 };
  const BOOK_OUTLINE = roundRectPts(BOOK.x, BOOK.y, BOOK.w, BOOK.h, 42);
  function sceneBook(ctx) {
    const out = luxe(prog(t, C.book.out[0], C.book.out[1]));
    const fill = smooth(prog(t, C.book.fill[0], C.book.fill[1]));
    const op = luxe(prog(t, C.book.outline[0], C.book.outline[1]));
    ctx.save();
    ctx.translate(0, out * 120);
    ctx.globalAlpha = 1 - out;
    if (fill > 0) {
      ctx.save();
      const s = 0.97 + 0.03 * fill;
      ctx.translate(540, BOOK.y + BOOK.h / 2);
      ctx.scale(s, s);
      ctx.translate(-540, -(BOOK.y + BOOK.h / 2));
      card(ctx, BOOK.x, BOOK.y, BOOK.w, BOOK.h, { r: 42, fill: COL.creamSoft, alpha: fill });
      ctx.restore();
    }
    if (op > 0) {
      // two strokes from the top centre, meeting at the bottom
      const o = { alpha: 1 - fill * 0.85, glowAmt: 0.6, taper: [30, 30] };
      line(ctx, BOOK_OUTLINE, { ...o, a: 0, b: op / 2 });
      line(ctx, BOOK_OUTLINE, { ...o, a: 1 - op / 2, b: 1 });
    }
    if (fill > 0.3) {
      const c0 = C.book.fill[1];
      eyebrow(ctx, TX.ebBook, 540, 495, c0 - 0.1, { color: COL.sageDeep, alpha: 1 });
      rise(ctx, TX.bookTitle, 540, 600, c0, { color: COL.ink, word: true });
      TX.days.forEach((tl, i) => {
        ctx.save();
        ctx.globalAlpha *= smooth(prog(t, c0 + 0.1 + i * 0.03, c0 + 0.4 + i * 0.03));
        tl.draw(ctx, DATE_X(i), 690, { color: COL.inkSoft });
        ctx.restore();
      });
      TX.dates.forEach((tl, i) => {
        const s = spring(t - c0 - 0.15 - i * 0.035, 2.0, 0.5);
        if (s <= 0.001) return;
        const isPick = i === PICK_DATE;
        const picked = isPick ? spring(t - C.book.dateTap, 2.2, 0.45) : 0;
        const sq = isPick ? squish(C.book.dateTap, 0.08) : 1;
        ctx.save();
        ctx.translate(DATE_X(i), DATE_Y);
        ctx.scale(s * sq, s * sq);
        ctx.globalAlpha *= clamp(s * 3);
        if (picked > 0) {
          ctx.fillStyle = COL.sageDeep;
          ctx.beginPath();
          ctx.arc(0, 0, 46 * Math.min(picked, 1.15), 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = "rgba(110,128,104,0.35)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 46, 0, Math.PI * 2);
          ctx.stroke();
        }
        tl.draw(ctx, 0, 14, { color: picked > 0.5 ? COL.cream : COL.ink });
        ctx.restore();
      });
      ripple(ctx, DATE_X(PICK_DATE), DATE_Y, prog(t, C.book.dateTap, C.book.dateTap + 0.6), { rgb: "110,128,104", r0: 46, r1: 120 });
      TX.times.forEach((tl, i) => {
        const s = spring(t - C.book.chips - i * 0.08, 2.0, 0.42);
        if (s <= 0.001) return;
        const isPick = i === PICK_TIME;
        const picked = isPick ? smooth(prog(t, C.book.timeTap, C.book.timeTap + 0.18)) : 0;
        const sq = isPick ? squish(C.book.timeTap, 0.07) : 1;
        ctx.save();
        ctx.translate(TIME_X(i), TIME_Y);
        ctx.scale(s * sq, s * sq);
        ctx.globalAlpha *= clamp(s * 3);
        pill(ctx, 0, 0, 168, 78, { fill: picked > 0 ? `rgba(110,128,104,${picked})` : null, stroke: COL.sageDeep, lw: 1.8 });
        tl.draw(ctx, 0, 11, { color: picked > 0.5 ? COL.cream : COL.sageDeep });
        ctx.restore();
      });
      ripple(ctx, TIME_X(PICK_TIME), TIME_Y, prog(t, C.book.timeTap, C.book.timeTap + 0.6), { rgb: "110,128,104", r0: 40, r1: 130 });
      const hp = luxe(prog(t, C.book.timeTap + 0.15, C.book.timeTap + 0.55));
      if (hp > 0) {
        ctx.fillStyle = "rgba(110,128,104,0.35)";
        ctx.fillRect(170, 1010, 740 * hp, 1.6);
      }
      rise(ctx, TX.sumName, 170, 1085, C.book.timeTap + 0.25, { align: "left", color: COL.ink, word: true });
      rise(ctx, TX.sumPrice, 910, 1085, C.book.timeTap + 0.32, { align: "right", color: COL.sageDeep });
      eyebrow(ctx, TX.sumMeta, 172, 1132, C.book.timeTap + 0.35, { color: COL.sageDeep, alpha: 1, align: "left", rules: false });
      confirmButton(ctx);
    }
    ctx.restore();
  }
  function confirmButton(ctx) {
    const s = spring(t - C.book.button, 1.6, 0.6);
    if (s <= 0.001) return;
    const tp = C.book.confirmTap;
    const m = luxe(prog(t, C.book.morph[0], C.book.morph[1]));
    const w = lerp(BTN.w, BTN.h, m);
    const pop = 1 + 0.08 * Math.sin(Math.PI * prog(t, C.book.check[1], C.book.check[1] + 0.3));
    ctx.save();
    ctx.translate(BTN.cx, BTN.cy + (1 - s) * 200);
    ctx.scale(squish(tp, 0.05) * pop, squish(tp, 0.05) * pop);
    ctx.globalAlpha *= clamp(s * 2);
    pill(ctx, 0, 0, w, BTN.h, { fill: COL.sageDeep, shadow: 0.25 });
    const rp = prog(t, tp, tp + 0.55);
    if (rp > 0 && rp < 1) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-w / 2, -BTN.h / 2, w, BTN.h, BTN.h / 2);
      ctx.clip();
      ctx.fillStyle = `rgba(255,255,255,${0.28 * (1 - rp)})`;
      ctx.beginPath();
      ctx.arc(80, 0, 40 + 600 * outCubic(rp), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const la = 1 - smooth(prog(m, 0, 0.45));
    if (la > 0) {
      ctx.save();
      ctx.globalAlpha *= la;
      TX.confirm.draw(ctx, 0, 12, { tracking: 0.04, color: COL.cream });
      ctx.restore();
    }
    const cp = luxe(prog(t, C.book.check[0], C.book.check[1]));
    if (cp > 0) line(ctx, spline(checkPts(0, 2, 62), 10), { b: cp, w: 6, glowAmt: 0.4, taper: [8, 8] });
    ctx.restore();
    rise(ctx, TX.booked, 540, 1382, C.book.booked, { color: COL.sageDeep });
  }

  // ---- S8: the logo again, and the button that gets pressed ---------------
  const LOGO2 = logoAt(1.42, 540, 330);
  const CTA = { cx: 540, cy: 1318, h: 122 };
  const PETALS = Array.from({ length: 24 }, (_, i) => {
    const r = rng(500 + i * 13);
    return { a: -Math.PI / 2 + (r() - 0.5) * 3.0, v: 650 + r() * 750, s: 17 + r() * 17, spin: (r() - 0.5) * 9, flip: 5 + r() * 7, ph: r() * 6.28, hue: r() };
  });
  function sceneEnd(ctx) {
    sage(ctx);
    // the check's stroke carries on, up into the stem
    const cp = silk(prog(t, C.end.connect[0], C.end.connect[1] + 0.25));
    const ret = smooth(prog(t, C.end.grow[0] + 0.2, C.end.grow[0] + 0.8));
    if (cp > 0 && ret < 1) line(ctx, spline([[540, 1240], [610, 1180], [596, 1060], LOGO2.root], 16), { a: ret, b: cp, w: LINE_W * 0.85, tip: cp < 1 ? 1 : 0, taper: [40, 10] });
    const D = logo.maxBirth * grow(prog(t, C.end.grow[0], C.end.grow[1]));
    const breathe = 1 + 0.008 * Math.sin((t - C.end.grow[1]) * 1.7) * smooth(prog(t, C.end.grow[1], C.end.grow[1] + 1));
    ctx.save();
    ctx.translate(540, 560);
    ctx.scale(breathe, breathe);
    ctx.translate(-540, -560);
    if (D > 0) logoGlow(ctx, LOGO2, D, 0.42 + 0.5 * env(t, C.end.grow[1] - 0.2, C.end.grow[1] + 0.1, C.end.grow[1] + 0.2, C.end.grow[1] + 1.2));
    ctx.restore();
    rise(ctx, TX.wm1, 540, 975, C.end.wordmark, { stagger: 0.03 });
    rise(ctx, TX.wm2, 540, 1108, C.end.wordmark + 0.18, { stagger: 0.03 });
    eyebrow(ctx, TX.ebLogo, 540, 1196, C.end.eyebrow);
    ctaButton(ctx);
    const ua = smooth(prog(t, C.end.url, C.end.url + 0.7));
    if (ua > 0) {
      ctx.save();
      ctx.globalAlpha = 0.9 * ua;
      TX.url.draw(ctx, 540, 1448 + 14 * (1 - lift(ua)), { tracking: 0.05, color: COL.cream });
      ctx.restore();
    }
  }
  function ctaButton(ctx) {
    const s = spring(t - C.end.cta, 1.7, 0.45);
    if (s <= 0.001) return;
    const tp = C.end.tap;
    const w = TX.cta.width(0.24) + 160;
    const sq = squish(tp, 0.07) * (1 + 0.035 * Math.sin(Math.PI * prog(t, C.end.pulse, C.end.pulse + 0.5)));
    const sc = sq * Math.min(1.2, s);
    ctx.save();
    ctx.translate(CTA.cx, CTA.cy + (1 - Math.min(s, 1)) * 160);
    ctx.scale(sc, sc);
    ctx.globalAlpha *= clamp(s * 3);
    // a halo released by the press
    const hp = prog(t, tp, tp + 0.9);
    if (hp > 0 && hp < 1) {
      ctx.save();
      ctx.globalAlpha *= (1 - hp) ** 1.6 * 0.8;
      ctx.lineWidth = 3;
      ctx.strokeStyle = COL.cream;
      const g = 26 * outCubic(hp) + 4;
      ctx.beginPath();
      ctx.roundRect(-w / 2 - g, -CTA.h / 2 - g, w + 2 * g, CTA.h + 2 * g, CTA.h / 2 + g);
      ctx.stroke();
      ctx.restore();
    }
    pill(ctx, 0, 0, w, CTA.h, { fill: COL.creamSoft, shadow: 0.28 });
    // the line runs once around the button, inviting the tap
    const tr = luxe(prog(t, C.end.trace[0], C.end.trace[1]));
    const ta = 1 - smooth(prog(t, C.end.trace[1] + 0.05, C.end.trace[1] + 0.55));
    if (tr > 0 && ta > 0) {
      const g = 14;
      line(ctx, roundRectPts(-w / 2 - g, -CTA.h / 2 - g, w + 2 * g, CTA.h + 2 * g, CTA.h / 2 + g), { b: tr, alpha: ta, w: 3.4, glowAmt: 0.6, taper: [24 * (1 - tr), 36 * (1 - tr)], tip: tr < 1 ? 0.75 : 0 });
    }
    const rp = prog(t, tp, tp + 0.6);
    if (rp > 0 && rp < 1) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-w / 2, -CTA.h / 2, w, CTA.h, CTA.h / 2);
      ctx.clip();
      ctx.fillStyle = `rgba(110,128,104,${0.3 * (1 - rp)})`;
      ctx.beginPath();
      ctx.arc(150, 8, 30 + 520 * outCubic(rp), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const r = TX.cta.draw(ctx, -24, 11, { tracking: 0.24, color: COL.sageDeep });
    const nudge = 10 * Math.sin(Math.PI * prog(t, tp, tp + 0.4)) + 3 * Math.sin(Math.PI * 2 * prog(t, C.end.pulse, C.end.pulse + 0.6));
    const ax = r.x0 + r.width + 22 + nudge;
    ctx.strokeStyle = COL.sageDeep;
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax, 0);
    ctx.lineTo(ax + 32, 0);
    ctx.moveTo(ax + 22, -9);
    ctx.lineTo(ax + 32, 0);
    ctx.lineTo(ax + 22, 9);
    ctx.stroke();
    ctx.restore();
    // petals burst from the button
    const pp = prog(t, tp, tp + 1.55);
    if (pp > 0 && pp < 1) {
      const tt = pp * 1.55;
      // air drag: a quick burst, then a slow drifting fall
      const d = (1 - Math.exp(-2.4 * tt)) / 2.4;
      for (const p of PETALS) {
        ctx.save();
        ctx.globalAlpha = (1 - pp) ** 1.2;
        ctx.translate(CTA.cx + Math.cos(p.a) * p.v * d + Math.sin(p.ph + tt * 4) * 14 * tt, CTA.cy + Math.sin(p.a) * p.v * d + 260 * (tt - d));
        ctx.rotate(p.a + p.spin * tt);
        ctx.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(p.ph + p.flip * tt)));
        ctx.shadowColor = "rgba(30,38,28,0.22)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = p.hue > 0.45 ? COL.bone : COL.sagePale;
        // a petal: pointed tip, rounded base
        ctx.beginPath();
        ctx.moveTo(-p.s, 0);
        ctx.quadraticCurveTo(-p.s * 0.2, -p.s * 0.62, p.s, 0);
        ctx.quadraticCurveTo(-p.s * 0.2, p.s * 0.62, -p.s, 0);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // =================================================================== FRAME
  function render(time) {
    t = time;
    U = { uGrain: 0.02, uVig: 0.2, uFade: 1 - smooth(prog(t, 0, 0.3)), uDir: [0, 0] };
    wipe(A);
    wipe(O);
    const ar = C.arch, pu = C.push, mx = C.menu.expand;
    if (t < ar.fill[1]) {
      sceneLogo(A);
      const hand = smooth(prog(t, ar.fill[1] - 0.4, ar.fill[1]));
      archPanel(A, smooth(prog(t, ar.fill[0], ar.fill[1])), luxe(prog(t, ar.draw[0], ar.draw[1])), 1 - hand, 0.35 * hand);
    } else if (t < pu[0]) {
      sceneGlow(A);
    } else if (t < pu[1]) {
      // push: S2 leaves left as S3 arrives; the frame streaks with speed
      const p = luxe(prog(t, pu[0], pu[1]));
      A.save();
      A.translate(-W * p, 0);
      sceneGlow(A);
      A.restore();
      A.save();
      A.translate(W * (1 - p), 0);
      sceneMenu(A);
      A.restore();
      U.uDir = [70 * Math.sin(Math.PI * prog(t, pu[0], pu[1])), 0];
    } else if (t < mx[0]) {
      sceneMenu(A);
    } else if (t < mx[1]) {
      const p = prog(t, mx[0], mx[1]);
      sceneMenu(A, p);
      sceneStones(A, p);
    } else if (t < C.stones.iris[1]) {
      sceneStones(A, 1);
      if (t >= C.stones.circle[0]) iris(A);
    } else if (t < C.jar.shrink[1]) {
      sceneJar(A);
    } else if (t < C.book.outline[0]) {
      sceneTrust(A);
    } else if (t < C.trust.out[1] + 0.3) {
      sceneTrust(A);
      sceneBook(A);
    } else if (t < C.end.connect[0]) {
      sage(A);
      sceneBook(A);
    } else if (t < C.book.out[1]) {
      // the end card is already starting underneath as the booking card leaves
      sceneEnd(A);
      sceneBook(A);
    } else {
      sceneEnd(A);
    }
    // the fingertip that does the tapping
    if (t >= C.menu.tapIn && t < C.menu.tap + 0.8) {
      const r = CARD(PICK);
      finger(O, [{ t: C.menu.tapIn, x: 900, y: 1700 }, { t: C.menu.tap - 0.12, x: 790, y: r.y + r.h / 2 + 10 }], [C.menu.tap], C.menu.tapIn, C.menu.tap + 0.7);
      ripple(O, 790, r.y + r.h / 2 + 10, prog(t, C.menu.tap, C.menu.tap + 0.6));
    }
    if (t >= C.book.fill[1] && t < C.book.confirmTap + 0.8) {
      finger(O, [
        { t: C.book.fill[1], x: 900, y: 1650 },
        { t: C.book.dateTap - 0.12, x: DATE_X(PICK_DATE), y: DATE_Y + 6 },
        { t: C.book.timeTap - 0.12, x: TIME_X(PICK_TIME), y: TIME_Y + 6 },
        { t: C.book.confirmTap - 0.12, x: BTN.cx + 80, y: BTN.cy + 6 },
      ], [C.book.dateTap, C.book.timeTap, C.book.confirmTap], C.book.fill[1], C.book.confirmTap + 0.7, [260, 40]);
    }
    if (t >= C.end.tapIn && t < C.end.tap + 0.8) {
      finger(O, [{ t: C.end.tapIn, x: 860, y: 1640 }, { t: C.end.tap - 0.12, x: 690, y: CTA.cy + 8 }], [C.end.tap], C.end.tapIn, C.end.tap + 0.55, [230, 160]);
      ripple(O, 690, CTA.cy + 8, prog(t, C.end.tap, C.end.tap + 0.7), { r1: 190 });
    }
    return { U, useB: false };
  }

  return { duration: C.duration, render };
}
