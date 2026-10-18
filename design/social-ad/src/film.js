// "Drop your shoulders." — a 25-second film for The Potter Sanctuary.
//
// One cream line runs through the whole film, the way the logo is one hand-
// drawn line: it draws a figure with tense shoulders and lets them drop, lays
// her down for hot stones, rises as steam, falls as a drop of oil, opens the
// frame onto the real studio, traces its arched mirror, and finally grows
// into the daffodil. Every value below is a pure function of time t.

import {
  clamp, lerp, prog, smooth, env, spring, luxe, silk, glide, lift, gravity,
  inCubic, outCubic, inOutSine, outQuart, noise1, fbm1, rng,
} from "./lib/math.js";
import { spline, cumlen, lerpPts } from "./lib/geom.js";
import { ribbon, ribbonPts, glow, penTip, wipe } from "./lib/stroke.js";
import { TypeLine } from "./lib/type.js";
import * as S from "./shapes.js";

const CREAM = "#EFE8D6";
const SAGE = "#8A9E85";
const SAGE_DEEP = "#6E8068";
const INK = "#3A3F31";
const LINE_W = 6.4;

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(",")})`;
};

export function createFilm({ W, H, photos, logo, cues: C, layers }) {
  const A = layers.A.getContext("2d");
  const B = layers.B.getContext("2d");
  const O = layers.O.getContext("2d");
  const T = layers.tmp.getContext("2d");
  const M = layers.mask.getContext("2d");
  let t = 0; // current time, shared by the helpers below
  let U = {};

  // ---------------------------------------------------------------- type
  const SERIF = "Cormorant Garamond", SANS = "Lora";
  const F = (size, style = "normal", weight = 300, family = SERIF) => ({ family, size, style, weight });
  const L = (text, f) => new TypeLine(O, text, f);
  const TX = {
    drop: L("Drop your", F(104)),
    shoulders: L("shoulders.", F(176, "italic")),
    breathe: L("Breathe", F(150)),
    out: L("out.", F(150, "italic")),
    ebStones: L("HOT STONES", F(28, "normal", 500, SANS)),
    h1: [L("Heat travels", F(98)), L("where pressure alone", F(98)), L("cannot reach.", F(98, "italic"))],
    ebAroma: L("AROMATHERAPY", F(28, "normal", 500, SANS)),
    h2: [L("Oils blended", F(98)), L("on the day,", F(98)), L("for you.", F(98, "italic"))],
    ebScalp: L("BACK, NECK & SCALP", F(28, "normal", 500, SANS)),
    h3: [L("A trained hand,", F(98)), L("a natural touch.", F(98, "italic"))],
    ebStudio: L("THE STUDIO · BECK ROW", F(26, "normal", 500, SANS)),
    triad: [L("Clarins-trained.", F(92)), L("Plant-based.", F(92)), L("One guest", F(92)), L("at a time.", F(92, "italic"))],
    wm1: L("The Potter", F(128)),
    wm2: L("Sanctuary", F(144, "italic")),
    ebEnd: L("BODY THERAPY · BECK ROW, SUFFOLK", F(25, "normal", 500, SANS)),
    cta: L("BOOK YOUR QUIET HOUR", F(30, "normal", 500, SANS)),
    url: L("thepottersanctuary.co.uk", F(34, "normal", 400, SANS)),
    bug: L("THE POTTER SANCTUARY", F(20, "normal", 500, SANS)),
  };
  const SHADOW = { color: "rgba(14,16,12,0.45)", blur: 28, oy: 2 };

  // ------------------------------------------------------------- helpers
  const clear = wipe;

  function leak(ctx, x, y, r, a, rgb = "255,214,160") {
    if (a <= 0.001) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(0.45, `rgba(${rgb},${a * 0.4})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    ctx.restore();
  }

  /** Legibility gradient; canvas gradients pad their end colours beyond y0..y1. */
  function scrim(ctx, y0, y1, a0, a1, rgb = "20,23,18") {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, `rgba(${rgb},${a0})`);
    g.addColorStop(1, `rgba(${rgb},${a1})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /**
   * A plate in two depth layers. Each camera maps plate point P to screen
   * point c at scale s; the layers share P and c, so they agree at the focal
   * point and separate with distance from it — parallax.
   */
  function plate(ctx, name, bg, fg, decorate = null) {
    for (const [layer, cam] of [["bg", bg], ["fg", fg]]) {
      ctx.save();
      ctx.translate(cam.c[0], cam.c[1]);
      ctx.scale(cam.s, cam.s);
      ctx.translate(-cam.P[0], -cam.P[1]);
      ctx.drawImage(photos[`${name}-${layer}`], 0, 0);
      if (decorate) decorate(ctx, layer);
      ctx.restore();
    }
  }
  const cam = (s, c, P = c) => ({ s, c, P });

  /**
   * Shallow depth of field behind type: re-draw what's on ctx blurred, faded
   * out by a vertical gradient, so the headline sits on soft bokeh while the
   * subject below stays sharp.
   */
  function dof(ctx, y0, y1, blur) {
    wipe(T);
    T.filter = `blur(${blur}px)`;
    T.drawImage(ctx.canvas, 0, 0);
    T.filter = "none";
    T.globalCompositeOperation = "destination-in";
    const g = T.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    T.fillStyle = g;
    T.fillRect(0, 0, W, H);
    T.globalCompositeOperation = "source-over";
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layers.tmp, 0, 0);
    ctx.restore();
  }

  const DUST = Array.from({ length: 56 }, (_, i) => {
    const r = rng(7919 * (i + 1));
    return { x: r() * W, y: r() * H, z: r(), ph: r() * 6.283, big: r() > 0.86 };
  });
  function dust(ctx, a, rgb = "239,232,214", rise = 1) {
    if (a <= 0.001) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const d of DUST) {
      const z = 0.3 + d.z * 0.7;
      const y = (((d.y - t * (9 + 24 * z) * rise) % H) + H) % H;
      const x = d.x + Math.sin(t * 0.35 + d.ph) * 22 * z;
      const r = d.big ? 8 + 10 * z : 1.2 + 2.4 * z;
      const al = a * (d.big ? 0.06 : 0.14 + 0.28 * z) * (0.65 + 0.35 * Math.sin(t * 1.1 + d.ph * 3));
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${al})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    ctx.restore();
  }

  function flame(ctx, x, y, a = 1) {
    // candlelight breathing on its surroundings
    const f = 0.82 + 0.12 * noise1(t * 7.3, 3) + 0.06 * noise1(t * 17.1, 4);
    leak(ctx, x, y - 8, 230 * f, 0.30 * f * a, "255,190,120");
    leak(ctx, x, y, 70 * f, 0.35 * f * a, "255,236,200");
  }

  /** The Line, with its bloom. */
  function line(ctx, pts, o = {}) {
    const { a = 0, b = 1, w = LINE_W, alpha = 1, glowAmt = 0.5, tip = 0, taper = [70, 26], wf = null, color = CREAM } = o;
    if (alpha <= 0.001 || b - a <= 0.0005) return null;
    const s = cumlen(pts);
    if (glowAmt > 0) {
      glow(ctx, layers.scratch, 12, glowAmt * alpha, (g) =>
        ribbon(g, pts, { a, b, w: w * 2.2, taper, s, wf, color: "rgb(255,240,214)" }));
    }
    const r = ribbon(ctx, pts, { a, b, w, taper, s, wf, alpha, color });
    if (tip > 0 && r) penTip(ctx, r.head.x, r.head.y, 46, tip * alpha);
    return r;
  }

  // per-word rise, per-glyph vapour exit
  function headline(ctx, lines, x, y0, lh, t0, t1, o = {}) {
    const { align = "center", color = CREAM, stagger = 0.085, shadow = SHADOW, dur = 0.95 } = o;
    if (t < t0 - 0.01 || t > t1 + 1.6) return;
    let wordBase = 0;
    lines.forEach((tl, li) => {
      const y = y0 + li * lh;
      const exiting = t >= t1;
      const base = wordBase;
      tl.draw(ctx, x, y, {
        align, color, shadow,
        clip: exiting ? null : [tl.f.size * 1.08, tl.f.size * 0.42],
        fx: (i) => {
          const d = t0 + (base + tl.word[i]) * stagger;
          const pe = lift(prog(t, d, d + dur));
          const xd = t1 + li * 0.07 + i * 0.011;
          const px = inOutSine(prog(t, xd, xd + 0.6));
          return {
            dy: (1 - pe) * tl.f.size * 0.92 - px * tl.f.size * 0.3,
            a: Math.min(1, pe * 1.6) * (1 - px),
            blur: px * 7,
          };
        },
      });
      wordBase += tl.words;
    });
  }

  // —— EYEBROW —— small caps flanked by hairlines that draw outward
  function eyebrow(ctx, tl, x, y, t0, t1, o = {}) {
    const { color = CREAM, alpha = 0.92, align = "center" } = o;
    const pin = prog(t, t0, t0 + 1.0), pout = prog(t, t1, t1 + 0.5);
    if (pin <= 0 || pout >= 1) return;
    const tr = lerp(0.62, 0.36, glide(pin));
    const a = alpha * smooth(Math.min(1, pin * 1.8)) * (1 - smooth(pout));
    const rl = tl.f.size * 1.6 * outCubic(prog(pin, 0.15, 0.85));
    const yy = y - tl.f.size * 0.36;
    ctx.save();
    ctx.globalAlpha = a;
    const st = 0.45 / Math.max(1, tl.text.length - 1);
    const fx = (i) => ({ a: smooth(prog(pin, i * st, i * st + 0.5)) });
    ctx.fillStyle = color;
    if (align === "center") {
      const r = tl.draw(ctx, x, y, { align, tracking: tr, color, fx });
      ctx.globalAlpha = a * 0.7;
      ctx.fillRect(r.x0 - 24 - rl, yy, rl, 1.5);
      // trailing tracking adds air after the last glyph; keep the rules symmetric
      ctx.fillRect(r.x0 + r.width + 24, yy, rl, 1.5);
    } else {
      // left-aligned: the rule leads, as on the website's hero eyebrow
      tl.draw(ctx, x + 58, y, { align: "left", tracking: tr, color, fx });
      ctx.globalAlpha = a * 0.7;
      ctx.fillRect(x, yy, rl, 1.5);
    }
    ctx.restore();
  }

  // ----------------------------------------------------- the daffodil
  const LOGO = logo;
  function daffodil(ctx, ox, oy, k, D, { alpha = 1, color = CREAM, taperPx = 14, wmul = 1 } = {}) {
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
    for (const e of LOGO.edges) {
      for (let i = 0; i < e.length; i++) {
        const p = e[i];
        const inside = p[3] <= D;
        const prev = i > 0 ? e[i - 1] : null;
        if (prev) {
          const pin = prev[3] <= D;
          if (inside !== pin) {
            // the growth front lies between prev and p
            const u = (D - prev[3]) / (p[3] - prev[3]);
            const x = lerp(prev[0], p[0], u), y = lerp(prev[1], p[1], u), w = lerp(prev[2], p[2], u);
            push(x, y, w, D);
            if (!inside) flush();
          }
        }
        if (inside) push(p[0], p[1], p[2], p[3]);
      }
      flush();
    }
    ctx.restore();
  }

  const LINK = spline(S.SNAKE_LINK, 12);
  const PRONE = spline(S.FIG_PRONE, 14);
  const LINK_LEN = cumlen(LINK).at(-1);
  const PRONE_LEN = cumlen(PRONE).at(-1);

  // ================================================================ SCENES
  // ---- 1. night: the hook's dark room, warming as the shoulders drop
  function night(ctx) {
    const warm = smooth(prog(t, C.hook.release - 0.05, C.hook.release + 1.5));
    const g = ctx.createRadialGradient(540, 1060, 40, 540, 1060, 1300);
    g.addColorStop(0, mix("#353D31", "#55624F", warm));
    g.addColorStop(0.5, mix("#242A21", "#37412F", warm));
    g.addColorStop(1, mix("#151813", "#20261D", warm));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    leak(ctx, 540, 1000, 700, 0.05 + 0.08 * warm, "239,232,214");
    dust(ctx, 0.55 + 0.45 * warm);
  }

  // ---- 2. the band: hot stones photo developing behind the drawing
  function band(ctx) {
    const d = prog(t, C.stones.develop[0], C.stones.develop[1]);
    if (d <= 0) return;
    const zi = prog(t, C.stones.zoomIn[0], C.stones.zoomIn[1]);
    const st = S.STONES[1];
    const push = 1 + 0.035 * smooth(prog(t, C.stones.develop[0], C.stones.zoomIn[0]));
    const zs = push * Math.exp(Math.log(18) * inCubic(zi));
    const { y: by, h: bh } = S.BAND;
    ctx.save();
    ctx.translate(st.x, st.y);
    ctx.scale(zs, zs);
    ctx.translate(-st.x, -st.y);
    if (d < 1) {
      clear(T);
      T.drawImage(photos["band-stones"], 0, by, W, bh);
      clear(M);
      M.globalCompositeOperation = "lighter";
      const R = 1200 * outCubic(d);
      for (const s of S.STONES) {
        const g = M.createRadialGradient(s.x / 2, s.y / 2, 0, s.x / 2, s.y / 2, R / 2);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.5, "rgba(255,255,255,0.9)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        M.fillStyle = g;
        M.fillRect(0, 0, W / 2, H / 2);
      }
      T.globalCompositeOperation = "destination-in";
      T.drawImage(layers.mask, 0, 0, W, H);
      T.globalCompositeOperation = "source-over";
      ctx.globalAlpha = smooth(Math.min(1, d * 2.2));
      ctx.drawImage(layers.tmp, 0, 0);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(photos["band-stones"], 0, by, W, bh);
    }
    // hairlines along the band edges, drawn out from the centre
    const hl = outCubic(prog(d, 0.25, 1)) * W * 0.5;
    ctx.fillStyle = `rgba(239,232,214,${0.4 * (1 - zi)})`;
    ctx.fillRect(540 - hl, by - 1, hl * 2, 1.5);
    ctx.fillRect(540 - hl, by + bh - 0.5, hl * 2, 1.5);
    ctx.restore();
    if (zi > 0) {
      U.uZoom = inCubic(zi) * 0.95;
      U.uZC = [st.x, st.y];
    }
  }

  // ---- 3. the stack: pull back out of a stone, candle breathing
  function stack(ctx) {
    const zo = prog(t, C.stones.zoomOut[0], C.stones.zoomOut[1]);
    const e = outQuart(zo);
    const slow = 1 + 0.06 * silk(prog(t, C.stones.zoomOut[1], C.steam.dissolve[1]));
    const P = S.STACK.topStone, st = S.STONES[1];
    const cx = lerp(st.x, P[0], e), cy = lerp(st.y, P[1], e);
    // stones and candle are nearer than the wall: they shrink faster on the
    // pull-back and grow faster on the slow push
    const pull = Math.exp(Math.log(7.5) * (1 - e));
    plate(ctx, "stack",
      cam(pull ** 0.9 * slow ** 0.55, [cx, cy], P),
      cam(pull ** 1.07 * slow ** 1.35, [cx, cy], P),
      (g, layer) => layer === "fg" && flame(g, S.STACK.flame[0], S.STACK.flame[1]));
    if (e > 0.6) dof(ctx, 560, 860, 9 * smooth(prog(e, 0.6, 1)));
    scrim(ctx, 0, 900, 0.42, 0);
    U.uZoom = (1 - e) * 0.9;
    U.uZC = [cx, cy];
    U.uHeat = [90, 560, 1040, 1180];
    U.uHeatAmt = smooth(prog(t, C.stones.zoomOut[1] - 0.2, C.stones.zoomOut[1] + 0.6));
  }

  // ---- 4. aromatherapy: a slow drift across lavender and oils
  function aroma(ctx) {
    const p = silk(prog(t, C.steam.dissolve[0], C.scalp.impact + 0.4));
    // the still life drifts past faster than the wall behind it
    plate(ctx, "aroma",
      cam(1 + 0.02 * p, [540, 960], [540 + 205 * p, 960]),
      cam(1 + 0.05 * p, [540, 960], [540 + 300 * p, 960]),
      (g, layer) => layer === "fg" && flame(g, S.AROMA.flame[0], S.AROMA.flame[1]));
    dof(ctx, 640, 900, 12);
    scrim(ctx, 0, 1000, 0.5, 0);
    dust(ctx, 0.7, "255,226,180", 0.7);
  }

  // ---- 5. back, neck & scalp: the face, upright, cradled
  function scalp(ctx) {
    const p = prog(t, C.scalp.impact, C.split.open[1]);
    const k = silk(p);
    // she comes towards us; the bokeh behind barely moves
    plate(ctx, "scalp", cam(1 + 0.028 * k, [520, 700], [520 + 14 * k, 700]), cam(1 + 0.072 * k, [520, 700]));
    scrim(ctx, 860, 1920, 0, 0.74);
    dust(ctx, 0.8, "255,224,170", 0.6);
  }

  // ---- 6. the studio, then the portal into its arched mirror
  const GLASS = spline(S.GLASS, 8);
  /** screen = c + (p - P) * s, with P the centre of the mirror glass. */
  function studioCam() {
    const P = S.GLASS_CENTER;
    const slow = prog(t, C.split.open[1], C.portal.push[0]);
    const open = prog(t, C.split.open[0], C.split.open[1]);
    const pp = prog(t, C.portal.push[0], C.portal.push[1]);
    const e = inCubic(pp);
    const s0 = (1 + 0.09 * silk(slow)) * (1.1 - 0.1 * outCubic(open));
    const s = s0 * Math.exp(Math.log(6.4 / 1.09) * e);
    const k = silk(pp);
    return { s, P, c: [lerp(P[0], 540, k), lerp(P[1], 980, k)], pp, e };
  }
  const camPt = (cam, [x, y]) => [cam.c[0] + (x - cam.P[0]) * cam.s, cam.c[1] + (y - cam.P[1]) * cam.s];
  function studio(ctx) {
    const sc = studioCam();
    // the massage table is nearest: it slides past as we push to the mirror
    plate(ctx, "studio", cam(sc.s, sc.c, sc.P), cam(sc.s ** 1.14, sc.c, sc.P), (g, layer) => layer === "bg" && portalFill(g, sc));
    if (sc.pp > 0) {
      U.uZoom = sc.e * 0.75;
      U.uZC = sc.c;
    }
    leak(ctx, 860, 420, 700, 0.10 + 0.12 * smooth(prog(t, C.split.open[0], C.split.open[1])), "255,226,186");
  }
  function portalFill(ctx, cam) {
    const fill = smooth(prog(t, C.portal.fill[0], C.portal.fill[1]));
    if (fill > 0) {
      ctx.beginPath();
      GLASS.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = SAGE;
      ctx.globalAlpha = fill;
      ctx.fill();
      // the end card's soft light, already glowing inside the mirror
      const g = ctx.createRadialGradient(cam.P[0], cam.P[1] - 40, 0, cam.P[0], cam.P[1] - 40, 320);
      g.addColorStop(0, "rgba(216,222,201,0.35)");
      g.addColorStop(1, "rgba(216,222,201,0)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ---- split: the line opens the frame like a pair of doors
  function split(ctx) {
    studio(ctx);
    const p = luxe(prog(t, C.split.open[0], C.split.open[1]));
    const dy = p * (H / 2 + 80);
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate(0, dir * dy);
      ctx.beginPath();
      ctx.rect(0, dir < 0 ? 0 : H / 2, W, H / 2);
      ctx.clip();
      scalp(ctx);
      ctx.restore();
      // soft shadow cast on the studio by each leaf
      const edge = H / 2 + dir * dy;
      const g = ctx.createLinearGradient(0, edge, 0, edge - dir * 120);
      g.addColorStop(0, `rgba(10,12,9,${0.4 * (1 - p * 0.5)})`);
      g.addColorStop(1, "rgba(10,12,9,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, Math.min(edge, edge - dir * 120), W, 120);
    }
  }

  // ---- 7. the end card
  function endCard(ctx) {
    ctx.fillStyle = SAGE;
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(540, 640, 0, 540, 640, 1000);
    g.addColorStop(0, "rgba(216,222,201,0.30)");
    g.addColorStop(1, "rgba(216,222,201,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    dust(ctx, 0.5, "245,239,224", 0.5);
  }

  // ============================================================== OVERLAY
  function figureAnchors() {
    const r = spring(t - C.hook.release, 1.25, 0.55);
    let an = lerpPts(S.FIG_TENSE, S.FIG_RELAX, r);
    const tense = 1 - clamp(r * 1.3);
    if (tense > 0) {
      an = an.map((p, i) => [
        p[0] + noise1(t * 15 + i * 0.37, 1) * 1.9 * tense * S.TREMOR[i],
        p[1] + noise1(t * 17 + i * 0.41, 2) * 2.3 * tense * S.TREMOR[i],
      ]);
    }
    // a long exhale after the drop
    const ex = smooth(prog(t, C.hook.breathe, C.hook.breathe + 1.2)) * 9;
    if (ex > 0) an = an.map((p, i) => [p[0], p[1] + ex * S.TREMOR[i]]);
    return an;
  }

  function stoneShape(ctx, s, sx, sy, alpha, outline) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.scale(sx, sy);
    ctx.beginPath();
    ctx.ellipse(0, 0, s.rx, s.ry, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-s.rx * 0.35, -s.ry * 0.45, 2, 0, 0, s.rx * 1.1);
    g.addColorStop(0, "#5A5C55");
    g.addColorStop(0.35, "#2A2C27");
    g.addColorStop(1, "#121410");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fill();
    if (outline > 0) {
      ctx.globalAlpha = alpha * outline;
      ctx.lineWidth = 3 / Math.max(sx, sy);
      ctx.strokeStyle = CREAM;
      ctx.stroke();
    }
    // specular
    ctx.globalAlpha = alpha * 0.55;
    ctx.beginPath();
    ctx.ellipse(-s.rx * 0.32, -s.ry * 0.42, s.rx * 0.32, s.ry * 0.14, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,250,236,0.55)";
    ctx.filter = "blur(3px)";
    ctx.fill();
    ctx.restore();
  }

  function overlay(ctx) {
    const H0 = C.hook;
    // ---------------- hook: figure + type
    const devEnd = C.stones.develop[1];
    if (t >= H0.draw[0] && t < devEnd + 0.3) {
      // One path: seated figure → off-screen link → reclining figure. The
      // pen keeps drawing her lying down while the tail erases her sitting.
      // a slow push on the seated figure while she lets go
      const push = 1 + 0.03 * smooth(prog(t, 0.1, C.morph[0] + 0.1));
      const fig = spline(figureAnchors(), 14).map(([x, y]) => [540 + (x - 540) * push, 1150 + (y - 1150) * push]);
      const pts = fig.concat(LINK.slice(1), PRONE.slice(1));
      const L1 = cumlen(fig).at(-1), L2 = LINK_LEN, Lt = L1 + L2 + PRONE_LEN;
      const dp = luxe(prog(t, H0.draw[0], H0.draw[1]));
      const sp = prog(t, C.morph[0], C.morph[1]);
      const head = (dp * L1 + (L2 + PRONE_LEN) * luxe(sp)) / Lt;
      const tail = ((L1 + L2) * luxe(clamp(sp * 1.1 - 0.06))) / Lt;
      const fade = 1 - smooth(prog(t, C.stones.develop[0] + 0.45, devEnd + 0.1));
      const drawing = dp < 1 || (sp > 0 && sp < 1);
      line(ctx, pts, { a: tail, b: head, tip: drawing ? 1 : 0, alpha: fade, glowAmt: 0.55 });
      // the spine lengthens as she lets go
      const spn = luxe(prog(t, H0.release + 0.15, H0.release + 0.95));
      const spOut = smooth(prog(t, C.morph[0] - 0.1, C.morph[0] + 0.35));
      if (spn > 0 && spOut < 1) {
        const ex = smooth(prog(t, H0.breathe, H0.breathe + 1.2)) * 9;
        const push = 1 + 0.03 * smooth(prog(t, 0.1, C.morph[0] + 0.1));
        const sp = spline(S.SPINE.map(([x, y]) => [540 + (x - 540) * push, 1150 + (y + ex - 1150) * push]), 12);
        line(ctx, sp, { a: 0, b: spn, w: 3.4, alpha: 0.55 * (1 - spOut), glowAmt: 0.3, taper: [30, 120] });
      }
      // eye + brow once she has settled
      const ep = luxe(prog(t, C.morph[1] - 0.05, C.morph[1] + 0.35));
      if (ep > 0) {
        line(ctx, spline(S.PRONE_EYE, 10), { b: ep, w: 4.2, alpha: fade, glowAmt: 0.3, taper: [12, 12] });
        line(ctx, spline(S.PRONE_BROW, 10), { b: luxe(prog(t, C.morph[1] + 0.08, C.morph[1] + 0.45)), w: 3.6, alpha: fade * 0.9, glowAmt: 0.3, taper: [12, 12] });
      }
    }
    // "Drop your / shoulders."
    if (t < H0.exit + 1.2) {
      const rel = t - H0.release;
      ["drop", "shoulders"].forEach((k, li) => {
        const tl = TX[k];
        const y = li === 0 ? 520 : 690;
        const t0 = H0.text + (li === 0 ? 0 : 0.2);
        // mask only while rising, so the later drop isn't cropped
        const rising = t < t0 + 1.05;
        tl.draw(ctx, 540, y, {
          shadow: null,
          clip: rising ? [tl.f.size * 1.1, tl.f.size * 0.3] : null,
          fx: (i) => {
            const d = t0 + (li === 0 ? tl.word[i] * 0.1 : i * 0.016);
            const pe = lift(prog(t, d, d + 0.9));
            // the drop: each letter falls and settles on its own spring
            const dropY = li === 1 ? 50 * spring(rel - i * 0.022, 1.15, 0.5) : 12 * spring(rel, 1.0, 0.7);
            const wob = li === 1 ? (1 - spring(rel - i * 0.022, 1.15, 0.5)) * (rel > i * 0.022 ? 1 : 0) : 0;
            const xd = H0.exit + li * 0.08 + i * 0.014;
            const px = inOutSine(prog(t, xd, xd + 0.55));
            // held tension: the word shivers with the shoulders until it drops
            const tense = li === 1 ? 1 - clamp(spring(rel, 1.25, 0.55) * 1.3) : 0;
            const shiver = tense * noise1(t * 16 + i * 1.7, 5) * 1.6;
            return {
              dx: tense * noise1(t * 14 + i * 2.3, 6) * 1.2,
              dy: (1 - pe) * tl.f.size * 0.95 + dropY - px * 40 + shiver,
              rot: wob * 0.06 * (i % 2 ? 1 : -1),
              a: Math.min(1, pe * 1.6) * (1 - px),
              blur: px * 8,
            };
          },
        });
      });
    }
    // "Breathe out." — the letters exhale apart
    if (t >= H0.breathe && t < H0.breatheExit + 1) {
      const pin = prog(t, H0.breathe, H0.breathe + 0.7);
      const pout = prog(t, H0.breatheExit, H0.breatheExit + 0.6);
      const tr = lerp(-0.03, 0.09, inOutSine(prog(t, H0.breathe, H0.breatheExit + 0.6)));
      const wB = TX.breathe.width(tr), wO = TX.out.width(tr), gap = 150 * (0.26 + tr);
      const x0 = 540 - (wB + gap + wO) / 2;
      const fx = (off) => (i) => ({
        a: smooth(prog(pin, (i + off) * 0.05, (i + off) * 0.05 + 0.55)) * (1 - smooth(prog(pout, (i + off) * 0.03, (i + off) * 0.03 + 0.7))),
        dy: -pout * 36,
        blur: (1 - smooth(pin)) * 10 + pout * 9,
      });
      TX.breathe.draw(ctx, x0, 660, { align: "left", tracking: tr, fx: fx(0) });
      TX.out.draw(ctx, x0 + wB + gap, 660, { align: "left", tracking: tr, fx: fx(8) });
    }

    // ---------------- hot stones
    for (let i = 0; i < S.STONES.length; i++) {
      const s = S.STONES[i], tl = C.stones.land[i];
      const fall = prog(t, tl - 0.3, tl);
      if (fall <= 0) continue;
      const vanish = smooth(prog(t, C.stones.develop[0] + 0.35, devEnd));
      if (vanish >= 1) continue;
      const y = -360 * (1 - gravity(fall));
      const sq = Math.sin(Math.PI * prog(t, tl, tl + 0.16)) * (1 - prog(t, tl, tl + 0.16) * 0.3);
      ctx.save();
      ctx.translate(0, y);
      stoneShape(ctx, s, 1 + 0.07 * sq, 1 - 0.13 * sq, smooth(Math.min(1, fall * 3)) * (1 - vanish), 1);
      ctx.restore();
      // impact ring
      const rp = prog(t, tl, tl + 0.5);
      if (rp > 0 && rp < 1) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.strokeStyle = CREAM;
        ctx.globalAlpha = 0.5 * (1 - rp) ** 2;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, s.rx * (1.05 + 1.3 * outCubic(rp)), s.ry * (1.05 + 1.3 * outCubic(rp)), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    eyebrow(ctx, TX.ebStones, 540, 430, C.stones.eyebrow, C.stones.exit);
    headline(ctx, TX.h1, 540, 560, 100, C.stones.headline, C.stones.exit);

    // ---------------- steam: the line rises off the hot stone
    const sw = C.steam.wisp;
    if (t >= sw[0] && t < C.steam.dissolve[1] + 0.2) {
      const P = S.STACK.topStone;
      const an = [];
      for (let k = 0; k <= 9; k++) {
        const u = k / 9;
        const y = lerp(P[1] - 70, 400, u);
        const amp = 10 + 60 * u;
        an.push([lerp(P[0], 590, u) + Math.sin(u * 7.5 - t * 3.2) * amp + fbm1(u * 3 + t * 0.8, 9) * 30 * u, y - smooth(prog(t, sw[1], C.steam.dissolve[1])) * 110]);
      }
      const pts = spline(an, 12);
      const dp = outCubic(prog(t, sw[0], sw[1]));
      const fade = 1 - smooth(prog(t, C.steam.dissolve[0] + 0.25, C.steam.dissolve[1]));
      line(ctx, pts, { b: dp, alpha: fade * 0.95, w: 5.5, glowAmt: 0.7, tip: dp < 1 ? 0.8 : 0, taper: [30, 120], wf: (u) => 1 - 0.65 * u });
    }

    // ---------------- aromatherapy
    eyebrow(ctx, TX.ebAroma, 540, 430, C.aroma.eyebrow, C.aroma.exit);
    headline(ctx, TX.h2, 540, 560, 100, C.aroma.headline, C.aroma.exit);

    // ---------------- the drop of oil
    const D0 = C.drop;
    if (t >= D0.thread[0] && t < C.scalp.impact + 0.6) {
      const thread = outCubic(prog(t, D0.thread[0], D0.thread[1]));
      const retract = inCubic(prog(t, D0.form[1] - 0.06, D0.form[1] + 0.2));
      const yTop = -40, yEnd = lerp(yTop, 430, thread);
      const ya = lerp(yTop, yEnd, retract);
      if (yEnd - ya > 2) line(ctx, [[540, ya], [540, yEnd]], { w: 4, glowAmt: 0.5, taper: [40, 4] });
      const form = smooth(prog(t, D0.form[0], D0.form[1]));
      const fall = prog(t, D0.fall[0], D0.fall[1]);
      if (form > 0 && t < C.scalp.impact) {
        const g = gravity(fall);
        const y = lerp(yEnd + 14, 1150, g);
        const r = 7 + 21 * form;
        const stretch = 1 + 0.35 * Math.sin(Math.PI * fall) * fall;
        drop(ctx, 540, y, r, stretch);
      }
      // splash beads
      const sp = prog(t, C.scalp.impact, C.scalp.impact + 0.55);
      if (sp > 0 && sp < 1) {
        const R = rng(42);
        for (let k = 0; k < 11; k++) {
          const ang = -Math.PI / 2 + (R() - 0.5) * 2.2;
          const v = 520 + R() * 480;
          const x = 540 + Math.cos(ang) * v * sp;
          const y = 1150 + Math.sin(ang) * v * sp + 1900 * sp * sp;
          ctx.globalAlpha = (1 - sp) * 0.9;
          ctx.fillStyle = "rgb(255,236,196)";
          ctx.beginPath();
          ctx.arc(x, y, 2 + R() * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    // ---------------- back, neck & scalp
    eyebrow(ctx, TX.ebScalp, 540, 1112, C.scalp.eyebrow, C.scalp.exit);
    headline(ctx, TX.h3, 540, 1240, 104, C.scalp.headline, C.scalp.exit);

    // ---------------- the blade that opens the frame
    const SB = C.split;
    if (t >= SB.blade[0] && t < SB.open[1]) {
      const bp = luxe(prog(t, SB.blade[0], SB.blade[1]));
      const op = luxe(prog(t, SB.open[0], SB.open[1]));
      const dy = op * (H / 2 + 80);
      const fade = 1 - smooth(prog(t, SB.open[0] + 0.15, SB.open[1]));
      for (const dir of op > 0 ? [-1, 1] : [0]) {
        const y = H / 2 + dir * dy;
        line(ctx, [[-20, y], [W + 20, y]], { b: bp, w: 4.6, glowAmt: 1.0, alpha: fade, tip: bp < 1 ? 1 : 0, taper: [200, 30] });
      }
    }

    // ---------------- the studio
    eyebrow(ctx, TX.ebStudio, 92, 372, C.studio.eyebrow, C.studio.exit, { color: SAGE_DEEP, align: "left", alpha: 1 });
    {
      const L4 = TX.triad;
      const beats = [C.studio.lines[0], C.studio.lines[1], C.studio.lines[2], C.studio.lines[2] + 0.12];
      L4.forEach((tl, i) => {
        headline(ctx, [tl], 88, 492 + i * 98, 0, beats[i], C.studio.exit + i * 0.05, { align: "left", color: INK, shadow: null, stagger: 0.07 });
      });
    }

    // ---------------- the portal: the line finds the real mirror's arch
    const PT = C.portal;
    if (t >= PT.trace[0] && t < PT.push[1] + 0.1) {
      const cam = studioCam();
      const pts = GLASS.map((p) => camPt(cam, p));
      const tp = luxe(prog(t, PT.trace[0], PT.trace[1]));
      // on the pale wall the line draws in sage ink, then brightens as the
      // mirror turns to sage behind it
      const lit = smooth(prog(t, PT.fill[0], PT.fill[1] + 0.2));
      line(ctx, pts, { a: 0.5 - 0.5 * tp, b: 0.5 + 0.5 * tp, w: 5.5 * Math.min(cam.s, 2.5), glowAmt: 0.6 * lit, taper: [30, 30], color: mix(SAGE_DEEP, CREAM, lit) });
    }

    // ---------------- end card
    const E = C.end;
    if (t >= E.connect[0]) {
      const k = 1.38, ox = 540 - 124 * k, oy = 286 - 34 * k;
      const root = [ox + 148.6 * k, oy + 363 * k];
      // the line arrives from below and becomes the stem
      const cp = silk(prog(t, E.connect[0], E.connect[1]));
      const ret = smooth(prog(t, E.grow[0] + 0.25, E.grow[0] + 0.9));
      const cpts = [[540, H + 30], [548, 1500], [570, 1080], root];
      const cs = spline(cpts, 16);
      if (ret < 1) line(ctx, cs, { a: ret, b: cp, w: LINE_W * 0.85, tip: cp < 1 ? 1 : 0, glowAmt: 0.5, taper: [40, 10] });
      const D = LOGO.maxBirth * silk(prog(t, E.grow[0], E.grow[1]));
      const breathe = 1 + 0.008 * Math.sin((t - E.grow[1]) * 1.6) * smooth(prog(t, E.grow[1], E.grow[1] + 1));
      ctx.save();
      ctx.translate(540, 520);
      ctx.scale(breathe, breathe);
      ctx.translate(-540, -520);
      if (D > 0) {
        glow(ctx, layers.scratch, 14, 0.45 + 0.5 * env(t, E.grow[1] - 0.2, E.grow[1] + 0.1, E.grow[1] + 0.2, E.grow[1] + 1.2), (g) =>
          daffodil(g, ox, oy, k, D, { color: "rgb(255,244,222)", wmul: 2 }));
        daffodil(ctx, ox, oy, k, D);
      }
      ctx.restore();
      headline(ctx, [TX.wm1, TX.wm2], 540, 920, 132, E.wordmark, 99, { stagger: 0.12, shadow: null, dur: 1.1 });
      eyebrow(ctx, TX.ebEnd, 540, 1150, E.eyebrow, 99, { alpha: 0.9 });
      cta(ctx);
    }

    bug(ctx);
  }

  function drop(ctx, x, y, r, stretch) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 / Math.sqrt(stretch), stretch);
    ctx.beginPath();
    ctx.moveTo(0, -r * 2.1);
    ctx.bezierCurveTo(r * 0.5, -r * 1.2, r, -r * 0.5, r, 0);
    ctx.arc(0, 0, r, 0, Math.PI);
    ctx.bezierCurveTo(-r, -r * 0.5, -r * 0.5, -r * 1.2, 0, -r * 2.1);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 1, 0, 0, r * 1.4);
    g.addColorStop(0, "rgba(255,248,226,0.98)");
    g.addColorStop(0.35, "rgba(240,206,140,0.95)");
    g.addColorStop(1, "rgba(170,120,52,0.92)");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(255,214,150,0.65)";
    ctx.shadowBlur = 24;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,250,0.95)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.36, -r * 0.3, r * 0.2, r * 0.32, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function cta(ctx) {
    const E = C.end;
    const p = prog(t, E.cta, E.cta + 0.9);
    if (p <= 0) return;
    const tr = 0.24, tw = TX.cta.width(tr) + 44; // + arrow
    const pw = tw + 112, ph = 112, x = 540 - pw / 2, y = 1214;
    const e = lift(p), sc = 0.94 + 0.06 * e;
    ctx.save();
    ctx.globalAlpha = smooth(Math.min(1, p * 1.5));
    ctx.translate(540, y + ph / 2);
    ctx.scale(sc, sc);
    ctx.translate(-540, -(y + ph / 2));
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, ph / 2);
    ctx.fillStyle = CREAM;
    ctx.fill();
    // a slow glint across the pill
    const gp = prog(t, E.glint, E.glint + 1.1);
    if (gp > 0 && gp < 1) {
      ctx.save();
      ctx.clip();
      const gx = lerp(x - 200, x + pw + 200, inOutSine(gp));
      const g = ctx.createLinearGradient(gx - 120, 0, gx + 120, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.75)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, pw, ph);
      ctx.restore();
    }
    const r = TX.cta.draw(ctx, 540 - 22, y + ph / 2 + 10.5, { tracking: tr, color: SAGE_DEEP });
    // arrow
    const ax = r.x0 + r.width + 20, ay = y + ph / 2 - 0.5;
    const ap = outCubic(prog(t, E.cta + 0.35, E.cta + 1.1));
    ctx.strokeStyle = SAGE_DEEP;
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + 30 * ap, ay);
    ctx.moveTo(ax + 30 * ap - 9, ay - 8 * ap);
    ctx.lineTo(ax + 30 * ap, ay);
    ctx.lineTo(ax + 30 * ap - 9, ay + 8 * ap);
    ctx.stroke();
    ctx.restore();
    const up = prog(t, E.cta + 0.3, E.cta + 1.2);
    ctx.save();
    ctx.globalAlpha = 0.86 * smooth(up);
    TX.url.draw(ctx, 540, 1408 + 14 * (1 - lift(up)), { tracking: 0.05, color: CREAM });
    ctx.restore();
  }

  function bug(ctx) {
    const a = env(t, C.stones.eyebrow - 0.2, C.stones.eyebrow + 0.8, C.portal.push[0], C.portal.push[0] + 0.4) * 0.78;
    if (a <= 0) return;
    const onLight = env(t, C.split.open[0] + 0.3, C.split.open[1], C.portal.fill[0], C.portal.fill[1]);
    const col = mix("#EFE8D6", "#5A6149", onLight);
    const tr = 0.42, tw = TX.bug.width(tr), k = 0.13;
    const gw = 208 * k, total = gw + 16 + tw, x0 = 540 - total / 2, y = 244;
    ctx.save();
    ctx.globalAlpha = a;
    daffodil(ctx, x0 - 21 * k, y - 26 - 34 * k - 4, k, 1e9, { color: col, wmul: 1.25 });
    TX.bug.draw(ctx, x0 + gw + 16, y - 6, { align: "left", tracking: tr, color: col });
    ctx.restore();
  }

  // ================================================================ FRAME
  function render(time) {
    t = time;
    U = { uMode: 0, uProg: 0, uZoom: 0, uZC: [540, 960], uHeatAmt: 0, uHeat: [0, 0, 0, 0], uC: [540, 1150], uRT: 0, uSeedX: 590, uGrain: 0.022, uVig: 0.24, uFade: 0 };
    let useB = false;
    clear(A);
    clear(O);
    if (t < C.stones.zoomOut[0]) {
      night(A);
      band(A);
    } else if (t < C.steam.dissolve[1]) {
      stack(A);
      if (t >= C.steam.dissolve[0]) {
        clear(B);
        aroma(B);
        useB = true;
        U.uMode = 1;
        U.uProg = inOutSine(prog(t, C.steam.dissolve[0], C.steam.dissolve[1]));
        leak(A, 590, 700, 800, 0.25 * env(t, C.steam.dissolve[0], C.steam.dissolve[0] + 0.4, C.steam.dissolve[1] - 0.3, C.steam.dissolve[1]));
      }
    } else if (t < C.scalp.impact) {
      aroma(A);
    } else if (t < C.scalp.impact + 0.95) {
      aroma(A);
      clear(B);
      scalp(B);
      useB = true;
      U.uMode = 2;
      U.uRT = t - C.scalp.impact;
      U.uC = [540, 1150];
    } else if (t < C.split.open[0]) {
      scalp(A);
    } else if (t < C.split.open[1]) {
      split(A);
    } else if (t < C.portal.push[1]) {
      studio(A);
      // the last instant of the push dissolves into the end card, so the
      // blurred mirror frame never pops at the cut
      const x = smooth(prog(t, C.portal.push[1] - 0.18, C.portal.push[1]));
      if (x > 0) {
        A.save();
        A.globalAlpha = x;
        endCard(A);
        A.restore();
      }
    } else {
      endCard(A);
    }
    overlay(O);
    U.uFade = 1 - smooth(prog(t, 0, 0.22));
    // the frame itself relaxes: a tight vignette opens as the shoulders drop
    if (t < C.morph[1]) U.uVig = lerp(0.42, 0.24, smooth(prog(t, C.hook.release, C.hook.release + 1.2)));
    if (t >= C.portal.push[1]) U.uVig = 0.16;
    return { U, useB };
  }

  return { duration: C.duration, render };
}
