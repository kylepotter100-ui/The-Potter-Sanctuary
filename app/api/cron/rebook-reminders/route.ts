import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import RebookReminder from "@/emails/RebookReminder";
import { supabaseAdmin } from "@/lib/supabase";
import { siteConfig } from "@/lib/site";
import { sendCustomerEmail } from "@/lib/customer-email";
import { postVisitExtras } from "@/lib/services";
import { addDaysIso, ukTodayIso } from "@/lib/uk-time";
import {
  REBOOK_AFTER_DAYS,
  REBOOK_WINDOW_DAYS,
  unsubscribeHeaders,
  unsubscribeUrl,
} from "@/lib/marketing";

export const dynamic = "force-dynamic";

const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const REPLY_TO = "hello@thepottersanctuary.co.uk";

// Daily (dispatched by worker.mjs in the 10am UK hour). "Time for your next
// treatment" for clients who OPTED IN to marketing, whose most recent visit was
// REBOOK_AFTER_DAYS..+WINDOW days ago, who have nothing else booked and didn't
// no-show. Claim-then-send on bookings.rebook_reminder_sent_at (rule 7), and
// every send goes through the contact-preference gate.
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 500 });

  const today = ukTodayIso();
  const newest = addDaysIso(today, -REBOOK_AFTER_DAYS);
  const oldest = addDaysIso(today, -(REBOOK_AFTER_DAYS + REBOOK_WINDOW_DAYS));

  const { data: visits, error } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("status", "confirmed")
    .gte("booking_date", oldest)
    .lte("booking_date", newest)
    .is("rebook_reminder_sent_at", null);
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") {
      return NextResponse.json({ ok: true, skipped: "migration_pending" });
    }
    console.error("[cron rebook] query failed", error.code, error.message);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
  type V = { id: string; customer_id: string | null; customer_first_name: string; customer_email: string | null; treatment_id: string; treatment_name: string; booking_date: string; attendance?: string | null };
  const rows = ((visits ?? []) as V[]).filter((v) => v.customer_id && v.attendance !== "no_show");
  const customerIds = Array.from(new Set(rows.map((r) => r.customer_id as string)));
  if (customerIds.length === 0) return NextResponse.json({ ok: true, candidates: 0, sent: 0 });

  const [{ data: custs }, { data: later }] = await Promise.all([
    supabaseAdmin.from("customers").select("*").in("id", customerIds).eq("marketing_opt_in", true),
    // Any booking after the window start that's still live or in the future —
    // a newer visit or an upcoming appointment means no nudge is needed.
    supabaseAdmin
      .from("bookings")
      .select("customer_id, booking_date, status")
      .in("customer_id", customerIds)
      .gt("booking_date", oldest)
      .in("status", ["pending", "confirmed"]),
  ]);
  const optedIn = new Map(((custs ?? []) as { id: string; unsubscribe_token: string }[]).map((c) => [c.id, c]));

  const resend = new Resend(apiKey);
  let sent = 0;
  let skipped = 0;
  for (const v of rows) {
    const c = optedIn.get(v.customer_id as string);
    const hasNewer = ((later ?? []) as { customer_id: string; booking_date: string }[]).some(
      (b) => b.customer_id === v.customer_id && b.booking_date > v.booking_date
    );
    if (!c || hasNewer) {
      skipped++;
      continue;
    }
    const { data: claimed } = await supabaseAdmin
      .from("bookings")
      .update({ rebook_reminder_sent_at: new Date().toISOString() })
      .eq("id", v.id)
      .is("rebook_reminder_sent_at", null)
      .select("id");
    if (!claimed?.length) {
      skipped++;
      continue;
    }
    try {
      const unsub = unsubscribeUrl(c.unsubscribe_token);
      const html = await render(
        RebookReminder({
          firstName: v.customer_first_name,
          treatmentName: v.treatment_name,
          rebookUrl: postVisitExtras(v.treatment_id, siteConfig.url).rebookUrl,
          unsubscribeUrl: unsub,
          siteUrl: siteConfig.url,
        })
      );
      const result = await sendCustomerEmail(resend, v.id, {
        from: FROM,
        to: v.customer_email ?? "",
        replyTo: REPLY_TO,
        subject: `Time for your next ${v.treatment_name}? — The Potter Sanctuary`,
        html,
        headers: unsubscribeHeaders(c.unsubscribe_token),
      });
      if (result.error) {
        await supabaseAdmin.from("bookings").update({ rebook_reminder_sent_at: null }).eq("id", v.id);
        continue;
      }
      if (result.skipped) {
        skipped++;
        continue;
      }
      sent++;
    } catch (err) {
      console.error("[cron rebook] send failed", String(err));
      await supabaseAdmin.from("bookings").update({ rebook_reminder_sent_at: null }).eq("id", v.id);
    }
  }
  return NextResponse.json({ ok: true, candidates: rows.length, sent, skipped });
}
