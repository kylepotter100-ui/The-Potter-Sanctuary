// Bootstrap: load fonts, plates and data, then expose renderFrame(t).
//   index.html?t=5.2   draw one still
//   index.html?play    real-time preview loop

import { Compositor } from "./lib/gl.js";
import { createFilm } from "./film.js";

const W = 1080, H = 1920;
const params = new URLSearchParams(location.search);

async function loadImage(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

async function boot() {
  const faces = [];
  for (const w of [300, 400, 500]) {
    faces.push(`${w} 64px "Cormorant Garamond"`, `italic ${w} 64px "Cormorant Garamond"`);
  }
  for (const w of [400, 500]) faces.push(`${w} 32px "Lora"`, `italic ${w} 32px "Lora"`);
  await Promise.all(faces.map((f) => document.fonts.load(f)));
  await document.fonts.ready;

  // plates, plus foreground/background depth layers for 2.5D parallax
  const files = { "band-stones": "band-stones.jpg" };
  for (const n of ["stack", "aroma", "scalp", "studio"]) {
    files[`${n}-bg`] = `${n}-bg.jpg`;
    files[`${n}-fg`] = `${n}-fg.webp`;
  }
  const photos = Object.fromEntries(
    await Promise.all(Object.entries(files).map(async ([k, f]) => [k, await loadImage(`../assets/photos/${f}`)]))
  );
  const logo = await (await fetch("../assets/logo-strokes.json")).json();
  const cues = await (await fetch("./cues.json")).json();

  const out = document.getElementById("out");
  out.width = W;
  out.height = H;
  const mk = (w = W, h = H) => Object.assign(document.createElement("canvas"), { width: w, height: h });
  const layers = { A: mk(), B: mk(), O: mk(), tmp: mk(), mask: mk(W / 2, H / 2), scratch: mk(W / 2, H / 2) };
  // Software-backed 2D canvases: headless Chromium's GPU (SwiftShader) 2D
  // path drops full-canvas clears between frames, so frames bleed together.
  // The first getContext call fixes the attributes for every later one.
  for (const c of Object.values(layers)) c.getContext("2d", { willReadFrequently: true });
  const comp = new Compositor(out);
  const film = createFilm({ W, H, photos, logo, cues, layers });

  window.DURATION = film.duration;
  window.renderFrame = (t, frame = Math.round(t * 60)) => {
    const { U, useB } = film.render(t);
    comp.upload("uA", layers.A);
    if (useB) comp.upload("uB", layers.B);
    comp.upload("uO", layers.O);
    comp.draw({ uRes: [W, H], uTime: t, uFrame: frame, ...U });
    return true;
  };
  window.__ready = true;

  if (params.has("t")) window.renderFrame(parseFloat(params.get("t")));
  if (params.has("play")) {
    document.body.classList.add("preview");
    const t0 = performance.now();
    const loop = () => {
      window.renderFrame(((performance.now() - t0) / 1000) % film.duration);
      requestAnimationFrame(loop);
    };
    loop();
  }
}

boot().catch((e) => {
  window.__error = String((e && e.stack) || e);
  console.error(e);
});
