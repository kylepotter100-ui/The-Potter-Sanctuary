"use client";

import { useEffect, useRef } from "react";

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

    const segs = svg.querySelectorAll<SVGPathElement>(".seg");
    segs.forEach((p) => {
      const len = p.getTotalLength();
      p.style.setProperty("--len", String(len));
    });

    const totalDrawMs = 2400;
    const startNibMs = 250;

    const t1 = window.setTimeout(() => intro.classList.add("drawing"), 250);

    const nibStart = performance.now() + startNibMs;
    const nibEnd = nibStart + totalDrawMs;
    let raf = 0;

    const stepNib = (now: number) => {
      if (now < nibStart) {
        raf = requestAnimationFrame(stepNib);
        return;
      }
      if (now > nibEnd) {
        nib.style.opacity = "0";
        return;
      }
      const t = (now - nibStart) / totalDrawMs;
      nib.style.opacity = "1";
      const svgRect = svg.getBoundingClientRect();
      const stage = svg.parentElement;
      if (!stage) return;
      const stageRect = stage.getBoundingClientRect();
      const sx = svgRect.left - stageRect.left + svgRect.width * 0.5;
      const sy = svgRect.top - stageRect.top + svgRect.height * 0.96;
      const ex = svgRect.left - stageRect.left + svgRect.width * 0.5;
      const ey = svgRect.top - stageRect.top + svgRect.height * 0.36;
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = sx + (ex - sx) * e + Math.sin(t * Math.PI * 3) * 4;
      const y = sy + (ey - sy) * e;
      nib.style.left = `${x}px`;
      nib.style.top = `${y}px`;
      raf = requestAnimationFrame(stepNib);
    };
    raf = requestAnimationFrame(stepNib);

    const t2 = window.setTimeout(
      () => intro.classList.add("titles"),
      250 + totalDrawMs + 200
    );

    const t3 = window.setTimeout(() => {
      intro.classList.add("done");
      const page = document.getElementById("page");
      if (page) page.classList.add("show");
      document.body.classList.remove("locked");
    }, 5000);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
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
