import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import MorningSummary, {
  type SummaryBooking,
} from "@/emails/MorningSummary";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const TO = "hello@thepottersanctuary.co.uk";

// Returns the wall-clock hour and ISO date in Europe/London, regardless of
// the server's TZ. We use Intl rather than offset arithmetic so DST is
// handled correctly.
function ukNow() {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const h = parseInt(get("hour"), 10);
  return { dateIso: `${y}-${m}-${d}`, hour: h };
}

function formatLong(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function timeShort(t: string): string {
  return t.slice(0, 5);
}

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY missing" },
      { status: 500 }
    );
  }

  const { dateIso, hour } = ukNow();

  // Only run inside the 7am UK hour.
  if (hour !== 7) {
    return NextResponse.json({ ok: true, skipped: "outside-window", hour });
  }

  // Dedupe — if we've already sent today, bail.
  const { data: alreadySent } = await supabaseAdmin
    .from("daily_summaries_sent")
    .select("summary_date")
    .eq("summary_date", dateIso)
    .maybeSingle();
  if (alreadySent) {
    return NextResponse.json({ ok: true, skipped: "already-sent" });
  }

  // Pull today's bookings (UK date) excluding cancelled.
  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, customer_first_name, customer_last_name, treatment_name, booking_date, booking_time, status, cancelled_at"
    )
    .eq("booking_date", dateIso)
    .in("status", ["pending", "confirmed"])
    .is("cancelled_at", null)
    .order("booking_time", { ascending: true });

  if (error) {
    console.error("[cron morning-summary] query failed", JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (bookings ?? []).map((b) => b.id);
  let consultedSet = new Set<string>();
  if (ids.length > 0) {
    const { data: consults } = await supabaseAdmin
      .from("consultation_responses")
      .select("booking_id")
      .in("booking_id", ids);
    consultedSet = new Set(
      ((consults ?? []) as Array<{ booking_id: string | null }>)
        .map((c) => c.booking_id)
        .filter((x): x is string => !!x)
    );
  }

  const now = new Date();
  const decorated: SummaryBooking[] = (bookings ?? []).map((b) => {
    const completed = consultedSet.has(b.id);
    const apptTime = new Date(`${b.booking_date}T${b.booking_time}`);
    const within12h = apptTime.getTime() - now.getTime() <= 12 * 60 * 60 * 1000;
    return {
      id: b.id,
      customer_first_name: b.customer_first_name,
      customer_last_name: b.customer_last_name,
      treatment_name: b.treatment_name,
      booking_time: timeShort(b.booking_time),
      status: b.status as "pending" | "confirmed",
      consultation: completed
        ? "completed"
        : within12h
          ? "risk"
          : "pending",
    };
  });

  const confirmed = decorated.filter((b) => b.status === "confirmed");
  const pending = decorated.filter((b) => b.status === "pending");
  const alerts = decorated.filter(
    (b) => b.consultation === "risk" && b.status !== "pending"
  );
  // Pending alerts within 12 hours go in their own bucket too.
  for (const b of decorated) {
    if (
      b.status === "pending" &&
      b.consultation === "risk" &&
      !alerts.includes(b)
    ) {
      alerts.push(b);
    }
  }

  const siteUrl = new URL(req.url).origin;
  const adminUrl = `${siteUrl}/admin/bookings`;

  try {
    const html = await render(
      MorningSummary({
        todayLabel: formatLong(dateIso),
        confirmed,
        pending,
        alerts,
        adminUrl,
        siteUrl,
      })
    );
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: FROM,
      to: TO,
      subject: `Today's bookings — ${formatLong(dateIso)}`,
      html,
    });
    if (result.error) {
      console.error(
        "[cron morning-summary] Resend error:",
        JSON.stringify(result.error)
      );
      return NextResponse.json({ error: "Resend failed" }, { status: 500 });
    }
  } catch (err) {
    console.error(
      "[cron morning-summary] dispatch failed",
      JSON.stringify(err, Object.getOwnPropertyNames(err as object))
    );
    return NextResponse.json({ error: "Send threw" }, { status: 500 });
  }

  // Record that today's summary went out so subsequent cron runs skip.
  await supabaseAdmin
    .from("daily_summaries_sent")
    .insert({ summary_date: dateIso });

  return NextResponse.json({
    ok: true,
    sent: 1,
    confirmed: confirmed.length,
    pending: pending.length,
    alerts: alerts.length,
  });
}
