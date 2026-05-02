"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "cookie-consent-accepted";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage may be blocked (private mode, browser settings).
      // Fail open: show the banner once per session.
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function accept() {
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // ignore — banner will reappear next visit
    }
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Cookies notice"
      className="cookie-banner"
    >
      <p className="cookie-banner-text">
        We use essential cookies to make our booking system work. We don&apos;t
        track you or use advertising cookies.{" "}
        <Link href="/legal/cookies" className="cookie-banner-link">
          Read our cookies policy
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={accept}
        className="cookie-banner-btn"
        aria-label="Acknowledge essential cookies notice"
      >
        Got it
      </button>
    </div>
  );
}
