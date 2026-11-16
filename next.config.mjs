// Response headers for pages and routes. (public/_headers only covers static
// assets on Cloudflare — CLAUDE.md rule 8.)

const SITE_HOST = "thepottersanctuary.co.uk";

// The browser Supabase client (sign-in only) talks to this origin. Inlined at
// build like every NEXT_PUBLIC_* value; the literal is the live project.
const SUPABASE_ORIGIN = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://kibdjvtpubxkgusupulr.supabase.co"
).origin;

// Content Security Policy. 'unsafe-inline' for scripts is required by Next's
// inline hydration payloads unless every page is rendered per-request with a
// nonce, which would throw away the static caching of the public pages. The
// policy still pins WHERE code may come from, blocks plugins/<base> hijacks,
// stops forms posting elsewhere, and forbids framing (clickjacking).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_ORIGIN} https://challenges.cloudflare.com https://cloudflareinsights.com`,
  "frame-src https://challenges.cloudflare.com https://www.google.com https://maps.google.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Booking ids travel in /review and /questionnaire links — never send full
  // URLs to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Content-Security-Policy", value: CSP },
];

const NO_STORE = [{ key: "Cache-Control", value: "private, no-store, max-age=0" }];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Personal data never sits in a shared or browser cache.
      { source: "/admin", headers: NO_STORE },
      { source: "/admin/:path*", headers: NO_STORE },
      { source: "/account/:path*", headers: NO_STORE },
      { source: "/account", headers: NO_STORE },
      { source: "/questionnaire", headers: NO_STORE },
      { source: "/review", headers: NO_STORE },
      // One Worker answers on several hostnames (workers.dev, branch and
      // commit previews). Only the real domain may be indexed, so every
      // other host says noindex — duplicates of the site can't compete with
      // it in Google.
      {
        source: "/:path*",
        missing: [{ type: "host", value: SITE_HOST }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
