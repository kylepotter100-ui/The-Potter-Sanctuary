import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Consultation status — customer-aware.
//
// "Completed" was historically judged per booking (a consultation_responses row
// with this booking_id). But the questionnaire is really about the *person*: a
// returning client who already filled it once shouldn't read as a blank
// "not completed" on a later booking — even if they rebooked without signing in.
//
// We expose THREE states so the admin can tell them apart (the owner re-confirms
// each visit, so a carried-over consultation is shown but kept distinct from one
// freshly completed for this booking):
//   - "own"     → this booking has its own consultation_responses row
//   - "carried" → no own row, but the customer has a consultation on another booking
//   - "none"    → the customer has no consultation anywhere (genuinely new)
// ============================================================================

export type ConsultationState = "own" | "carried" | "none";

/**
 * Per-booking consultation state for a list of bookings, in two bounded queries
 * (own rows by booking_id; customers-with-any-consultation by customer_id).
 */
export async function getConsultationStateIndex(
  admin: SupabaseClient,
  bookings: { id: string; customer_id: string | null }[]
): Promise<Map<string, ConsultationState>> {
  const result = new Map<string, ConsultationState>();
  if (bookings.length === 0) return result;

  const bookingIds = bookings.map((b) => b.id);
  const customerIds = Array.from(
    new Set(bookings.map((b) => b.customer_id).filter((x): x is string => !!x))
  );

  const [ownRes, custRes] = await Promise.all([
    admin
      .from("consultation_responses")
      .select("booking_id")
      .in("booking_id", bookingIds),
    customerIds.length
      ? admin
          .from("consultation_responses")
          .select("customer_id")
          .in("customer_id", customerIds)
      : Promise.resolve({ data: [] as { customer_id: string | null }[] }),
  ]);

  const ownSet = new Set(
    ((ownRes.data ?? []) as { booking_id: string | null }[])
      .map((r) => r.booking_id)
      .filter((x): x is string => !!x)
  );
  const custSet = new Set(
    ((custRes.data ?? []) as { customer_id: string | null }[])
      .map((r) => r.customer_id)
      .filter((x): x is string => !!x)
  );

  for (const b of bookings) {
    if (ownSet.has(b.id)) result.set(b.id, "own");
    else if (b.customer_id && custSet.has(b.customer_id))
      result.set(b.id, "carried");
    else result.set(b.id, "none");
  }
  return result;
}

/**
 * The customer's most recent consultation snapshot — used to render a
 * carried-over consultation read-only on the booking detail page.
 */
export async function getLatestConsultationForCustomer(
  admin: SupabaseClient,
  customerId: string
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .from("consultation_responses")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}
