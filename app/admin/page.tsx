"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push("/admin/dashboard");
        router.refresh();
        return;
      }
      if (res.status === 401) {
        setError("That password isn't right.");
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Something went wrong, try again.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="logo">
          <Image
            src="/sanctuary-logo.png"
            alt="The Potter Sanctuary"
            width={272}
            height={382}
            priority
          />
        </div>
        <h1>Welcome back</h1>
        <p className="sub">Enter the studio password to continue.</p>
        <form onSubmit={onSubmit}>
          {error && <div className="error-text">{error}</div>}
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? "Opening…" : "Enter sanctuary"}
          </button>
        </form>
      </div>
    </div>
  );
}
