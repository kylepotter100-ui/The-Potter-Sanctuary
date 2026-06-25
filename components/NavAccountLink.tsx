"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Auth-aware header link (mirrors FooterAccountLink). Fetches /api/me on mount
// and renders nothing until it resolves so we never flash the wrong state.
//   - signed in OR has booked before  → "Account" → /account
//   - otherwise                        → "Sign in" → /login
// The "has booked before" hint is the non-sensitive `ps_account` cookie set by
// the booking success screen, so a customer who just booked (but isn't signed
// in yet — the site is OTP-gated) still sees "Account". Clicking it lands on
// /account, which redirects to /login?next=/account when there's no session.
function hasAccountCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith("ps_account=1"));
}

export default function NavAccountLink({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [hasAccount, setHasAccount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHasAccount(hasAccountCookie());
    // Live update when a booking completes on the same page (no reload).
    const onChanged = () => setHasAccount(hasAccountCookie());
    window.addEventListener("ps-account-changed", onChanged);
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
      window.removeEventListener("ps-account-changed", onChanged);
    };
  }, []);

  // Wait for the /api/me check before rendering so we never flash the wrong
  // label — unless the cookie already tells us this browser has an account.
  if (signedIn === null && !hasAccount) return null;

  const showAccount = signedIn === true || hasAccount;

  return (
    <Link
      href={showAccount ? "/account" : "/login"}
      className={className}
      onClick={onNavigate}
    >
      {showAccount ? "Account" : "Sign in"}
    </Link>
  );
}
