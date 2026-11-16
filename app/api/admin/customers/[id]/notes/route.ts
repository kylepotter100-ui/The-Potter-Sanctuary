import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const MAX = 2000;

// Owner's private notes about a client (access needs, preferences, "call,
// don't text"). Admin-only; never shown to or emailed to the client.
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
  let body: { notes?: unknown };
  try {
    body = (await req.json()) as { notes?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.notes !== null && typeof body.notes !== "string") {
    return NextResponse.json({ error: "Invalid notes" }, { status: 400 });
  }
  const notes = (body.notes ?? "").trim();
  if (notes.length > MAX) {
    return NextResponse.json(
      { error: `Notes can be at most ${MAX} characters.` },
      { status: 400 }
    );
  }
  const { data, error } = await supabaseAdmin
    .from("customers")
    .update({ notes: notes || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) {
    const missing = error.code === "PGRST204" || error.code === "42703";
    return NextResponse.json(
      {
        error: missing ? "migration_required" : "save_failed",
        message: missing
          ? "Client notes need the latest database update (migration 20261117_offline_consultation_notes)."
          : "Could not save. Please try again.",
      },
      { status: missing ? 409 : 500 }
    );
  }
  if (!data?.length) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
