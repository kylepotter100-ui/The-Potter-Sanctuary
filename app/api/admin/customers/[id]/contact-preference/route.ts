import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Owner sets how a client is contacted: 'email' (automatic emails),
// 'phone' (no emails; owner phones them) or 'none' (no automatic contact).
// Enforced for every client email by lib/customer-email.ts.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const { id } = await params;
  let body: { contactPreference?: string };
  try {
    body = (await req.json()) as { contactPreference?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const pref = body.contactPreference;
  if (pref !== "email" && pref !== "phone" && pref !== "none") {
    return NextResponse.json({ error: "Invalid preference" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("customers")
    .update({ contact_preference: pref, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, email");
  if (error) {
    const missing = error.code === "PGRST204" || error.code === "42703";
    return NextResponse.json(
      {
        error: missing ? "migration_required" : "update_failed",
        message: missing
          ? "Contact preferences need the latest database update (migration 20261117_contact_preferences)."
          : "Could not save. Please try again.",
      },
      { status: missing ? 409 : 500 }
    );
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (pref === "email" && !data[0].email) {
    return NextResponse.json(
      {
        ok: true,
        contactPreference: pref,
        warning: "Saved — but this client has no email address on file, so nothing will be emailed until one is added.",
      }
    );
  }
  return NextResponse.json({ ok: true, contactPreference: pref });
}
