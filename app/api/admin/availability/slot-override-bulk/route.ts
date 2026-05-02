import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Bulk variant of /api/admin/availability/slot-override. Used when the
// admin toggles a day "open" that has no day_of_week template (Sun/Mon by
// default) — we seed all default slots as active overrides for that date
// in one request rather than firing 20 individual upserts.
type Body = {
  override_date?: string;
  slots?: Array<{ slot_time: string; is_active: boolean }>;
};

async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get("admin_session")?.value === "authenticated";
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const date = body.override_date;
  const slots = body.slots;
  if (
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Array.isArray(slots) ||
    slots.length === 0 ||
    slots.length > 50
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const rows = slots.map((s) => {
    const t = s.slot_time;
    if (typeof t !== "string" || !/^\d{2}:\d{2}(:\d{2})?$/.test(t)) {
      throw new Error("Invalid slot_time");
    }
    return {
      override_date: date,
      slot_time: t.length === 5 ? `${t}:00` : t,
      is_active: !!s.is_active,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabaseAdmin
    .from("slot_overrides")
    .upsert(rows, { onConflict: "override_date,slot_time" });

  if (error) {
    console.error("[slot-override-bulk] upsert failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: rows.length });
}
