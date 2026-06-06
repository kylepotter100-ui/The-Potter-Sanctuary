# PWA / Mobile Admin Overhaul — Codebase Analysis (Development 2)

> Read-only analysis. Goal: installable PWA admin with a native feel (bottom
> tabs: Dashboard / Bookings / Availability), mobile-optimised layouts, instant
> launch — **without** changing the public site or the desktop admin
> presentation. Same routes, responsive layouts, app-style chrome at mobile
> breakpoints / in standalone mode.

## Section 1 — Current admin structure

Routes under `app/admin/**` (all server components except the login form; data via
`supabaseAdmin` service-role client):

| Route | File | Purpose / data |
|---|---|---|
| `/admin` (login) | `app/admin/page.tsx` | Client `LoginForm`; POSTs password to `/api/admin/login`. |
| `/admin/dashboard` | `app/admin/dashboard/page.tsx` | Month nav + 4 count cards (pending/confirmed/cancelled/total) **+ a booking list table** (moves to Bookings in new design). |
| `/admin/bookings` | `app/admin/bookings/page.tsx` | Filterable list (status + range); rows link to detail. |
| `/admin/bookings/[id]` | `app/admin/bookings/[id]/page.tsx` | Booking details, consultation read-only, Customer Review box, Actions (confirm/cancel), Nudge, Request-review. |
| `/admin/availability` | `app/admin/availability/page.tsx` + `components/AvailabilityPanel.tsx` | Week view day/slot toggles + blocked dates. |
| layout | `app/admin/layout.tsx` | `import "./admin.css"`; wraps children in `<div className="admin-shell">`; sets `robots: noindex`. |

**Nav** — `components/AdminHeader.tsx`: a top header with brand + `<nav className="nav-links">` links to dashboard/bookings/availability (active via `active` prop) + a logout `<form action="/api/admin/logout" method="post">`. Rendered per-page (each page passes `active="…"`).

**Gating / session**
- `middleware.ts`: `matcher: ["/admin/:path+"]` (protects everything under `/admin` except `/admin` itself). Checks `req.cookies.get("admin_session")?.value === "authenticated"`, else redirect `/admin?reason=expired`.
- Login `app/api/admin/login/route.ts`: compares POSTed password to `process.env.ADMIN_PASSWORD` (plain equality), then `res.cookies.set("admin_session","authenticated",{ httpOnly:true, sameSite:"strict", secure:true, path:"/", maxAge: 60*60*24 })` → **24h lifetime, not rolling**.
- Logout `app/api/admin/logout/route.ts`: clears cookie (`maxAge:0`), POST & GET, 303 → `/admin`.
- Server-side checks elsewhere use `cookies().get("admin_session")?.value === "authenticated"` (e.g. the admin booking action routes).

## Section 2 — Bugs / layout issues (with cause)

**2.1 Past availability is shown AND editable.** `components/AvailabilityPanel.tsx`:
`weekStart` starts at current week but `shiftWeek(-1)` (≈:209) has no lower bound; `toggleDay` (≈:237) and `toggleSlot` (≈:293) have **no past-date guard** and POST to `/api/admin/availability/block` & `/slot-override`; day buttons (≈:402) render every day incl. past with no `disabled`. The fix pattern already exists for blocked dates: `ukTodayIso()` (≈:81) + `visibleBlocked = blocked.filter(b => b.blocked_date >= todayIso)` (≈:323). Mirror it: disable past day buttons, guard both toggles, and clamp `shiftWeek` so it can't go before the current week. (Server page already filters bookings/overrides to `today..+60`; `blocked_dates` is unfiltered server-side but filtered client-side.)

**2.2 Bookings list overlaps on mobile.** `app/admin/bookings/page.tsx` renders `<table className="admin-table admin-table-clickable">` with 7 columns and `data-label` on each `<td>`. `app/admin/admin.css`: the card-reflow (`thead` hidden, `tr/td` → block, `data-label` pseudo-element) only kicks in at **`max-width:520px`** (≈:531). Between **521–720px** the table stays a 7-col grid with only reduced padding (≈:525); `.badge` is `inline-block`, uppercase, `letter-spacing:.18em`, non-wrapping (≈:187) → badges/text collide. **Fix:** raise the card-reflow breakpoint to ~720px (or add an intermediate rule) so phones/large phones use the card layout, and let badges wrap.

