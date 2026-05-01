"use client";

import { useState } from "react";

export default function SignOutButton() {
  const [pending, setPending] = useState(false);
  return (
    <form
      action="/api/auth/signout"
      method="POST"
      onSubmit={() => setPending(true)}
    >
      <button type="submit" className="signout-link" disabled={pending}>
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </form>
  );
}
