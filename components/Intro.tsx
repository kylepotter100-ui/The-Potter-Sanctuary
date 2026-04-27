"use client";

import { useEffect, useRef } from "react";

// Strokes ordered bottom-to-top so the pen walks up the logo:
// ground leaves → stem → spathe → back petals → front petals → trumpet → ruffles → stamens → anthers.
const SEGMENTS = [
  "M152 380 C 130 360, 100 350, 70 360 C 56 365, 60 380, 78 380 C 110 382, 134 384, 152 384 Z",
  "M152 380 C 174 360, 206 348, 234 358 C 248 363, 244 380, 226 380 C 196 384, 172 384, 152 384 Z",
  "M152 384 C 144 360, 142 336, 148 312 C 150 320, 154 348, 156 384 Z",
  "M152 384 C 152 340, 152 280, 156 220",
  "M150 222 C 156 212, 168 212, 172 220 C 168 228, 156 230, 150 224 Z",
  "M156 150 C 144 110, 144 80, 156 56 C 168 80, 168 110, 156 150 Z",
  "M156 150 C 124 130, 102 102, 96 76 C 110 78, 138 102, 156 150 Z",
  "M156 150 C 188 130, 210 102, 216 76 C 202 78, 174 102, 156 150 Z",
  "M156 150 C 122 158, 92 156, 70 142 C 88 130, 122 134, 156 150 Z",
  "M156 150 C 190 158, 220 156, 242 142 C 224 130, 190 134, 156 150 Z",
  "M156 150 C 138 188, 138 214, 150 222 C 162 214, 174 188, 156 150 Z",
  "M138 138 C 138 118, 178 116, 182 134 C 184 156, 178 174, 158 176 C 140 176, 134 158, 138 138 Z",
  "M140 130 C 148 122, 158 120, 168 124 C 175 127, 182 130, 184 134",
  "M142 134 C 150 132, 162 130, 174 132",
  "M152 142 C 152 152, 152 160, 154 168",
  "M158 140 C 160 152, 160 160, 160 168",
  "M164 144 C 166 154, 166 160, 166 168",
  "M154 168 L 154 169",
  "M160 168 L 160 169",
  "M166 168 L 166 169",
];

// The total intro budget — page reveals after this elapses.
const TOTAL_MS = 5000;
// When the pen starts moving, relative to mount.
const START_DELAY_MS = 200;
// How long the pen takes to walk the entire logo.
const DRAW_MS = 3500;
// When the title fades in.
const TITLE_AT_MS = START_DELAY_MS + DRAW_MS + 250;

// easeInOutCubic — calm in, calm out, with a steady middle stretch.
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function Intro() {
  const introRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nibRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const intro = introRef.current;
    const svg = svgRef.current;
    const nib = nibRef.current;
    if (!intro || !svg || !nib) return;

    document.body.classList.add("locked");

    const segs = Array.from(svg.querySelectorAll<SVGPathElement>(".seg"));
    const lens = segs.map((p) => p.getTotalLength());
    const total = lens.reduce((sum, l) => sum + l, 0);

    // Hide every segment up-front so nothing flashes before the first frame.
    segs.forEach((p, i) => {
      p.style.strokeDasharray = String(lens[i]);
      p.style.strokeDashoffset = String(lens[i]);
    });

    let raf = 0;
    let originTs: number | null = null;

    function placeNib(seg: SVGPathElement, distInSeg: number) {
      if (!svg || !nib) return;
      const stage = svg.parentElement;
      if (!stage) return;
      const pt = seg.getPointAtLength(distInSeg);
      const svgRect = svg.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      // viewBox is 0 0 300 420 — scale into the rendered svg box.
      const x =
        svgRect.left - stageRect.left + (pt.x / 300) * svgRect.width;
      const y =
        svgRect.top - stageRect.top + (pt.y / 420) * svgRect.height;
      nib.style.left = `${x}px`;
      nib.style.top = `${y}px`;
      nib.style.opacity = "1";
    }

    function tick(now: number) {
      if (originTs === null) originTs = now;
      const elapsed = now - originTs - START_DELAY_MS;

      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const t = Math.min(1, elapsed / DRAW_MS);
      const distance = ease(t) * total;

      let cumulative = 0;
      let activeIdx = -1;
      let activeDist = 0;
      for (let i = 0; i < segs.length; i++) {
        const len = lens[i];
        if (distance <= cumulative) {
          segs[i].style.strokeDashoffset = String(len);
        } else if (distance >= cumulative + len) {
          segs[i].style.strokeDashoffset = "0";
        } else {
          const local = distance - cumulative;
          segs[i].style.strokeDashoffset = String(len - local);
          activeIdx = i;
          activeDist = local;
        }
        cumulative += len;
      }

      if (activeIdx >= 0) {
        placeNib(segs[activeIdx], activeDist);
      } else if (t >= 1 && nib) {
        nib.style.opacity = "0";
      }

      if (t < 1) {
        raf = requestAnimationFrame(tick);
      }
    }
    raf = requestAnimationFrame(tick);

    const titleTimer = window.setTimeout(
      () => intro.classList.add("titles"),
      TITLE_AT_MS
    );

    const doneTimer = window.setTimeout(() => {
      intro.classList.add("done");
      const page = document.getElementById("page");
      if (page) page.classList.add("show");
      document.body.classList.remove("locked");
    }, TOTAL_MS);

    return () => {
      window.clearTimeout(titleTimer);
      window.clearTimeout(doneTimer);
      cancelAnimationFrame(raf);
      document.body.classList.remove("locked");
    };
  }, []);

  return (
    <div id="intro" ref={introRef} aria-hidden="true">
      <div className="intro-stage">
        <svg
          className="intro-svg"
          ref={svgRef}
          viewBox="0 0 300 420"
          xmlns="http://www.w3.org/2000/svg"
        >
          {SEGMENTS.map((d, i) => (
            <path key={i} className="draw seg" d={d} />
          ))}
        </svg>
        <div className="nib" ref={nibRef} />
        <div className="intro-title">
          <span className="t1 serif">
            <em>The Potter</em>
          </span>
          <span className="t2">Sanctuary</span>
        </div>
      </div>
    </div>
  );
}
