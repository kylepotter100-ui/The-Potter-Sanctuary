"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

// Timeline (ms from mount) — first homepage visit of a browser session only:
// 0     intro overlay paints with logo + title hidden
// 100   logo starts fading in
// 700   title starts fading in
// 1600  intro fades out, page reveals
//
// Skipped entirely (page shown at once) when:
//   - the intro already played this browser session (sessionStorage), e.g.
//     coming back to the homepage from a treatment page;
//   - the visitor prefers reduced motion;
//   - JavaScript is off (the <noscript> style below) — previously the page
//     stayed invisible behind the overlay with JS disabled.
const LOGO_AT = 100;
const TITLE_AT = 700;
const DONE_AT = 1600;
const SEEN_KEY = "ps_intro_seen";

// Runs synchronously while the HTML is parsed — before first paint — so a
// skipped intro never flashes. Inline scripts are permitted by the CSP.
const PREFLIGHT = `try{if(sessionStorage.getItem("${SEEN_KEY}")||matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.classList.add("intro-skip")}}catch(e){}`;

export default function Intro() {
  const introRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const intro = introRef.current;
    const page = document.getElementById("page");
    if (!intro) return;

    if (document.documentElement.classList.contains("intro-skip")) {
      intro.classList.add("done");
      page?.classList.add("show");
      return;
    }

    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode: intro just plays again next time */
    }
    document.body.classList.add("locked");

    const logoTimer = window.setTimeout(() => intro.classList.add("logo-in"), LOGO_AT);
    const titleTimer = window.setTimeout(() => intro.classList.add("titles"), TITLE_AT);
    const doneTimer = window.setTimeout(() => {
      intro.classList.add("done");
      page?.classList.add("show");
      document.body.classList.remove("locked");
    }, DONE_AT);

    return () => {
      window.clearTimeout(logoTimer);
      window.clearTimeout(titleTimer);
      window.clearTimeout(doneTimer);
      document.body.classList.remove("locked");
    };
  }, []);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PREFLIGHT }} />
      <noscript>
        <style>{`#intro{display:none}.page{opacity:1}`}</style>
      </noscript>
      <div id="intro" ref={introRef} aria-hidden="true">
        <div className="intro-stage">
          <div className="intro-logo">
            <Image
              src="/sanctuary-logo.png"
              alt="The Potter Sanctuary daffodil emblem"
              width={272}
              height={382}
              priority
              sizes="(max-width: 600px) 60vw, 280px"
            />
          </div>
          <div className="intro-title">
            <span className="t1 serif">
              <em>The Potter</em>
            </span>
            <span className="t2">Sanctuary</span>
          </div>
        </div>
      </div>
    </>
  );
}
