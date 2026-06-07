import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get("admin_session")?.value === "authenticated";
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }

  let body: { date?: string; reason?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date, reason } = body;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Invalid date — expected YYYY-MM-DD" },
      { status: 400 }
    );
  }
  if (typeof reason === "string" && reason.length > 500) {
    return NextResponse.json(
      { error: "Reason too long (max 500 characters)" },
      { status: 400 }
    );
  }

  // Idempotent — the day-toggle workflow may call this for a date that was
  // already blocked (e.g. quick double-tap). Upsert avoids the unique
  // constraint violation on blocked_date.
  const { data, error } = await supabaseAdmin
    .from("blocked_dates")
    .upsert(
      { blocked_date: date, reason: reason ?? null },
      { onConflict: "blocked_date" }
    )
    .select()
    .single();

  if (error) {
    console.error("[availability/block] upsert failed", JSON.stringify(error));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
  return NextResponse.json(data);
}
