import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }

  let body: { day_of_week?: number; slot_time?: string; is_active?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { day_of_week, slot_time, is_active } = body;
  if (
    typeof day_of_week !== "number" ||
    day_of_week < 0 ||
    day_of_week > 6 ||
    typeof slot_time !== "string" ||
    !/^\d{2}:\d{2}(:\d{2})?$/.test(slot_time) ||
    typeof is_active !== "boolean"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const normalized = slot_time.length === 5 ? `${slot_time}:00` : slot_time;

  const { data, error } = await supabaseAdmin
    .from("availability")
    .upsert(
      { day_of_week, slot_time: normalized, is_active },
      { onConflict: "day_of_week,slot_time" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
