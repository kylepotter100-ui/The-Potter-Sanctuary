# The Potter Sanctuary — agent/deployment constraints

Single-studio booking site: Next.js 15 App Router, deployed to **Cloudflare
Workers via @opennextjs/cloudflare** (one Worker, `wrangler.jsonc`), Supabase
(one project — the LIVE database, real customer bookings), Resend for email.
The public site, the admin diary (`/admin`, PWA) and the crons all run in the
same Worker.

## Hard rules (every one of these has caused a production incident)

1. **Runtime is workerd, not Node.** Never import `node:*` modules in route
   handlers or anything bundled into the Worker. `node:crypto`'s
   `createHash`/`timingSafeEqual` threw at runtime and 500'd the admin login
   for days — use **Web Crypto** (`crypto.subtle`), which exists in both
   runtimes. `next start`/local dev run pure Node and will NOT catch this;
   only the deployed Worker (workers.dev preview) proves it.

2. **Never derive customer-facing URLs from the request.** One Worker serves
   multiple hostnames (custom domain, `*.workers.dev`, previews).
   `new URL(req.url).origin` leaked a `workers.dev` preview host into a real
   customer's email links. Canonical base URL = `siteConfig.url` from
   `@/lib/site` — always.

3. **Never parse booking date/times with bare `new Date(...)`.**
   `booking_date`/`booking_time` are UK wall-clock values with no timezone;
   the Worker's clock is UTC, so `new Date(\`${date}T${time}\`)` is an hour
   late for the whole of BST (this silently broke the 15-minute cancel cutoff
   every summer). Use `lib/uk-time.ts`: `ukWallTimeToUtc`, `minutesUntilUk`,
   `ukTodayIso`, `ukNow` — and never `toISOString().slice(0, 10)` for a UK
   "today".

4. **`NEXT_PUBLIC_*` env vars are inlined at build time.** Changing them in
   the Cloudflare dashboard does not update already-built code. The fallback
   literals in `lib/site.ts` / `worker.mjs` are the real safety net — keep
   them correct (apex `https://thepottersanctuary.co.uk`; the `www` host does
   not resolve).

5. **The database is shared and live.** The dev preview hostname hits the
   SAME Supabase as production. Never write test data without the scoped
   cleanup pattern (test email `kylepotter1@hotmail.co.uk`, delete by that
   email only). Schema changes are owner-applied via the dashboard;
   `supabase/schema.sql` must be updated in the same PR to match.

6. **Service role is the only DB path.** All reads/writes go through API
   routes/server components using `supabaseAdmin`. RLS is enabled
   deny-by-default with zero policies; the browser Supabase client is for
   auth only. Don't add direct client-side `.from()` table access without
   adding policies.

7. **Cron emails must be claim-then-send.** Atomically claim the dedupe flag
   (`.update().is(flag, null).select()`) before sending; release the claim on
   send failure. `morning-summary` and the admin `request-review` route are
   the reference implementations.

8. **Headers/caching live in two places.** `public/_headers` only covers
   static assets on Cloudflare; response headers for pages/routes belong in
   `next.config.mjs` `headers()`. The admin service worker (`public/sw.js`)
   must stay network-only for data — never cache `/api/*` or HTML.

## Conventions

- Slot logic has ONE home: `lib/availability.ts` (shared by calendar, API and
  server validation; mirrored by the DB constraints
  `bookings_active_slot_unique` + `bookings_no_overlap`). UK-time logic has
  ONE home: `lib/uk-time.ts`.
- Booking truth: treatment id/name/price/duration come from `lib/services.ts`
  server-side; never trust the client payload for them.
- `npm test` (vitest, `tests/`) covers the pure slot/time math — keep it
  green and extend it when touching either lib.
- Git flow: feature branch off `main` → `dev` (force-push allowed; `dev`
  tracks main + current work only) for preview testing → unmerged PR →
  owner merges. Never merge or deploy without the owner's go-ahead.

## Verify before any PR

`npx tsc --noEmit` + `npm run build` + `npm test` all green, then prove
runtime behaviour on the workers.dev/dev preview (not just `next start`).
