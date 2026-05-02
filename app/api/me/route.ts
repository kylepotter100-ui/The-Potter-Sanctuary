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
      return NextResponse.json(
        { user: null, customer: null },
        { headers: { "Cache-Control": "private, no-cache, no-store" } }
      );
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
      // Run the consult-count and upcoming-bookings queries in parallel.
      // Window the bookings to the next 60 days — anything further out
      // isn't useful in the homepage panel and saves CPU.
      const todayIso = new Date().toISOString().slice(0, 10);
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 60);
      const horizonIso = horizon.toISOString().slice(0, 10);

      const [{ count }, { data: upcoming }] = await Promise.all([
        supabaseAdmin
          .from("consultation_responses")
          .select("id", { count: "exact", head: true })
          .eq("customer_id", customer.id),
        supabaseAdmin
          .from("bookings")
          .select("id, treatment_name, booking_date, booking_time, status")
          .eq("customer_id", customer.id)
          .gte("booking_date", todayIso)
          .lte("booking_date", horizonIso)
          .in("status", ["pending", "confirmed"])
          .order("booking_date", { ascending: true })
          .order("booking_time", { ascending: true }),
      ]);

      hasConsultation = (count ?? 0) > 0;
      upcomingBookings = (upcoming ?? []) as typeof upcomingBookings;
    }

    return NextResponse.json(
      {
        user: { id: user.id, email: user.email },
        customer: customer ?? null,
        hasConsultation,
        upcomingBookings,
      },
      { headers: { "Cache-Control": "private, no-cache, no-store" } }
    );
  } catch (err) {
    console.error("[api/me] error", err);
    return NextResponse.json({ user: null, customer: null });
  }
}