**2.3 Consultation box cramping/overlap on mobile (admin detail).** In `app/admin/bookings/[id]/page.tsx` the consultation read-only block uses `.q-readonly-list` = `grid-template-columns: minmax(200px,1fr) 2fr` (`admin.css` ≈:604) and `.q-checklist` = `repeat(auto-fill, minmax(220px,1fr))` (≈:584). On a 360–390px screen the 200px/220px minimums force the dt/dd columns to overflow/overlap and labels to mash into values. The "Status:" value in *Booking Details* is a `.badge` (≈:226) but that line is unlikely the culprit. **Fix:** ensure a mobile media query collapses `.q-readonly-list` to one column and reduces the checklist min. ⚠️ *Ambiguity:* confirm via screenshot whether 2.3 refers to this consultation dt/dd grid or specifically the "Status" badge — planned for the grid as the primary cause.

**2.4 Other mobile issues spotted**
- `.q-checklist` / `.q-readonly-list` fixed minimums (above) cause horizontal pressure on the whole detail page.
- Tap targets below ~44px: `.btn` padding `10px 18px`, `.badge` `4px 12px` — fine visually, small for thumbs.
- `admin.css` references `.admin-filters-row` in a media query that doesn't exist in markup (dead rule) — harmless, note for cleanup.
- Bottom-nav (when added) must reserve safe-area: `padding-bottom: env(safe-area-inset-bottom)` and add bottom padding to `.admin-main` so content isn't hidden behind tabs.
- No `apple-mobile-web-app-*` / manifest yet (Section 6).

## Section 3 — Responsive / styling foundation

