import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

// Whether a customer has ALREADY left a review on ANY of their bookings — used
// to make sure we never ask a repeat customer to review again.
//
// "Same customer" is matched primarily by email (works even for guest bookings
// with no customer_id) via reviews.booking_id -> bookings.customer_email, plus
// reviews.customer_id as a secondary catch. All reads are against existing
// tables; this never writes.
//
// Fails safe to `false` on a query error: a transient DB hiccup should never
// silently suppress a legitimate review request.
export async function customerHasReviewed(
  admin: SupabaseClient,
  { customerId, email }: { customerId: string | null; email: string }
): Promise<boolean> {
  const trimmed = (email ?? "").trim();

  // 1) Reviews left on any booking that shares this email (case-insensitive
  //    exact match — no wildcards in the ilike pattern).
  if (trimmed) {
    const { data: sameEmailBookings, error: bookingsError } = await admin
      .from("bookings")
      .select("id")
      .ilike("customer_email", trimmed);

    if (bookingsError) {
      console.error(
        "[customerHasReviewed] bookings lookup failed",
        JSON.stringify(bookingsError)
      );
      return false;
    }

    const ids = (sameEmailBookings ?? []).map((b) => b.id as string);
    if (ids.length > 0) {
      const { count, error: reviewError } = await admin
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .in("booking_id", ids);
      if (reviewError) {
        console.error(
          "[customerHasReviewed] review-by-booking lookup failed",
          JSON.stringify(reviewError)
        );
        return false;
      }
      if ((count ?? 0) > 0) return true;
    }
  }

  // 2) Secondary: reviews tied to the same linked customer account (covers a
  //    changed email under the same customer_id).
  if (customerId) {
    const { count, error: byCustomerError } = await admin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId);
    if (byCustomerError) {
      console.error(
        "[customerHasReviewed] review-by-customer lookup failed",
        JSON.stringify(byCustomerError)
      );
      return false;
    }
    if ((count ?? 0) > 0) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Bulk review lookups for list views (Bookings list, Outstanding reviews).
// `customerHasReviewed` runs 1–2 queries PER customer; calling it across a whole
// list would blow the Worker's CPU budget. These helpers read the reviews table
// ONCE and classify every booking locally, mirroring the same email + customer_id
// matching. Fails safe to "nobody reviewed" on error.
// ---------------------------------------------------------------------------

export type ReviewedIndex = { emails: Set<string>; customerIds: Set<string> };

// Wrapped in React `cache()` so the (single) reviews scan is computed at most
// once per server request. The Bookings page reads the index directly AND calls
// listOutstandingReviewClients (which needs it too); without this they'd each
// scan the reviews table. `admin` is the stable singleton, so it dedupes cleanly.
export const getReviewedIndex = cache(async function getReviewedIndex(
  admin: SupabaseClient
): Promise<ReviewedIndex> {
  const emails = new Set<string>();
  const customerIds = new Set<string>();

  const { data: reviews, error } = await admin
    .from("reviews")
    .select("booking_id, customer_id");
  if (error) {
    console.error("[getReviewedIndex] reviews read failed", JSON.stringify(error));
    return { emails, customerIds };
  }

  const bookingIds: string[] = [];
  for (const r of reviews ?? []) {
    if (r.customer_id) customerIds.add(r.customer_id as string);
    if (r.booking_id) bookingIds.push(r.booking_id as string);
  }

  if (bookingIds.length > 0) {
    const { data: bks, error: bErr } = await admin
      .from("bookings")
      .select("customer_email")
      .in("id", bookingIds);
    if (bErr) {
      console.error(
        "[getReviewedIndex] booking-email read failed",
        JSON.stringify(bErr)
      );
    } else {
      for (const b of bks ?? []) {
        const e = ((b.customer_email as string) ?? "").trim().toLowerCase();
        if (e) emails.add(e);
      }
    }
  }

  return { emails, customerIds };
});

/** Local, query-free membership test against a prebuilt {@link ReviewedIndex}. */
export function hasReviewed(
  index: ReviewedIndex,
  { customerId, email }: { customerId: string | null; email: string }
): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (e && index.emails.has(e)) return true;
  if (customerId && index.customerIds.has(customerId)) return true;
  return false;
}

/** Per-booking review lifecycle for list chips (mirrors the booking-detail page). */
export type ReviewState = "left" | "requested" | "none";
export function reviewStateFor(
  index: ReviewedIndex,
  booking: {
    customer_id: string | null;
    customer_email: string;
    review_email_sent_at: string | null;
  }
): ReviewState {
  if (hasReviewed(index, { customerId: booking.customer_id, email: booking.customer_email }))
    return "left";
  return booking.review_email_sent_at ? "requested" : "none";
}

export type OutstandingClient = {
  key: string;
  name: string;
  email: string;
  customerId: string | null;
  sessions: { treatment: string; date: string }[];
  count: number;
  lastDate: string;
  // The booking a review request will target: the client's most recent
  // completed session (request-review is per-booking).
  targetBookingId: string;
  // "requested" if that target already had its review email sent; else "none".
  // ("left" clients are excluded entirely.)
  reviewState: "requested" | "none";
  // When that request went out (target booking's review_email_sent_at), so the
  // UI can show the last-requested date; null when never requested.
  lastRequestedAt: string | null;
};

/**
 * Clients with a COMPLETED session (confirmed booking dated before `todayIso`)
 * who have NOT left a review, grouped by client (email, guests included) and
 * sorted most-recent-session first. Used by the Outstanding reviews view and
 * the Bookings-page banner count.
 */
export async function listOutstandingReviewClients(
  admin: SupabaseClient,
  todayIso: string
): Promise<OutstandingClient[]> {
  const { data: past, error } = await admin
    .from("bookings")
    .select(
      "id, customer_first_name, customer_last_name, customer_email, customer_id, treatment_name, booking_date, booking_time, review_email_sent_at"
    )
    .eq("status", "confirmed")
    .lt("booking_date", todayIso)
    .order("booking_date", { ascending: false })
    .order("booking_time", { ascending: false });
  if (error) {
    console.error(
      "[listOutstandingReviewClients] past bookings read failed",
      JSON.stringify(error)
    );
    return [];
  }

  const index = await getReviewedIndex(admin);
  const groups = new Map<string, OutstandingClient>();

  for (const b of past ?? []) {
    const email = ((b.customer_email as string) ?? "").trim();
    const customerId = (b.customer_id as string | null) ?? null;
    if (hasReviewed(index, { customerId, email })) continue;

    const key = email ? email.toLowerCase() : customerId ?? (b.id as string);
    let g = groups.get(key);
    if (!g) {
      // First seen = most recent session (rows arrive date-desc), so it's the
      // request target and supplies the "requested/none" state.
      g = {
        key,
        name:
          `${b.customer_first_name ?? ""} ${b.customer_last_name ?? ""}`.trim() ||
          "Guest",
        email,
        customerId,
        sessions: [],
        count: 0,
        lastDate: b.booking_date as string,
        targetBookingId: b.id as string,
        reviewState: b.review_email_sent_at ? "requested" : "none",
        lastRequestedAt: (b.review_email_sent_at as string | null) ?? null,
      };
      groups.set(key, g);
    }
    g.sessions.push({
      treatment: b.treatment_name as string,
      date: b.booking_date as string,
    });
    g.count += 1;
  }

  return [...groups.values()].sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));
}

