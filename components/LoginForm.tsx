"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  next: string;
};

type Step = "email" | "code";

const RESEND_COOLDOWN_SECONDS = 30;

// OTP-only sign-in flow. Email + 6-digit code. No URL-based redirect
// path; cookie state from the requesting browser is irrelevant, which
// is what makes this reliable on mobile.
//
// Sign-in is gated to EXISTING customers: we check /api/customer/check
// before sending a code, and pass shouldCreateUser:false so Supabase
// never auto-creates an auth user for a stranger.
//
// Supabase email-template requirement: the template that fires for
// `signInWithOtp` MUST include `{{ .Token }}` so the customer sees a
// 6-digit code.
export default function LoginForm({ next }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cooldown countdown for the resend button.
  useEffect(() => {
    if (resendIn <= 0) {
      if (cooldownTimer.current) {
        clearInterval(cooldownTimer.current);
        cooldownTimer.current = null;
      }
      return;
    }
    if (!cooldownTimer.current) {
      cooldownTimer.current = setInterval(() => {
        setResendIn((s) => Math.max(0, s - 1));
      }, 1000);
    }
    return () => {
      if (cooldownTimer.current) {
        clearInterval(cooldownTimer.current);
        cooldownTimer.current = null;
      }
    };
  }, [resendIn]);

  function startCooldown() {
    setResendIn(RESEND_COOLDOWN_SECONDS);
  }

  async function sendCode() {
    setError(null);
    setNoAccount(false);
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address.");
      return false;
    }
    setSubmitting(true);
    try {
      // Gate: only existing customers (who have booked before) can sign in.
      const checkRes = await fetch("/api/customer/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const checkData = (await checkRes
        .json()
        .catch(() => ({ exists: false }))) as { exists?: boolean };
      if (!checkData.exists) {
        setNoAccount(true);
        return false;
      }

      const supabase = getSupabaseBrowserClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Never auto-create an auth user for a non-customer.
          shouldCreateUser: false,
        },
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
    const ok = await sendCode();
    if (ok) {
      setStep("code");
      setCode("");
      startCooldown();
    }
  }

  async function onResend() {
    if (resendIn > 0) return;
    const ok = await sendCode();
    if (ok) startCooldown();
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
        const msg = verifyErr.message || "";
        if (/expired/i.test(msg) || /invalid/i.test(msg)) {
          setError(
            "That code is invalid or has expired. Please request a new one."
          );
        } else {
          setError(msg || "We couldn't verify that code. Please try again.");
        }
        return;
      }
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

  if (step === "code") {
    return (
      <form className="login-form" onSubmit={onCodeSubmit} noValidate>
        <h2 className="login-step-heading">Enter your code</h2>
        <p className="login-hint">
          We&apos;ve sent a 6-digit code to <strong>{email}</strong>. Check
          your inbox and enter the code below.
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
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="login-link-btn"
          >
            ← Use a different email
          </button>
          <button
            type="button"
            onClick={onResend}
            disabled={submitting || resendIn > 0}
            className="login-link-btn"
          >
            {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
          </button>
        </div>
        <p className="login-spam-note">
          Don&apos;t see the code? Check your spam or junk folder.
        </p>
      </form>
    );
  }

  return (
    <form className="login-form" onSubmit={onEmailSubmit} noValidate>
      <label htmlFor="login-email">Email</label>
      <input
        id="login-email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (noAccount) setNoAccount(false);
        }}
        required
      />
      {noAccount && (
        <div role="alert" className="login-no-account">
          <p>
            We don&apos;t have an account associated with this email yet.
            Please make your first booking to create your account, then sign
            in afterwards to manage your bookings.
          </p>
          <Link href="/?scrollTo=booking" className="login-no-account-btn">
            Book your first session
          </Link>
        </div>
      )}
      {error && (
        <div role="alert" className="login-error">
          {error}
        </div>
      )}
      <button type="submit" className="login-btn" disabled={submitting}>
        {submitting ? "Checking…" : "Send my code"}
      </button>
    </form>
  );
}
