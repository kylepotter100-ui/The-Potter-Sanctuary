// Supabase origin allowed for XHR/fetch in the CSP connect-src.
const SUPABASE_ORIGIN = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();

// CSP shipped in Report-Only mode for now: it never blocks, only reports, so the
// public site and admin keep working while we observe violations before enforcing.
// 'unsafe-inline'/'unsafe-eval' are pragmatic for Next's inline hydration/Wasm;
// tighten (nonces) when moving to enforcing.
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${SUPABASE_ORIGIN ? " " + SUPABASE_ORIGIN : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// Safe security headers applied to every response. Enforcing now (none of these
// break a normal site); CSP stays Report-Only above.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
