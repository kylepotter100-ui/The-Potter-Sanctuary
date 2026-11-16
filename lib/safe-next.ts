// Post-sign-in redirect target: same-origin relative paths only (no open redirect).
export function safeNext(raw: string | null): string {
  if (!raw) return "/account";
  // Only same-origin relative paths. "//evil.com" and "/\\evil.com" are both
  // treated by browsers/URL parsers as a different host, so reject any
  // backslash or control character, then confirm the resolved origin.
  if (!raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f]/.test(raw)) {
    return "/account";
  }
  // Strip URL fragments — Supabase's verifier sometimes decodes `%23` to
  // a literal `#`, which then chews up the appended `&code=…`.
  const hashIdx = raw.indexOf("#");
  const path = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
  try {
    const probe = "https://same-origin.invalid";
    if (new URL(path, probe).origin !== probe) return "/account";
  } catch {
    return "/account";
  }
  return path;
}
