"use client";

import { useEffect, useState } from "react";

type CustomerDetails = {
  id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  gender: string | null;
};

type MeResponse = {
  user: { id: string; email: string } | null;
  customer: CustomerDetails | null;
};

export default function SignInPrompt() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as MeResponse;
        if (cancelled) return;
        setMe(data);
        if (data.customer) {
          window.dispatchEvent(
            new CustomEvent("tps:customer-details", { detail: data.customer })
          );
        }
      } catch {
        if (!cancelled) setMe({ user: null, customer: null });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      window.location.reload();
    } finally {
      setSigningOut(false);
    }
  }

  if (loading || !me) return null;

  if (me.user) {
    const firstName =
      me.customer?.first_name ||
      (me.customer?.full_name ? me.customer.full_name.split(" ")[0] : null) ||
      me.user.email.split("@")[0];
    return (
      <div className="signin-welcome">
        <span className="greeting">Welcome back, {firstName}.</span>
        <button
          type="button"
          className="signout-link"
          onClick={signOut}
          disabled={signingOut}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    );
  }

  return (
    <div className="signin-prompt">
      <div className="head">Already a client?</div>
      <div className="sub">
        Sign in for faster booking — your details and past consultation will be
        remembered.
      </div>
      <div className="actions">
        <a href="/login?next=%2F%23booking" className="signin-link">
          Sign in
        </a>
      </div>
    </div>
  );
}
