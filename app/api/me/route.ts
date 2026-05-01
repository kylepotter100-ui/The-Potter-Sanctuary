import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user || !user.email) {
      return NextResponse.json({ user: null, customer: null });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({
        user: { id: user.id, email: user.email },
        customer: null,
      });
    }

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select(
        "id, email, full_name, first_name, last_name, phone_number, gender, date_of_birth, address, emergency_contact_name, emergency_contact_phone"
      )
      .eq("email", user.email.toLowerCase())
      .maybeSingle();

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      customer: customer ?? null,
    });
  } catch {
    return NextResponse.json({ user: null, customer: null });
  }
}
