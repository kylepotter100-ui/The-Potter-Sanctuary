# Pre-Launch Subtle-Bug Audit

Scope: a narrow, targeted audit of subtle interaction bugs of the same class
as the "Signups not allowed for otp" issue (fixed in Part 1). This is **not**
the broad Phase 4.5 audit — it focuses only on the risk areas listed below.

Status legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low · ✅ Reviewed, no issue

Generated alongside commit:
`fix: allow auth user creation for verified customers + pre-launch audit findings documented`

---

## Part 1 fix (applied in this PR)

- **`components/LoginForm.tsx`** — `signInWithOtp` `shouldCreateUser` changed
  `false → true`. The security gate is the `/api/customer/check` call that runs
  immediately before it; only emails with an existing customer record reach
  `signInWithOtp`. A verified customer who booked but never signed in has no
  auth user yet, so their first OTP must be allowed to create it. With
  `shouldCreateUser:false` Supabase threw "Signups not allowed for otp" and
  blocked their first-ever sign-in.
- **`components/InlineSignInModal.tsx`** — added the same `/api/customer/check`
  gate before `signInWithOtp` (the modal's email field is editable, so a
  changed email could otherwise create an auth user for a non-customer). Kept
  `shouldCreateUser:true`. This closes the "verify gate in all code paths"
  requirement.

Verified: both OTP entry points (`LoginForm`, `InlineSignInModal`) now call
`/api/customer/check` and block non-customers before `signInWithOtp`.

---

## CATEGORY A — Auth & user-lifecycle interactions

### A1 — Customer records vs auth users 🟢 Low
- WHERE: `app/account/page.tsx:67-99`, `app/account/profile/page.tsx`,
  `app/auth/callback/route.ts:62-92`.
- WHAT: `/account` looks the customer up by email and guards every downstream
  query behind `if (customer)`; a signed-in auth user with no customer row
  renders an empty account page (display name falls back to the email prefix) —
  no crash. The auth callback now signs out + redirects when no customer row
  exists, so this out-of-sync state is only reachable if a customer row is
  deleted *after* a session already exists.
- WHEN: customer record manually deleted while a session is live.
- FIX: none required for launch. Optional hardening: in `/account`, if
  `user` exists but `customer` is null, show a "make a booking to set up your
  account" message instead of an empty shell.

### A2 — Returning-customer detection 🟢 Reviewed (OK post-fix) ✅
- WHERE: `components/Booking.tsx` (returning banner), `components/InlineSignInModal.tsx`.
- WHAT: the banner shows when `/api/customer/check` returns `exists:true` and
  the visitor is not signed in. A customer with a record but no auth user is
  handled correctly — the modal/login OTP creates the auth user
  (`shouldCreateUser:true`) and `verifyOtp` then signs them in. With the Part 1
  modal gate added, a non-customer email typed into the modal is rejected
  before any auth user is created.
- No issue.

### A3 — Email mismatch / case sensitivity 🟢 Reviewed (OK, one note)
- WHERE: `app/api/booking/route.ts:67,96` · `app/api/customer/check/route.ts:21`
  · `app/auth/callback/route.ts:67` · `app/account/page.tsx:67` ·
  `app/questionnaire/page.tsx:54,66`.
- WHAT: `customers.email` is **always stored lowercased** (only `/api/booking`
  inserts it, via `emailLower`). Every lookup uses a lowercased email, and the
  one place a stored booking email is compared (`questionnaire/page.tsx:66`)
  lowercases both sides. Case-insensitive throughout.
- NOTE: `bookings.customer_email` is stored raw-case (display only) — never
  used as a case-sensitive key, so this is fine. No fix needed.

### A4 — Sign-out edge cases 🟢 Low
- WHERE: `app/api/auth/signout/route.ts`.
- WHAT: `signOut()` is wrapped in try/catch and the route **always** redirects
  to `/` (303), so the user is never left on an error page. Caveat: the
  in-code comment claims the cookie is cleared "regardless," but
  `auth.signOut()` is itself what clears the auth cookies — if it throws
  *before* writing the cleared cookies, the session cookie could survive the
  redirect, leaving the user effectively still signed in.
