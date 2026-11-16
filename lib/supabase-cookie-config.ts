// Shared cookie configuration for the Supabase browser and server clients.
// Both must agree on encoding and cookie attributes so the PKCE code verifier
// the browser writes is the same one the server reads at /auth/callback.

export const SUPABASE_COOKIE_ENCODING = "base64url" as const;

export const SUPABASE_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  // Secure in every production build (the deployed Worker, and `wrangler dev`
  // which browsers treat as a secure context on localhost). Only `next dev`
  // over plain http leaves it off, so local development still works.
  secure: process.env.NODE_ENV === "production",
};
