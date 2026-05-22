"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Auth-aware footer link. Mirrors the Nav pattern: fetch /api/me on mount
// and render nothing until it resolves, so we never flash the wrong state.
//   - signed out → "Already a client? Sign in" → /login
//   - signed in  → "View your account"        → /account
export default function FooterAccountLink() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data: { user?: { id: string } | null }) => {
        if (!cancelled) setSignedIn(!!data.user);
      })
      .catch(() => {
        if (!cancelled) setSignedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (signedIn === null) return null;

  return (
    <li className="footer-signin">
      {signedIn ? (
        <Link href="/account">View your account</Link>
      ) : (
        <>
          Already a client? <Link href="/login">Sign in</Link>
        </>
      )}
    </li>
  );
}
