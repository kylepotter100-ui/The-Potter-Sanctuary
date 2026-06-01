# Slot Logic Analysis

## RESOLVED — duration-aware blocking implemented

The booking system is now **duration-aware**. Previously every appointment was
treated as a single 30-minute slot and a booking only blocked its exact start
time, so a long session left later slots bookable and double-booked the
therapist. There was also no gap between appointments and no atomic protection
against two concurrent requests overlapping. All of that is fixed.

### Interval model (single source of truth)

Defined once in [`lib/availability.ts`](../lib/availability.ts) and used by the
public calendar, the availability API, and the server-side booking validator —
no slot logic is duplicated elsewhere.

- Studio opens **`OPEN_TIME` = 09:30**, closes **`CLOSE_TIME` = 19:00**. A
  session must **finish by 19:00**. 15-minute grid.
- **`BUFFER_MINUTES` = 15** — the only place the buffer length is defined.
- Every booking reserves the half-open interval
  **`[start, start + duration_minutes + BUFFER_MINUTES)`** (session + buffer).
  End-exclusive bounds mean a session ending 14:00 (buffer to 14:15) leaves
  **14:15** free as the next valid start (true back-to-back).
- A candidate `{ start, duration }` is **valid** iff all three hold:
  - **(a)** `start + duration <= 19:00` — finishes by close. The buffer may spill
    past close (an 18:00 + 60-min session is valid even though its buffer
    notionally runs to 19:15 — nothing can be booked then anyway).
  - **(b)** its interval does **not** intersect any existing pending/confirmed
    booking's interval (computed in minutes-since-midnight).
  - **(c)** every 15-min segment the **session** spans (not the buffer) is in the
    date's open set: `template ∪ active overrides − inactive overrides −
    blocked`.
- Helpers exported: `candidateRejection` / `isCandidateValid`,
  `validStartTimes(openSet, existing, duration)`,
  `fittingTreatments(openSet, existing, start)`, `resolveOpenSet`, and the
  DB-backed `validateSlotAvailable(admin, date, time, duration)`.

The public UI offers a start time only if at least the shortest (30-min)
treatment fits there (so the latest start is naturally 18:30), and on Step 2
greys out treatments that don't fit with a reason ("Not enough time before
closing" / "Not enough time before the next appointment").

### Corrected durations

New bookings use the corrected lengths; existing rows keep their **as-sold**
footprint via the backfill so already-sold appointments aren't silently shrunk.

| treatment_id | as-sold (backfill existing rows) | corrected (new bookings) |
|---|---|---|
| full-body-aromatherapy | 60 | 60 |
| back-neck-scalp | 30 | 30 |
| hot-stones-full | **75** | **60** |
| hot-stones-back | **45** | **30** |

### The exclusion constraint (atomic backstop)

`bookings_no_overlap` is a Postgres GiST exclusion constraint (needs the
`btree_gist` extension) that rejects any two pending/confirmed bookings on the
same date whose `[start, start + duration_minutes + 15)` intervals overlap:

```sql
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
EXCLUDE USING gist (
  booking_date WITH =,
  tsrange(
    (booking_date + booking_time),
    (booking_date + booking_time + make_interval(mins => duration_minutes + 15)),
    '[)'
  ) WITH &&
) WHERE (status IN ('pending','confirmed'));
```

It is the real concurrency guard; the older partial unique index
`bookings_active_slot_unique` is kept as a cheap identical-start guard. The
booking API catches both `23505` (unique) and `23P01` (exclusion) violations and
returns the same friendly 409.

### Two-phase migration ordering (shared prod/dev-preview DB)

The Supabase project backs both the dev preview and production, so a `NOT NULL`
column and the exclusion constraint can't land before the duration-aware code is
live (old code doesn't write `duration_minutes`). The migration is therefore
split — see [`supabase/migrations/`](../supabase/migrations):

1. **Phase A — `*_phaseA_duration_backcompat.sql`** (apply **before** merging the
   new code; backwards-compatible): add **nullable** `duration_minutes`, backfill
   as-sold durations, re-seed the availability template to the 15-min grid
   (09:30–18:45, delete the 19:00 rows), and expand existing `slot_overrides`
   onto the 15-min grid (a :00/:30 override also covers the adjacent :15/:45 it
   implied under the old grid).
2. **Phase B — `*_phaseB_notnull_exclusion.sql`** (apply **after** the new code is
   live): `SET NOT NULL`, `CREATE EXTENSION btree_gist`, add
   `bookings_no_overlap`.

`supabase/schema.sql` reflects the final post-both-phases state for fresh
installs.

> Pre-flight (run read-only before Phase B): an overlap-detection self-join over
> live pending/confirmed bookings under the new interval model found **no**
> overlapping pairs, so the exclusion constraint creates cleanly.
