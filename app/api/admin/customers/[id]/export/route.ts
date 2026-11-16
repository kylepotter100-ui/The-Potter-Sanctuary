import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// UK GDPR Article 15 (right of access) / 20 (portability): everything held
// about one client, as a JSON download the owner can send them.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const { id } = await params;
  const { data: customer } = await supabaseAdmin.from("customers").select("*").eq("id", id).maybeSingle();
  if (!customer) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const [{ data: bookings }, { data: consultations }, { data: reviews }] = await Promise.all([
    supabaseAdmin.from("bookings").select("*").eq("customer_id", id).order("booking_date"),
    supabaseAdmin.from("consultation_responses").select("*").eq("customer_id", id).order("created_at"),
    supabaseAdmin.from("reviews").select("*").eq("customer_id", id).order("created_at"),
  ]);
  // Internal-only fields that aren't the client's personal data.
  const { unsubscribe_token: _t, user_id: _u, ...profile } = customer as Record<string, unknown>;
  const body = {
    exported_at: new Date().toISOString(),
    controller: "The Potter Sanctuary, hello@thepottersanctuary.co.uk",
    profile,
    bookings: bookings ?? [],
    consultations: consultations ?? [],
    reviews: reviews ?? [],
  };
  const safeName = String((customer as { full_name?: string }).full_name ?? "client")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .slice(0, 40);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="potter-sanctuary-${safeName}-data.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
