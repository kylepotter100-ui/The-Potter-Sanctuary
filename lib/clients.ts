import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/phone";

// ============================================================================
// Client (customer) read helpers for the admin Clients screens. Service-role
// reads only (admin pages are gated by middleware). Customers are created at
// booking time (see lib/booking-create.ts), so this surfaces everyone who has
// ever booked — questionnaire or not.
// ============================================================================

export type ClientListRow = {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  gender: string | null;
  visits: number; // non-cancelled bookings
  lastVisit: string | null; // YYYY-MM-DD
  hasQuestionnaire: boolean;
};

type CustomerRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone_number: string | null;
  gender?: string | null;
};

function displayName(c: {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
}): string {
  if (c.full_name && c.full_name.trim()) return c.full_name.trim();
  const fl = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
  return fl || c.email;
}

/**
 * Search customers by name / email / phone. Phone matches use the normalized
 * key (same one the booking route reconciles on). Empty query returns the most
 * recent customers. Aggregates visit counts, last visit and questionnaire
 * status in three bounded queries (no per-row round-trips).
 */
export async function searchClients(
  admin: SupabaseClient,
  q: string
): Promise<ClientListRow[]> {
  const term = (q ?? "").trim();
  let query = admin
    .from("customers")
    .select("id, full_name, first_name, last_name, email, phone_number, gender")
    .order("created_at", { ascending: false })
    .limit(200);

  if (term) {
    const like = `%${term}%`;
    const phoneNorm = normalizePhone(term);
    const ors = [
      `full_name.ilike.${like}`,
      `first_name.ilike.${like}`,
      `last_name.ilike.${like}`,
      `email.ilike.${like}`,
    ];
    // Only add the phone clause when the term actually contains digits, so a
    // pure-text search doesn't match every row with an empty normalized phone.
    if (phoneNorm) ors.push(`phone_normalized.ilike.%${phoneNorm}%`);
    query = query.or(ors.join(","));
  }

  const { data: customers, error } = await query;
  if (error) {
    console.error("[clients] search failed", JSON.stringify(error));
    return [];
  }
  const rows = (customers ?? []) as CustomerRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [{ data: bookings }, { data: consults }] = await Promise.all([
    admin
      .from("bookings")
      .select("customer_id, booking_date, status")
      .in("customer_id", ids),
    admin
      .from("consultation_responses")
      .select("customer_id")
      .in("customer_id", ids),
  ]);

  const visitCount = new Map<string, number>();
  const lastVisit = new Map<string, string>();
  for (const b of (bookings ?? []) as {
    customer_id: string | null;
    booking_date: string;
    status: string;
  }[]) {
    if (!b.customer_id || b.status === "cancelled") continue;
    visitCount.set(b.customer_id, (visitCount.get(b.customer_id) ?? 0) + 1);
    const prev = lastVisit.get(b.customer_id);
    if (!prev || b.booking_date > prev) lastVisit.set(b.customer_id, b.booking_date);
  }
  const hasQ = new Set(
    ((consults ?? []) as { customer_id: string | null }[])
      .map((c) => c.customer_id)
      .filter((id): id is string => !!id)
  );

  return rows
    .map((c) => ({
      id: c.id,
      fullName: displayName(c),
      firstName: c.first_name,
      lastName: c.last_name,
      email: c.email,
      phone: c.phone_number,
      gender: c.gender ?? null,
      visits: visitCount.get(c.id) ?? 0,
      lastVisit: lastVisit.get(c.id) ?? null,
      hasQuestionnaire: hasQ.has(c.id),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export type ClientBooking = {
  id: string;
  booking_date: string;
  booking_time: string;
  treatment_name: string;
  treatment_price: number;
  status: "pending" | "confirmed" | "cancelled";
  /** Set when the booking was paid with a gift voucher — excluded from spend. */
  voucher_id: string | null;
};

export type ClientReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  booking_id: string | null;
};

export type ClientProfile = {
  customer: {
    id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone_number: string | null;
    gender: string | null;
    created_at: string;
  };
  displayName: string;
  bookings: ClientBooking[];
  consultation: Record<string, unknown> | null;
  reviews: ClientReview[];
  stats: {
    visits: number; // non-cancelled
    lifetimeSpend: number; // sum of confirmed treatment_price
    clientSince: string; // YYYY-MM-DD
  };
};

/** Full profile for one client: record + all bookings + latest consultation + reviews. */
export async function getClientProfile(
  admin: SupabaseClient,
  id: string
): Promise<ClientProfile | null> {
  const { data: customer, error } = await admin
    .from("customers")
    .select(
      "id, full_name, first_name, last_name, email, phone_number, gender, created_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("[clients] profile failed", JSON.stringify(error));
  if (!customer) return null;

  const [{ data: bookings }, { data: consult }, { data: reviews }] =
    await Promise.all([
      admin
        .from("bookings")
        .select(
          "id, booking_date, booking_time, treatment_name, treatment_price, status, voucher_id"
        )
        .eq("customer_id", id)
        .order("booking_date", { ascending: false })
        .order("booking_time", { ascending: false }),
      admin
        .from("consultation_responses")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("reviews")
        .select("id, rating, comment, created_at, booking_id")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
    ]);

  const bk = (bookings ?? []) as ClientBooking[];
  const visits = bk.filter((b) => b.status !== "cancelled").length;
  // Voucher-funded bookings are excluded from SPEND but still count as VISITS:
  // the client did come in, they just paid when the voucher was bought rather
  // than on the day. Filtered here in the reduce rather than in the query above
  // so the booking still appears in their history list.
  const lifetimeSpend = bk
    .filter((b) => b.status === "confirmed" && !b.voucher_id)
    .reduce((sum, b) => sum + (b.treatment_price ?? 0), 0);

  return {
    customer: customer as ClientProfile["customer"],
    displayName: displayName(customer as CustomerRow),
    bookings: bk,
    consultation: (consult as Record<string, unknown> | null) ?? null,
    reviews: (reviews ?? []) as ClientReview[],
    stats: {
      visits,
      lifetimeSpend,
      clientSince: (customer.created_at as string).slice(0, 10),
    },
  };
}
