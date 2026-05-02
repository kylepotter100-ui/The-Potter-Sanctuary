import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Body = {
  override_date?: string;
  slot_time?: string;
  is_active?: boolean;
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
  const slot = body.slot_time;
  const active = body.is_active;
  if (
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !slot ||
    !/^\d{2}:\d{2}(:\d{2})?$/.test(slot) ||
    typeof active !== "boolean"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const slotTime = slot.length === 5 ? `${slot}:00` : slot;

  const { error } = await supabaseAdmin
    .from("slot_overrides")
    .upsert(
      {
        override_date: date,
        slot_time: slotTime,
        is_active: active,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "override_date,slot_time" }
    );

  if (error) {
    console.error("[slot-override] upsert failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
