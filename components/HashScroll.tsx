"use client";

import { useEffect } from "react";

// Smooth-scrolls to a target element if the URL specifies one. Supports
// two sources, in priority order:
//
//   1. ?scrollTo=<id>  — used by the magic-link / login flow. Lives in the
//      query string so the value survives Supabase's redirect chain (a
//      hash fragment doesn't, because Supabase decodes URL-encoded `#`
//      and the appended `&code=` ends up as part of the fragment).
//   2. #<id> — plain anchor links (e.g. /#booking).
//
// After acting on `?scrollTo=`, we strip it from the URL with
// history.replaceState so a refresh doesn't re-trigger the scroll.
export default function HashScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const queryTarget = url.searchParams.get("scrollTo");
    const hashTarget =
      window.location.hash && window.location.hash.length > 1
        ? window.location.hash.slice(1)
        : null;

    const id = queryTarget || hashTarget;
    if (!id) return;

    if (queryTarget) {
      url.searchParams.delete("scrollTo");
      const clean =
        url.pathname +
        (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") +
        url.hash;
      window.history.replaceState({}, "", clean);
    }

    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  return null;
}