- WHEN: Supabase unreachable mid-signout (rare).
- FIX: optional — explicitly expire the `sb-*-auth-token` cookies on the
  redirect response so sign-out is guaranteed client-side even if the Supabase
  call fails.

---

## CATEGORY B — Booking & cancellation race conditions

### B1 — Cancellation 15-minute buffer 🟡 Medium (double-cancel)
- WHERE: `app/api/bookings/[id]/cancel/route.ts:70-95` ·
  `app/api/admin/bookings/[id]/cancel/route.ts:63-75`.
- WHAT (boundary): `minutesUntil < 15` rejects; at exactly 15.0 min it is
  *allowed*. This is sensible/expected — no change needed.
- WHAT (double cancel): both the customer and admin cancel routes do
  `read status → guard → update status='cancelled'` with **no conditional on
  the UPDATE** (`.eq("id", id)` only). If customer and owner cancel the same
  booking concurrently, both pass the `status === 'cancelled'` guard and both
  write — last writer wins for `cancelled_by` / `cancelled_at` / reason, and
  the customer can receive **two different cancellation emails** (the
  "by customer" and "by owner" variants).
- WHEN: simultaneous customer + owner cancellation of the same booking.
- SEVERITY: Medium (final status is consistently `cancelled`, but `cancelled_by`
  is nondeterministic and duplicate emails are possible).
- FIX: make the cancel UPDATE conditional and claim-based, e.g.
  `.update({...}).eq("id", id).neq("status", "cancelled").select()` and only
  send emails if a row was actually updated; otherwise treat as already
  cancelled and no-op.

### B2 — Slot blocked / unavailable between fetch and submit 🟠 High
- WHERE: `app/api/booking/route.ts` (insert at ~112-130) — **no server-side
  availability validation**.
- WHAT: `/api/booking` validates field presence and inserts a `pending`
  booking. It does **not** check `blocked_dates`, the `availability`
  day_of_week template, `slot_overrides`, or even that the slot is within
  opening hours. The only DB guard is the `bookings_active_slot_unique`
  partial index (prevents two active bookings on the same date+time). So:
  (a) if an admin blocks the date or toggles the slot off after the customer
  loaded availability, the booking still succeeds; (b) a crafted/stale request
  can book a slot that was never offered.
- WHEN: admin blocks a date/slot between availability fetch and submit; stale
  client; or a hand-crafted request.
- SEVERITY: High for data integrity (bookings can land on closed days/slots),
  though low likelihood in normal single-admin use.
- FIX: in `/api/booking`, before insert, recompute availability for the
  requested date (day_of_week template ∪ active slot_overrides − blocked_dates
  − existing active bookings) and reject with a clear 409 / "slot no longer
  available" if the requested time isn't free. Mirror the `Booking.tsx`
  `freeSlotsFor` resolution server-side.

### B3 — Confirm vs cancel race 🟡 Medium
- WHERE: `app/api/admin/bookings/[id]/status/route.ts:45-52` —
  `.update({ status }).eq("id", id)` with **no conditional**.
- WHAT: admin "confirm" sets `status='confirmed'` unconditionally. If a customer
  cancels at the same moment (or just before), a confirm landing afterwards
  **resurrects a cancelled booking** to `confirmed` — re-blocking the slot via
  the unique index and contradicting the cancellation email the customer
  already received.
- WHEN: admin confirms while/just after a customer cancels the same booking.
- SEVERITY: Medium.
- FIX: gate status transitions. e.g. confirm should be
  `.update({status:'confirmed'}).eq("id", id).neq("status","cancelled")` and
  report "this booking was cancelled" if zero rows updated. Consider rejecting
  any transition out of `cancelled` entirely.

---

## CATEGORY C — Cron job edge cases

### C1 — Reminder duplicates under overlapping cron runs 🟢 Low
- WHERE: `app/api/cron/reminders/route.ts:96-139` ·
  `app/api/cron/appointment-reminders/route.ts` ·
  `app/api/cron/review-requests/route.ts`.
