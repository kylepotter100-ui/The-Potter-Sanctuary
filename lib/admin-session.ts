// Single source of truth for the admin session cookie so the login route, logout
// route, and middleware (rolling refresh) never drift on attributes — important
// for a security cookie. Pure constants/functions only, so this is safe to import
// from the Edge runtime (middleware).
//
// The action API routes authorize by reading this exact name/value
// (`admin_session === "authenticated"`), so neither may change.

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_VALUE = "authenticated";

// 30 days. The session is rolling: middleware re-issues this cookie on every
// authenticated request, so any visit within a 30-day window keeps it alive.
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

type AdminSessionCookie = {
  name: string;
  value: string;
  httpOnly: true;
  sameSite: "lax";
  secure: true;
  path: "/";
  maxAge: number;
};

// Cookie used to establish / refresh the session.
export function adminSessionCookie(
  maxAge: number = ADMIN_SESSION_MAX_AGE
): AdminSessionCookie {
  return {
    name: ADMIN_SESSION_COOKIE,
    value: ADMIN_SESSION_VALUE,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge,
  };
}

// Cookie used to clear the session (logout) — same attributes, expired.
export function clearAdminSessionCookie(): AdminSessionCookie {
  return { ...adminSessionCookie(0), value: "" };
}
