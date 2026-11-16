// Single source of truth for the admin session cookie: its attributes AND the
// signed token it carries. Pure Web Crypto (`crypto.subtle`) only — no
// `node:*` imports — so it runs unchanged in middleware, route handlers,
// server components and vitest (CLAUDE.md rule 1).
//
// WHY A SIGNED TOKEN: the cookie used to hold the fixed literal
// "authenticated", and every gate compared against that literal. Anyone could
// set `admin_session=authenticated` by hand and walk straight into the admin
// (client health records, CSV export, vouchers, cancellations). The value is
// now `v1.<expiryMs>.<HMAC-SHA256(secret, "v1.<expiryMs>")>`, keyed by the
// ADMIN_SESSION_SECRET Worker secret:
//   - it cannot be forged without the secret;
//   - it expires server-side even if the browser keeps the cookie;
//   - rotating ADMIN_SESSION_SECRET signs every device out at once.
// Verification uses `crypto.subtle.verify`, which compares in constant time.
//
// FAILS CLOSED: with no secret configured, no token verifies and none can be
// issued, so the admin is locked rather than open.

export const ADMIN_SESSION_COOKIE = "admin_session";

// 30 days. The session is rolling: middleware re-issues a freshly signed token
// on every authenticated request, so any visit within 30 days keeps it alive.
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const TOKEN_VERSION = "v1";

type AdminSessionCookie = {
  name: string;
  value: string;
  httpOnly: true;
  sameSite: "lax";
  secure: true;
  path: "/";
  maxAge: number;
};

export function adminSessionSecret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET;
  // A short secret is as bad as none: refuse it rather than sign with it.
  return s && s.length >= 32 ? s : null;
}

function b64url(bytes: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string, usage: "sign" | "verify") {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  );
}

/** Issue a token valid for `maxAgeSeconds` from `nowMs`. */
export async function createAdminSessionToken(
  secret: string,
  nowMs: number = Date.now(),
  maxAgeSeconds: number = ADMIN_SESSION_MAX_AGE
): Promise<string> {
  const payload = `${TOKEN_VERSION}.${nowMs + maxAgeSeconds * 1000}`;
  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret, "sign"),
    new TextEncoder().encode(payload)
  );
  return `${payload}.${b64url(sig)}`;
}

/** True only for an unexpired token signed with `secret`. Never throws. */
export async function verifyAdminSessionToken(
  secret: string | null,
  token: string | undefined | null,
  nowMs: number = Date.now()
): Promise<boolean> {
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return false;
  if (!/^\d{1,16}$/.test(parts[1])) return false;
  const expiry = Number(parts[1]);
  if (!Number.isFinite(expiry) || expiry <= nowMs) return false;
  const sig = fromB64url(parts[2]);
  if (!sig) return false;
  try {
    return await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret, "verify"),
      sig,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
  } catch {
    return false;
  }
}

/** Cookie carrying a freshly signed token. */
export function adminSessionCookie(
  token: string,
  maxAge: number = ADMIN_SESSION_MAX_AGE
): AdminSessionCookie {
  return {
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge,
  };
}

/** Cookie used to clear the session (logout) — same attributes, expired. */
export function clearAdminSessionCookie(): AdminSessionCookie {
  return adminSessionCookie("", 0);
}

/**
 * Constant-time string equality for the login password. Both sides are hashed
 * first so the comparison loop always runs over 32 bytes regardless of input
 * length, and nothing short-circuits on the first differing byte.
 */
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