- **Two stylesheets, cleanly separated:** public/global `app/globals.css` (Tailwind layers + brand tokens + public component classes) imported in `app/layout.tsx`; admin `app/admin/admin.css` imported only in `app/admin/layout.tsx` and **scoped under `.admin-shell`** (its own `--admin-*` tokens). The two share no class names of consequence.
- **Boundary is safe:** because `admin.css` is imported only by the admin layout and rules live under `.admin-shell`, admin styling changes **cannot** affect the public site. (Watch only for bare element selectors inside `.admin-shell`; current ones are scoped.)
- **Breakpoints today:** public `960 / 767 / 600`; admin `720 / 520 / 420`. Admin is essentially desktop-first with a partial card-reflow at 520px (hence bug 2.2's 521–720 gap).
- **Recommended mechanism for mobile/PWA chrome (no desktop disturbance):** do it all inside the admin layer — add mobile rules under `.admin-shell` at a single admin mobile breakpoint (standardise on **≤768px**), host an app-style bottom tab bar in `app/admin/layout.tsx`, and gate native-only chrome with `@media (max-width:768px)` **plus optional** `@media (display-mode: standalone)` refinements. This keeps desktop admin and the public site untouched.

## Section 4 — Dashboard redesign (data availability)

**4.1 Today:** `app/admin/dashboard/page.tsx` shows month nav (`DashboardMonthNav`), four count cards, **and** a bookings table (date/time/name/treatment/status, clickable to detail). New design = overview **stats only**; the table **moves to the Bookings tab**.

**4.2 Data exists** (`supabase/schema.sql` bookings): `treatment_price int` (revenue), `status` (`pending|confirmed|cancelled`), `booking_date date` (period filter; indexed), `treatment_name text` / `treatment_id text` (grouping), `duration_minutes int`. All present and typed. Revenue = `sum(treatment_price) where status='confirmed'` over the period; most-booked = group/count by `treatment_name`. Both are simple server aggregations (mirror the dashboard's existing `Promise.all` count queries).

**4.3 Discount problem — confirmed data situation:** there is **no** actual-amount/discount/paid field anywhere (`treatment_price` is list price in £; cash-only, paid after session per `app/legal/terms`). So list-price revenue **overstates** if the owner discounts. **Handling real discounts would require a schema change (e.g. an `amount_collected`/`discount` column) — flagged for separate, careful planning given the live booking.** Recommend: start with list-price revenue clearly **labelled "list price (no discounts)"** and defer editable actual-amounts.

**4.4 Reusable period pattern:** `components/DashboardMonthNav.tsx` already drives `?year=YYYY&month=MM`; the page parses it and builds `startOfMonthIso`/`endOfMonthIso` (≈:22–66) → reuse for the month/year toggle. A **year** mode = widen bounds to Jan 1–Dec 31 of the year. Bookings list has a complementary `range` preset pattern (`AdminBookingFilters.tsx`), and crons use UK-tz `Intl.DateTimeFormat` for date math — reuse for consistency.

## Section 5 — Bookings tab (consolidation)

**5.1 Existing filters** (`app/admin/bookings/page.tsx`): `?status=` (`active`(default)|pending|confirmed|cancelled|all) and `?range=` (`today|week|month|next30|upcoming`(default)) via `rangeBounds()` → `.gte/.lte("booking_date")`; query selects id/customer/treatment/price/date/time/status; ordered desc; plus a `consultation_responses` set for the "Consultation" badge.

**5.2 What moves here:** the dashboard's booking-list table. The Bookings tab already has the richer filtering, so consolidation = remove the list from the dashboard; nothing new needs to move into Bookings beyond what's there.

**5.3 Detail reachability:** each row links `href={/admin/bookings/${b.id}}` → the detail page hosts Confirm/Cancel (`AdminBookingActions`), Nudge (`NudgeQuestionnaireButton`), Request-review (`RequestReviewButton`). In a tab structure, detail is a sub-route of the Bookings tab; the Bookings tab stays "active" and a back affordance returns to the list (Section 8.2).

## Section 6 — PWA feasibility

**6.1 Current state:** icons already exist in `/public` — `favicon.ico`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `og-image.png`, `robots.txt` (disallows `/admin`,`/api`,`/auth`). `app/layout.tsx` sets `viewport.themeColor:"#8A9E85"` and `metadata.icons` (icon/apple/shortcut). **No `manifest.webmanifest`, no service worker, no `apple-mobile-web-app-*` tags, no `manifest` link.** So: icons ready; manifest + SW + a few meta tags are the gap.

**6.2 Framework/deploy:** Next.js 15.5.15 on `@opennextjs/cloudflare` + Workers; `wrangler.jsonc` serves static assets via the `ASSETS` binding from `.open-next/assets` (which includes `/public`). So a `public/manifest.webmanifest` and a `public/sw.js` will be served as static assets. **Gotchas:** (a) register the SW from a client component (e.g. in the admin layout) — Next doesn't auto-register; (b) keep the SW hand-written/minimal rather than pulling a heavy plugin into the OpenNext build; (c) scope matters — register with `scope: "/admin"` (and place `sw.js` so its scope covers `/admin`) so caching never touches the public site; (d) `robots.txt` already hides `/admin`.

**6.3 Caching strategy (state explicitly in the plan):** **app-shell precache + network-first-only-for-shell; never cache data.** Concretely: SW caches **static assets only** (the build's hashed JS/CSS, icons, manifest, an offline fallback page) and serves the shell instantly. **Do NOT cache** `/api/*` or any RSC/data fetches — use **network-only** for those, and on failure show an honest offline state (no stale diary). Actions (confirm/cancel/nudge/request-review) are **online-only**; offline → graceful "no connection" message, **no background sync / no offline queueing**. **Risk to flag:** Next.js App-Router pages fetch data via RSC payloads and `/api` routes; a naive "cache all GET" SW would cache bookings/availability and show dangerous stale data. Mitigation: allow-list only static asset extensions/paths for caching; treat everything else network-only; scope SW to `/admin`.

**6.4 iOS specifics:** for home-screen install need `manifest` with `display:"standalone"`, `start_url:"/admin"` (or `/admin/dashboard`), theme/background colours, and the existing icons; plus `apple-touch-icon` (present) and `apple-mobile-web-app-capable`/`status-bar-style` meta. **Cookie persistence risk:** iOS standalone PWAs historically use a partitioned/separate cookie/storage jar and can evict it; a `sameSite:"strict"`, 24h, non-rolling cookie will likely **log her out frequently** in standalone. Mitigations to test on a real iPhone: longer **rolling** expiry, consider `sameSite:"lax"`, confirm the cookie survives app backgrounding/relaunch and 7-day ITP windows. **Must be tested on-device before relying on it.**

## Section 7 — Login / session convenience

**7.1 Current:** single password field → `/api/admin/login` → `admin_session` cookie, `maxAge 24h`, `sameSite:strict`, `secure`, `httpOnly`, **not rolling** (re-login daily). (§1.)

**7.2 Options (tiered):**
- **(a) Device autofill / OS biometric gate (lowest effort, recommended start):** ensure the login form uses a real `<form>` with `<input type="password" name="…" autocomplete="current-password">` (+ a username/email field with `autocomplete="username"` if desired) so iOS Keychain offers save + FaceID autofill. Pure front-end attribute work.
- **(b) Longer-lived / rolling session (low effort, high payoff):** raise `maxAge` (e.g. 30 days) and refresh it on activity (re-set cookie in middleware or a lightweight endpoint). Directly mitigates the 6.4 iOS logout pain. Decision needed: lifetime + whether rolling. Security note: it's a single shared password gate guarding a real diary — longer sessions trade convenience for risk; `httpOnly`+`secure` retained.
- **(c) WebAuthn/passkeys (true FaceID-as-login, later):** real biometric auth; needs a credentials store (new table) + register/verify endpoints/libs. Scope/storage = a later phase, not Phase 2.

**Recommended start:** (a) + (b) together — autofill attributes now, plus a longer rolling session — and revisit (c) later. Confirm desired session length.

## Section 8 — App-style navigation

**8.1 Bottom tab bar placement:** add it in **`app/admin/layout.tsx`** (only wraps `/admin/*`, so never on the public site), rendered as a sibling of `.admin-shell`, styled in `admin.css`, shown via `@media (max-width:768px)` (works in mobile browser too) with optional `@media (display-mode: standalone)` polish; hidden on desktop (where `AdminHeader` stays). Reserve safe-area + add bottom padding to `.admin-main`. Tabs: Dashboard / Bookings / Availability, active state from the current path (client component using `usePathname`).

**8.2 Detail in a tab structure:** `/admin/bookings/[id]` is a sub-route of the Bookings tab — keep **Bookings** highlighted while on a detail page (active-tab logic matches `/admin/bookings` prefix), and add an in-page back affordance ("← Bookings") on detail for mobile. No nested-routing changes required; just path-prefix-based active state.

---

## Consolidated bug/issue list (sequence fixes first)
1. **Availability past dates** editable/visible — guard toggles + disable past day buttons + clamp week nav (2.1).
2. **Bookings list 521–720px overlap** — raise card-reflow breakpoint / allow badge wrap (2.2).
3. **Consultation detail grids** don't collapse on phones — single-column at mobile; reduce checklist min (2.3/2.4). *(confirm exact element)*
4. Minor: tap-target sizing, dead `.admin-filters-row` rule, safe-area padding once tabs land (2.4).

## Recommended sequencing for Development 2
1. **Mobile layout bug fixes** (2.1–2.4) — pure CSS/guard logic, zero schema, low risk; immediate value.
2. **Responsive app-style layouts + bottom tab bar** in `app/admin/layout.tsx` (mobile breakpoint, optional standalone), keeping desktop `AdminHeader`.
3. **Dashboard redesign** — stats only (list-price revenue *labelled*, most-booked, month/year toggle reusing `?year&month`); drop the dashboard booking list.
4. **PWA shell** — `manifest.webmanifest`, minimal `/admin`-scoped service worker (shell precache, **network-only data**, offline fallback), iOS meta tags, register from admin layout.
5. **Login convenience** — autofill attributes + longer rolling session; passkeys later.

## Schema-change flags
- **Requires a schema change (plan separately, live booking):** editable **actual amount collected / discount** for accurate revenue (new column). Until then: list-price revenue, clearly labelled.
- **Everything else is front-end/config only, zero schema impact:** all layout/bug fixes, bottom tabs, dashboard stats (read-only aggregations on existing columns), manifest/service worker/icons/meta, and session lifetime/autofill (cookie/config). Passkeys (option 7c) *would* need storage but is explicitly deferred.

## Open decisions to confirm
1. **2.3 element:** consultation dt/dd grid vs the "Status" badge — confirm via screenshot.
2. **Bottom tabs visibility:** mobile breakpoint always (recommended) vs standalone-only.
3. **Session length:** target lifetime + rolling? (drives 6.4/7.2b).
4. **Revenue labelling:** OK to ship list-price revenue labelled "no discounts" and defer the actual-amount column?
5. **Tab set:** Dashboard / Bookings / Availability only (Logout stays in header/settings)?
</content>
