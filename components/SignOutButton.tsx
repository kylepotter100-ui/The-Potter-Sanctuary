"use client";

import { useState } from "react";

export default function SignOutButton({
  className = "signout-link",
}: {
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  return (
    <form
      action="/api/auth/signout"
      method="POST"
      onSubmit={() => setPending(true)}
    >
      <button type="submit" className={className} disabled={pending}>
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </form>
  );
}
