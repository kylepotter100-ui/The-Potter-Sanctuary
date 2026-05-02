"use client";

import { useEffect } from "react";

// Smooth-scroll to the element matching the URL hash on mount. Used on the
// homepage so a magic-link sign-in that lands at /#booking glides down to
// the booking calendar instead of dumping the user at the top.
export default function HashScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    const id = hash.slice(1);
    // Defer one frame so any layout shifts (font loading, hydration) settle
    // before we measure the target.
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  return null;
}