- WHAT: each cron selects rows where `*_sent_at IS NULL`, sends, then sets
  `*_sent_at`. The mark-sent UPDATE is **not conditional** on the column still
  being null, and the select→send→mark sequence isn't a claim. If a run takes
  longer than an hour and overlaps the next trigger, the same booking can be
  selected by both runs and emailed twice.
- WHEN: cron run exceeds ~1 hour (many emails) and overlaps the next run.
- SEVERITY: Low (tiny studio volume; narrow window).
- FIX: claim-before-send — `UPDATE ... SET sent_at=now() WHERE id=? AND sent_at
  IS NULL RETURNING id`; only send if a row was claimed. Idempotent under
  overlap.

### C2 — Morning-summary boundary & dedupe atomicity 🟡 Medium
- WHERE: `app/api/cron/morning-summary/route.ts:78-90,194-197` ·
  `worker.mjs` (dispatches when UK hour ∈ [6,7,8]).
- WHAT (single-shot window): the route only sends when `ukHour() === 7`. The
  worker invokes it for hours 6/7/8, but the route hard-gates on `=== 7`, so
  there is effectively **one** sending opportunity per day. If Cloudflare's
  cron drifts the "07:00" trigger past the top of the hour into 08:xx (or the
  07:00 run is skipped), the UK hour reads 8 and the summary is **missed for
  the day**.
- WHAT (atomicity): dedupe is check-then-insert with the `INSERT` happening
  *after* the email send (`:83` read, `:173` send, `:195` insert). Two
  concurrent 7am runs could both pass the `alreadySent` check and both send
  before either inserts; the second `INSERT` then fails on the PK but the
  duplicate email already went out. The insert error is also unchecked.
- WHEN: cron drift past the hour boundary (missed send); concurrent 7am runs
  (duplicate send).
- SEVERITY: Medium (missed daily summary is the more likely of the two).
- FIX: (a) widen the send gate to `hour === 7 || hour === 8` so a drifted
  trigger still sends, relying on `daily_summaries_sent` to dedupe; and
  (b) make it claim-first — `INSERT INTO daily_summaries_sent(summary_date)
  ON CONFLICT DO NOTHING RETURNING ...`; only send if the row was newly
  inserted.

