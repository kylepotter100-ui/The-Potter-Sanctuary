// Server-side Cloudflare Turnstile verification for the public booking form.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
//
// Policy:
//   - A token Cloudflare says is invalid/expired/reused  -> REJECT.
//   - No secret configured, or Cloudflare unreachable    -> ALLOW, loudly logged
//     ("[turnstile] FAIL-OPEN"). A config slip or a Cloudflare blip must never
//     stop real customers booking; the per-IP and per-email rate limits still
//     apply on that path.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileVerdict = { ok: boolean; degraded: boolean; codes?: string[] };

export async function verifyTurnstile(
  token: unknown,
  ip: string | null
): Promise<TurnstileVerdict> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[turnstile] FAIL-OPEN — TURNSTILE_SECRET_KEY not configured");
    return { ok: true, degraded: true };
  }
  if (typeof token !== "string" || !token || token.length > 4096) {
    return { ok: false, degraded: false, codes: ["missing-input-response"] };
  }
  try {
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    if (ip && ip !== "unknown") form.append("remoteip", ip);
    const res = await fetch(VERIFY_URL, { method: "POST", body: form });
    if (!res.ok) {
      console.error("[turnstile] FAIL-OPEN — siteverify HTTP", res.status);
      return { ok: true, degraded: true };
    }
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    return { ok: data.success === true, degraded: false, codes: data["error-codes"] };
  } catch (err) {
    console.error("[turnstile] FAIL-OPEN — siteverify unreachable", String(err));
    return { ok: true, degraded: true };
  }
}
