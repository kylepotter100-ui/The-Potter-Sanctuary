import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { ukTodayIso } from "@/lib/uk-time";

export const dynamic = "force-dynamic";

const REDACTED_EMAIL = "erased@redacted.invalid";

// UK GDPR Article 17 (erasure), as promised in the privacy policy.
// - Health questionnaires, reviews, notes and the client record are DELETED.
// - Past bookings are kept but ANONYMISED (name/contact/message removed) so the
//   diary history and takings still add up for the books.
// - Their sign-in account is removed.
// Refused while the client has an upcoming booking (cancel it first), and the
// owner must type the client's name to confirm.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const { id } = await params;
  let body: { confirmName?: unknown };
  try {
    body = (await req.json()) as { confirmName?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { data: customer } = await supabaseAdmin.from("customers").select("*").eq("id", id).maybeSingle();
  if (!customer) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const c = customer as { id: string; full_name: string | null; first_name: string | null; last_name: string | null; user_id: string | null; email: string | null };
  const name = (c.full_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`).trim();
  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!name || norm(body.confirmName) !== norm(name)) {
    return NextResponse.json(
      { error: "confirm", message: `Type the client's name exactly (${name}) to confirm.` },
      { status: 400 }
    );
  }
  const { data: upcoming } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("customer_id", id)
    .in("status", ["pending", "confirmed"])
    .gte("booking_date", ukTodayIso())
    .limit(1);
  if (upcoming && upcoming.length > 0) {
    return NextResponse.json(
      { error: "upcoming", message: "This client has an upcoming booking. Cancel it first, then erase their data." },
      { status: 409 }
    );
  }

  const steps: [string, PromiseLike<{ error: { code?: string; message: string } | null }>][] = [
    ["consultations", supabaseAdmin.from("consultation_responses").delete().eq("customer_id", id)],
    ["reviews", supabaseAdmin.from("reviews").delete().eq("customer_id", id)],
    [
      "bookings",
      supabaseAdmin
        .from("bookings")
        .update({
          customer_first_name: "Erased",
          customer_last_name: "client",
          customer_email: REDACTED_EMAIL,
          customer_phone: "—",
          customer_gender: null,
          message: null,
          cancellation_reason: null,
        })
        .eq("customer_id", id),
    ],
  ];
  for (const [label, p] of steps) {
    const { error } = await p;
    if (error) {
      console.error(`[erase] ${label} failed`, error.code, error.message);
      return NextResponse.json({ error: "erase_failed", message: `Could not erase (${label}). Nothing further was changed; please try again.` }, { status: 500 });
    }
  }
  // Bookings keep their row but lose the link (FK is ON DELETE SET NULL).
  const { error: delErr } = await supabaseAdmin.from("customers").delete().eq("id", id);
  if (delErr) {
    console.error("[erase] customer delete failed", delErr.code, delErr.message);
    return NextResponse.json({ error: "erase_failed", message: "Could not delete the client record." }, { status: 500 });
  }
  if (c.user_id) {
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(c.user_id);
    if (authErr) console.error("[erase] auth user delete failed", authErr.message);
  }
  return NextResponse.json({ ok: true });
}
