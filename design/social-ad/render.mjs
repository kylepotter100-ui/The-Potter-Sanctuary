// Frame renderer: serves the repo over localhost (WebGL refuses file://
// textures), drives headless Chromium, and captures every frame.
//
//   node render.mjs stills  --times 0.5,1.6,4.8 --out DIR [--page index.html]
//   node render.mjs frames  --fps 60 --out DIR [--from 0 --to 30] [--workers 4]
//
// Playwright is resolved from the global install the container ships with;
// set PLAYWRIGHT_MODULE to point elsewhere.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const pwPath = process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.mjs";
const { chromium } = await import(pathToFileURL(pwPath).href);

const [mode, ...rest] = process.argv.slice(2);
const arg = (k, d) => {
  const i = rest.indexOf(`--${k}`);
  return i >= 0 ? rest[i + 1] : d;
};
const W = 1080, H = 1920;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/design/social-ad/src/${arg("page", "index.html")}`;

async function openPage() {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox"] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on("console", (m) => m.type() === "error" && console.error("[page]", m.text()));
  page.on("pageerror", (e) => console.error("[page]", e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 60000 });
  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error(err);
  const cdp = await page.context().newCDPSession(page);
  const shot = async (t, frame) => {
    await page.evaluate(([tt, f]) => window.renderFrame(tt, f), [t, frame]);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    return Buffer.from(data, "base64");
  };
  return { browser, page, shot };
}

const out = path.resolve(arg("out", path.join(here, "out", "frames")));
fs.mkdirSync(out, { recursive: true });

if (mode === "stills") {
  const times = arg("times", "1").split(",").map(Number);
  const { browser, shot } = await openPage();
  for (const t of times) {
    const t0 = Date.now();
    fs.writeFileSync(path.join(out, `t${t.toFixed(2).padStart(6, "0")}.png`), await shot(t, Math.round(t * 60)));
    console.log(`t=${t.toFixed(2)}  ${Date.now() - t0}ms`);
  }
  await browser.close();
} else if (mode === "frames") {
  const fps = Number(arg("fps", 60));
  const from = Number(arg("from", 0));
  const probe = await openPage();
  const duration = Number(arg("to", await probe.page.evaluate(() => window.DURATION)));
  await probe.browser.close();
  const first = Math.round(from * fps), last = Math.round(duration * fps) - 1;
  const workers = Number(arg("workers", 4));
  const skip = rest.includes("--resume");
  let next = first, done = 0;
  const t0 = Date.now();
  // Workers take runs of consecutive frames, so per-page caches (the 3D
  // imagery renders at 30 fps) are reused across neighbouring frames.
  const CHUNK = 24;
  await Promise.all(
    Array.from({ length: workers }, async () => {
      const { browser, shot } = await openPage();
      for (;;) {
        const start = next;
        next += CHUNK;
        if (start > last) break;
        for (let f = start; f < Math.min(start + CHUNK, last + 1); f++) {
          const file = path.join(out, `${String(f).padStart(5, "0")}.png`);
          if (skip && fs.existsSync(file)) continue;
          fs.writeFileSync(file, await shot(f / fps, f));
          if (++done % 60 === 0) {
            const rate = done / ((Date.now() - t0) / 1000);
            console.log(`${done}/${last - first + 1} frames  ${rate.toFixed(2)} fps  eta ${((last - first + 1 - done) / rate).toFixed(0)}s`);
          }
        }
      }
      await browser.close();
    })
  );
  console.log(`rendered ${done} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${out}`);
} else {
  console.error("usage: node render.mjs stills|frames [options]");
  process.exitCode = 1;
}
server.close();