### C3 — Cron Resend-failure handling ✅ Reviewed, no issue
- WHERE: `app/api/cron/reminders/route.ts:122-140` (and the other cron routes).
- WHAT: on a Resend error the routes `continue`/return **without** setting the
  `*_sent_at` flag, so the booking is retried on the next run (correct — the
  customer isn't silently skipped). `*_sent_at` is only set after a confirmed
  successful send. This is the right behaviour.
- No issue.

---

## CATEGORY D — Data integrity edge cases

### D1 — Cancelled bookings free their slot ✅ Reviewed, no issue
- WHERE: `supabase/schema.sql:182` (`bookings_active_slot_unique ... WHERE
  status IN ('pending','confirmed')`) · `app/api/availability/route.ts`
  (booked-slot query filters `status in ('pending','confirmed')`).
- WHAT: the partial unique index and the public availability query both exclude
  `cancelled`, so a cancelled booking's slot returns to availability
  immediately. Correct.
- No issue.

### D2 — Customer record vs auth.users desync 🟢 Low
- WHERE: `supabase/schema.sql:28` (`user_id ... ON DELETE SET NULL`) ·
  `app/auth/callback/route.ts`.
- WHAT: deleting an auth user sets `customers.user_id` NULL; the next sign-in
  re-links it via email match — fine. Deleting a customer row leaves any auth
  user orphaned, but `/api/customer/check` then blocks sign-in and the auth
  callback signs them out, so they can't get a useful session. There are **no
  hard-delete code paths in the app** (cancellation is a status change), so
  this is only reachable by manual DB action.
- SEVERITY: Low (theoretical).
- FIX: none for launch.

### D3 — Questionnaire orphaning & PII on customer delete 🟢 Low
- WHERE: `supabase/schema.sql:124-125` (`consultation_responses.customer_id ...
  ON DELETE CASCADE`, `booking_id ... ON DELETE SET NULL`), `:49,:68`
  (`bookings.customer_id ... ON DELETE SET NULL`).
- WHAT: hard-deleting a *booking* nulls the consultation's `booking_id` but
  keeps the consultation linked to the customer (preserves health history) —
  reasonable. Hard-deleting a *customer* cascades their consultations away
  (good for erasure) **but** their bookings keep `customer_email` /
  `customer_first_name` / `customer_last_name` (PII retained on `bookings` with
  `customer_id` set NULL). For a GDPR erasure request, deleting the customer
  row would not remove their PII from `bookings`.
- WHEN: a future "delete my data" request, performed by deleting the customer
  row.
- SEVERITY: Low (no erasure flow exists yet; manual-only).
- FIX: when an erasure flow is built, also scrub/anonymise PII columns on the
  customer's `bookings` rows (or hard-delete them).

---

## CATEGORY E — Email deliverability edge cases

### E1 — Bouncing emails 🟢 Low (informational)
- WHERE: all `resend.emails.send(...)` call sites.
- WHAT: the code checks `result.error` (synchronous send-time failures) but has
  no Resend **webhook** handling, so an asynchronous bounce/complaint after a
  successful send is invisible to the app. Reminder flags are set on
  send-success, not delivery, so a bounced reminder is considered "sent" and
  never retried. No local logic incorrectly assumes delivery beyond this.
- SEVERITY: Low (Resend-side concern).
- FIX: optional post-launch — add a Resend webhook to record bounces/complaints
  and surface bad addresses in admin.

### E2 — Unsubscribe handling 🟢 Low
- WHERE: `emails/ConsultationReminder.tsx`, `emails/AppointmentReminder.tsx`,
  `emails/MorningSummary.tsx` (owner-only), `emails/ReviewRequest.tsx`.
- WHAT: booking confirmation / cancellation are transactional (no unsubscribe
  required). The consultation + appointment reminders are tied to a specific
  booking the customer made (transactional-adjacent). `ReviewRequest` is the
  closest to marketing and currently has no opt-out line. The shared footer
  already includes a contact email.
- SEVERITY: Low.
- FIX: before enabling `REVIEWS_ENABLED`, add a brief opt-out / "reply STOP"
  or unsubscribe line to the review-request email (and optionally the
  reminders) to stay clear of PECR/CAN-SPAM grey areas.

---

## Summary table

| ID | Area | Severity | Needs fix before launch? |
|----|------|----------|--------------------------|
| A1 | Auth/customer desync on /account | 🟢 Low | No |
| A2 | Returning-customer detection | ✅ OK | No |
| A3 | Email case sensitivity | ✅ OK | No |
| A4 | Sign-out cookie clear on failure | 🟢 Low | Optional |
| B1 | Double-cancel race / duplicate emails | 🟡 Medium | Recommended |
| B2 | No server-side slot validation in /api/booking | 🟠 High | **Recommended** |
| B3 | Confirm-vs-cancel race resurrects booking | 🟡 Medium | Recommended |
| C1 | Reminder duplicates on cron overlap | 🟢 Low | Optional |
| C2 | Morning-summary drift miss + dedupe atomicity | 🟡 Medium | Recommended |
| C3 | Cron Resend-failure handling | ✅ OK | No |
| D1 | Cancelled bookings free slot | ✅ OK | No |
| D2 | Auth/customer deletion desync | 🟢 Low | No |
| D3 | PII retained on bookings after customer delete | 🟢 Low | When erasure flow built |
| E1 | Bounce handling | 🟢 Low | Optional (post-launch) |
| E2 | Review-email unsubscribe | 🟢 Low | Before REVIEWS_ENABLED |

**Top recommendations for a follow-up remediation PR:** B2 (server-side slot
validation), then B1/B3 (conditional, claim-based status updates), then C2
(morning-summary window + atomic dedupe). C1 is a cheap idempotency win on the
same pattern as B1/B3.
