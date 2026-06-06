import type { SupabaseClient } from "@supabase/supabase-js";

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
