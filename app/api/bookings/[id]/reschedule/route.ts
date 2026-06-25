import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { rescheduleBooking } from "@/lib/booking-reschedule";

export const dynamic = "force-dynamic";

type Body = { date?: string; time?: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user || !user.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const date = body.date ?? "";
  const time = body.time ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    return NextResponse.json(
      { error: "Missing or invalid new date/time" },
      { status: 400 }
    );
  }

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const result = await rescheduleBooking({
    bookingId: id,
    newDate: date,
    newTime: time,
    by: "customer",
    requireCustomerId: customer.id,
  });

  if (result.ok) {
    return NextResponse.json({ ok: true, id: result.id });
  }
  return NextResponse.json(
    result.message ? { error: result.error, message: result.message } : { error: result.error },
    { status: result.status }
  );
}
