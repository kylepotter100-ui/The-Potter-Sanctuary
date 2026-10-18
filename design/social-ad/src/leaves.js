// Leaf-shadow gobo: sunlight falling through eucalyptus branches.
// White = lit, dark = leaf shadow. Tileable, in two depths (soft far
// branches, crisper near ones). Used as a soft multiply over the sage
// screens and projected along the key light inside the 3D set.

import { rng } from "./lib/math.js";

/** One depth of branches, black on transparent, blurred, seamless. */
function branchLayer(size, seed, count, blur) {
  const c = Object.assign(document.createElement("canvas"), { width: size, height: size });
  const g = c.getContext("2d", { willReadFrequently: true });
  const r = rng(seed);
  // draw each primitive nine times so the tile wraps seamlessly
  const wrap = (fn) => {
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      g.save();
      g.translate(dx, dy);
      fn();
      g.restore();
    }
  };
  const leaf = (x, y, ang, L, Wd) =>
    wrap(() => {
      g.translate(x, y);
      g.rotate(ang);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(L * 0.42, -Wd, L, Wd * 0.15);
      g.quadraticCurveTo(L * 0.5, Wd * 0.85, 0, 0);
      g.fill();
    });
  const stem = (x0, y0, x1, y1, w) =>
    wrap(() => {
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    });
  g.fillStyle = "#000";
  g.strokeStyle = "#000";
  g.lineCap = "round";
  for (let b = 0; b < count; b++) {
    let x = r() * size, y = r() * size;
    let a = 0.35 + (r() - 0.5) * 0.9 + (b % 2 ? Math.PI : 0);
    const steps = 30 + Math.floor(r() * 16);
    const bend = (r() - 0.5) * 0.05;
    let side = r() < 0.5 ? -1 : 1;
    for (let i = 0; i < steps; i++) {
      const seg = 22 + r() * 6;
      const nx = x + Math.cos(a) * seg, ny = y + Math.sin(a) * seg;
      stem(x, y, nx, ny, 3.2 * (1 - (i / steps) * 0.7));
      // alternate leaves, hanging at varied angles, with natural gaps
      if (i % 2 === 1 && r() > 0.12) {
        side = -side;
        const L = 62 + r() * 58;
        leaf(nx, ny, a + side * (0.5 + r() * 0.65) + 0.25, L, L * (0.2 + r() * 0.08));
      }
      // now and then a side twig carrying a few smaller leaves
      if (i % 9 === 4 && r() > 0.4) {
        let tx = nx, ty = ny, ta = a + (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.3);
        for (let k = 0; k < 4; k++) {
          const ux = tx + Math.cos(ta) * 20, uy = ty + Math.sin(ta) * 20;
          stem(tx, ty, ux, uy, 1.8);
          leaf(ux, uy, ta + (k % 2 ? 0.7 : -0.7), 46 + r() * 30, 11 + r() * 5);
          tx = ux;
          ty = uy;
          ta += (r() - 0.5) * 0.4;
        }
      }
      x = nx;
      y = ny;
      a += bend + (r() - 0.5) * 0.08;
    }
  }
  // blur a 3×3 tiling so the softened edges wrap too
  const big = Object.assign(document.createElement("canvas"), { width: size * 3, height: size * 3 });
  const bg = big.getContext("2d", { willReadFrequently: true });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) bg.drawImage(c, i * size, j * size);
  const out = Object.assign(document.createElement("canvas"), { width: size, height: size });
  const o = out.getContext("2d", { willReadFrequently: true });
  o.filter = `blur(${blur}px)`;
  o.drawImage(big, -size, -size);
  return out;
}

export function makeLeafGobo(size = 1024, seed = 11) {
  const c = Object.assign(document.createElement("canvas"), { width: size, height: size });
  const g = c.getContext("2d", { willReadFrequently: true });
  g.fillStyle = "#fff";
  g.fillRect(0, 0, size, size);
  g.globalAlpha = 0.55;
  g.drawImage(branchLayer(size, seed, 3, 18), 0, 0);
  g.globalAlpha = 1;
  g.drawImage(branchLayer(size, seed + 101, 3, 6), 0, 0);
  return c;
}
