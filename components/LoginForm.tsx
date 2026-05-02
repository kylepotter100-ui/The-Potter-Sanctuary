"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  next: string;
};

type Step = "email" | "code";

// Two-step sign-in flow:
//   1. Email — request a one-time code (Supabase sends both a 6-digit
//      token and a magic link in the same email).
//   2. Code  — type the 6-digit token to sign in. This avoids the PKCE
//      cookie-mismatch problem when mobile users open the magic link
//      in their email client's in-app browser instead of the browser
//      that requested it.
//
// The magic link still works as a backup whenever cookies survive the
// round-trip (typically desktop). Either path lands the user at `next`.
export default function LoginForm({ next }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function requestCode(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResent(false);
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (otpError) throw otpError;
      setStep("code");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    const token = code.trim();
    if (!/^\d{6}$/.test(token)) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (verifyErr) throw verifyErr;
      // Sign-in succeeded — land the user where they wanted to go.
      const safeNext =
        next.startsWith("/") && !next.startsWith("//") ? next : "/account";
      router.replace(safeNext);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't verify that code. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    await requestCode();
    if (!error) setResent(true);
  }

  if (step === "code") {
    return (
      <form className="login-form" onSubmit={verifyCode} noValidate>
        <p className="login-hint">
          We&apos;ve sent a 6-digit code to <strong>{email}</strong>. Enter it
          below to sign in.
        </p>
        <label htmlFor="login-code">Sign-in code</label>
        <input
          id="login-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          required
          autoFocus
          style={{
            letterSpacing: "0.4em",
            fontSize: "20px",
            textAlign: "center",
          }}
        />
        {error && (
          <div role="alert" className="login-error">
            {error}
          </div>
        )}
        <button type="submit" className="login-btn" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <p className="login-hint" style={{ marginTop: 14 }}>
          Or tap the magic link in the same email — both work.
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
            fontSize: 13,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--sage-deep, #6E8068)",
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit",
            }}
          >
            ← Use a different email
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={submitting}
            style={{
              background: "none",
              border: "none",
              color: "var(--sage-deep, #6E8068)",
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit",
            }}
          >
            {resent ? "Sent again ✓" : "Resend code"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="login-form" onSubmit={requestCode} noValidate>
      <label htmlFor="login-email">Email</label>
      <input
        id="login-email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      {error && (
        <div role="alert" className="login-error">
          {error}
        </div>
      )}
      <button type="submit" className="login-btn" disabled={submitting}>
        {submitting ? "Sending…" : "Send my code"}
      </button>
      <p className="login-hint" style={{ marginTop: 12 }}>
        We&apos;ll email you a one-time code and a sign-in link. Either works.
      </p>
    </form>
  );
}
