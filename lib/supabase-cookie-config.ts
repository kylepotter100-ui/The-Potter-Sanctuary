// Shared cookie configuration for the Supabase browser and server clients.
// Both must agree on encoding and cookie attributes so the PKCE code verifier
// the browser writes is the same one the server reads at /auth/callback.

export const SUPABASE_COOKIE_ENCODING = "base64url" as const;

export const SUPABASE_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  // We deliberately don't set `secure: true` here so cookies still work on
  // http://localhost during dev. In production the site is served over https,
  // and SameSite=Lax is enough to make the verifier survive the round-trip
  // from Supabase back to /auth/callback.
};
