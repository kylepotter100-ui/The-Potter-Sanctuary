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

    let hasConsultation = false;
    let upcomingBookings: Array<{
      id: string;
      treatment_name: string;
      booking_date: string;
      booking_time: string;
      status: string;
    }> = [];
    if (customer) {
      const { count } = await supabaseAdmin
        .from("consultation_responses")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customer.id);
      hasConsultation = (count ?? 0) > 0;

      const todayIso = new Date().toISOString().slice(0, 10);
      const { data: upcoming } = await supabaseAdmin
        .from("bookings")
        .select("id, treatment_name, booking_date, booking_time, status")
        .eq("customer_id", customer.id)
        .gte("booking_date", todayIso)
        .in("status", ["pending", "confirmed"])
        .order("booking_date", { ascending: true })
        .order("booking_time", { ascending: true });
      upcomingBookings = (upcoming ?? []) as typeof upcomingBookings;
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      customer: customer ?? null,
      hasConsultation,
      upcomingBookings,
    });
  } catch {
    return NextResponse.json({ user: null, customer: null });
  }
}
