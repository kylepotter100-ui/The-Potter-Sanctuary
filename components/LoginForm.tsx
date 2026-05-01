"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  next: string;
};

export default function LoginForm({ next }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (otpError) throw otpError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="login-success">
        <div className="login-icon" aria-hidden="true">✓</div>
        <h2>Check your inbox</h2>
        <p>Your secure sign-in link is on its way to {email}.</p>
        <p className="login-hint">
          If you don't see it within a minute, check your spam folder.
        </p>
      </div>
    );
  }

  return (
    <form className="login-form" onSubmit={onSubmit} noValidate>
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
        {submitting ? "Sending…" : "Send my link"}
      </button>
    </form>
  );
}
