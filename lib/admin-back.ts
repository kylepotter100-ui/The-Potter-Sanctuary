// Resolve where an admin "← Back" link should go, based on an explicit `?from=`
// referrer. Deterministic and SSR-safe (no reliance on browser history), so a
// flow that starts on Clients returns to Clients, not always to Bookings.
//
// `from` is validated to an in-app /admin/ path to avoid open-redirects; an
// unknown/missing value falls back to the Bookings list.

type Back = { href: string; label: string };

export function resolveBack(from?: string | null): Back {
  if (from && from.startsWith("/admin/")) {
    let label = "bookings";
    if (from === "/admin/clients") label = "clients";
    else if (from.startsWith("/admin/clients/")) label = "client";
    else if (from.startsWith("/admin/bookings")) label = "bookings";
    return { href: from, label };
  }
  return { href: "/admin/bookings", label: "bookings" };
}
