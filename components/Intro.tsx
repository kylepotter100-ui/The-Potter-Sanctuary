"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

// Timeline (ms from mount):
// 0     intro overlay paints with logo + title hidden
// 100   logo starts fading in (1000ms)
// 1300  title starts fading in (700ms)
// 2800  intro starts fading out, page reveals (1000ms)
// 3800  intro removed from view
const LOGO_AT = 100;
const TITLE_AT = 1300;
const DONE_AT = 2800;

export default function Intro() {
  const introRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const intro = introRef.current;
    if (!intro) return;

    document.body.classList.add("locked");

    const logoTimer = window.setTimeout(
      () => intro.classList.add("logo-in"),
      LOGO_AT
    );
    const titleTimer = window.setTimeout(
      () => intro.classList.add("titles"),
      TITLE_AT
    );
    const doneTimer = window.setTimeout(() => {
      intro.classList.add("done");
      const page = document.getElementById("page");
      if (page) page.classList.add("show");
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
  );
}
