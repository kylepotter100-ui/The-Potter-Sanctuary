// Bootstrap: load fonts and data, build the rendered imagery, expose renderFrame(t).
//   index.html?t=5.2   draw one still
//   index.html?play    real-time preview loop

import { Compositor } from "./lib/gl.js";
import { createFilm } from "./film.js";
import { Beauty3D } from "./beauty3d.js";
import { makeLeafGobo } from "./leaves.js";

const W = 1080, H = 1920;
const params = new URLSearchParams(location.search);

async function boot() {
  const faces = [];
  for (const w of [300, 400, 500]) {
    faces.push(`${w} 64px "Cormorant Garamond"`, `italic ${w} 64px "Cormorant Garamond"`);
  }
  for (const w of [400, 500]) faces.push(`${w} 32px "Lora"`, `italic ${w} 32px "Lora"`);
  await Promise.all(faces.map((f) => document.fonts.load(f)));
  await document.fonts.ready;

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
  // rendered imagery: leaf shadows, and the 3D set at 0.75× (soft-lit, so
  // the upscale is invisible and it renders in about half the time)
  const gobo = makeLeafGobo();
  const scale3d = 0.75;
  const b3 = new Beauty3D(Math.round(W * scale3d), Math.round(H * scale3d), gobo);
  const film = createFilm({ W, H, logo, cues, layers, b3, gobo, scale3d });

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
