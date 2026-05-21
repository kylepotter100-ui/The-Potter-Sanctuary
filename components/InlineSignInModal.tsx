"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  initialEmail: string;
  onClose: () => void;
  onSignedIn: () => void;
};

type Step = "email" | "code";

const RESEND_COOLDOWN_SECONDS = 30;

// OTP sign-in inside a modal so the customer keeps their in-progress
// booking state (date / time / treatment) instead of navigating away to
// /login. Mirrors the LoginForm flow: request a 6-digit code, then verify.
export default function InlineSignInModal({
  initialEmail,
  onClose,
  onSignedIn,
}: Props) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // ESC closes; lock body scroll while open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the modal for keyboard users.
    requestAnimationFrame(() => {
      cardRef.current?.querySelector<HTMLElement>("input,button")?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, submitting]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  async function sendCode(): Promise<boolean> {
    setError(null);
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address.");
      return false;
    }
    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (otpError) throw otpError;
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (await sendCode()) {
      setStep("code");
      setCode("");
      setResendIn(RESEND_COOLDOWN_SECONDS);
    }
  }

  async function onResend() {
    if (resendIn > 0) return;
    if (await sendCode()) setResendIn(RESEND_COOLDOWN_SECONDS);
  }

  async function onCodeSubmit(e: React.FormEvent) {
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
      if (verifyErr) {
        setError(
          /expired|invalid/i.test(verifyErr.message || "")
            ? "That code is invalid or has expired. Please request a new one."
            : verifyErr.message || "We couldn't verify that code."
        );
        return;
      }
      onSignedIn();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "We couldn't verify that code."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inline-signin-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="modal-card inline-signin-card" ref={cardRef}>
        <div className="inline-signin-header">
          <span>The Potter Sanctuary</span>
          <button
            type="button"
            className="inline-signin-close"
            aria-label="Close sign in"
            onClick={onClose}
            disabled={submitting}
          >
            ×
          </button>
        </div>

        {step === "email" ? (
          <form className="login-form" onSubmit={onEmailSubmit} noValidate>
            <h3 id="inline-signin-title" className="modal-title">
              Sign in for faster booking
            </h3>
            <p className="login-hint">
              We&apos;ll email you a 6-digit code. Your booking is kept while
              you sign in.
            </p>
            <label htmlFor="inline-email">Email</label>
            <input
              id="inline-email"
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
          </form>
        ) : (
          <form className="login-form" onSubmit={onCodeSubmit} noValidate>
            <h3 id="inline-signin-title" className="modal-title">
              Enter your code
            </h3>
            <p className="login-hint">
              We&apos;ve sent a 6-digit code to <strong>{email}</strong>.
            </p>
            <label htmlFor="inline-code">Sign-in code</label>
            <input
              id="inline-code"
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
              className="login-code-input"
            />
            {error && (
              <div role="alert" className="login-error">
                {error}
              </div>
            )}
            <button type="submit" className="login-btn" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
            <div className="login-step-actions">
              <button
                type="button"
                className="login-link-btn"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
              >
                ← Use a different email
              </button>
              <button
                type="button"
                className="login-link-btn"
                onClick={onResend}
                disabled={submitting || resendIn > 0}
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
