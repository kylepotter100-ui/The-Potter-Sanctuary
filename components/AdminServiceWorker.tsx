"use client";

import { useEffect } from "react";

// Registers the admin PWA service worker. Rendered only from app/admin/layout.tsx,
// so the public site never registers it. Scope "/admin" matches the manifest
// scope so the login/offline pages stay in the standalone window; "/admin" is a
// subpath of the script path "/sw.js", so no Service-Worker-Allowed header is
// needed. updateViaCache:"none" keeps the SW script out of the HTTP cache so a
// deploy can't get stuck serving a stale shell.
export default function AdminServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/admin", updateViaCache: "none" })
      .catch(() => {
        // Registration failures are non-fatal — admin works without the SW.
      });
  }, []);

  return null;
}
