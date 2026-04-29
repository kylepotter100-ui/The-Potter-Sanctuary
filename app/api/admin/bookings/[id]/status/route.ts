import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const VALID = new Set(["pending", "confirmed", "cancelled"]);

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
  let body: { status?: string };
  try {
    body = (await req.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status;
  if (typeof status !== "string" || !VALID.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
