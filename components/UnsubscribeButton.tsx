"use client";

import { useState } from "react";

export default function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  async function go() {
    setState("busy");
    const res = await fetch(`/api/unsubscribe?t=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => null);
    setState(res && res.ok ? "done" : "error");
  }
  if (state === "done") {
    return <p className="review-lede" role="status">You&apos;re unsubscribed. Sorry to see you go — you can opt in again any time you book.</p>;
  }
  return (
    <>
      <button type="button" className="login-btn" onClick={go} disabled={state === "busy" || !token}>
        {state === "busy" ? "Unsubscribing…" : "Unsubscribe"}
      </button>
      {state === "error" && <p role="alert" className="login-error">That link didn&apos;t work. Reply to any of our emails and we&apos;ll remove you.</p>}
    </>
  );
}
