"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Auth-aware header link (mirrors FooterAccountLink). Fetches /api/me on mount
// and renders nothing until it resolves so we never flash the wrong state.
//   - signed out → "Sign in"  → /login
//   - signed in  → "Account"  → /account
export default function NavAccountLink({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d: { user?: { id: string } | null }) => {
        if (!cancelled) setSignedIn(!!d.user);
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
    <Link
      href={signedIn ? "/account" : "/login"}
      className={className}
      onClick={onNavigate}
    >
      {signedIn ? "Account" : "Sign in"}
    </Link>
  );
}
