import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { render } from "@react-email/render";
import VoucherDelivery from "@/emails/VoucherDelivery";
import { supabaseAdmin } from "@/lib/supabase";
import { siteConfig } from "@/lib/site";
import { services } from "@/lib/services";
import { generateVoucherCode } from "@/lib/vouchers";
import { ukTodayIso, addDaysIso } from "@/lib/uk-time";
import { formatLongDate } from "@/lib/format";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_VALUE } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const REPLY_TO = "hello@thepottersanctuary.co.uk";

async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get(ADMIN_SESSION_COOKIE)?.value === ADMIN_SESSION_VALUE;
}

type Body = {
  treatmentId?: string;
  purchaserName?: string;
  purchaserEmail?: string;
  recipientName?: string;
  giftMessage?: string;
  // Owner-only: issue this voucher free of charge (value 0). Safe to take from
  // the payload because this route is behind the admin session cookie — the
  // treatment's identity, name and list price still come from the server.
  complimentary?: boolean;
};

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
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

  const purchaserName = (body.purchaserName ?? "").trim();
  const purchaserEmail = (body.purchaserEmail ?? "").trim();
  const recipientName = (body.recipientName ?? "").trim();
  const giftMessage = (body.giftMessage ?? "").trim() || null;

  // Treatment truth comes from the server, never the client payload.
  const service = services.find((s) => s.bookingId === body.treatmentId);
  if (!service) {
    return NextResponse.json({ error: "Unknown treatment" }, { status: 400 });
  }
  if (
    !purchaserName ||
    !recipientName ||
    !/\S+@\S+\.\S+/.test(purchaserEmail)
  ) {
    return NextResponse.json(
      { error: "Missing or invalid required fields" },
      { status: 400 }
    );
  }

  const treatmentName = `${service.name} ${service.nameEm}`.replace(/\s+/g, " ").trim();
  // A complimentary voucher is stored as value 0 — see lib/vouchers.ts. That
  // keeps it out of dashboard revenue (which sums `value`) while the voucher
  // still issues, emails and redeems exactly like a paid one.
  const isComplimentary = body.complimentary === true;
  const value = isComplimentary ? 0 : service.price; // pounds
  const expiresAt = addDaysIso(ukTodayIso(), 365);

  // Insert with a unique code; on a 23505 collision, regenerate and retry.
  let inserted: { id: string; code: string } | null = null;
  for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
    const code = generateVoucherCode();
    const { data, error } = await supabaseAdmin
      .from("vouchers")
      .insert({
        code,
        treatment_id: service.bookingId,
        treatment_name: treatmentName,
        value,
        purchaser_name: purchaserName,
        purchaser_email: purchaserEmail,
        recipient_name: recipientName,
        gift_message: giftMessage,
        status: "active",
        expires_at: expiresAt,
      })
      .select("id, code")
      .single();

    if (!error && data) {
      inserted = data as { id: string; code: string };
      break;
    }
    const pgCode = (error as { code?: string } | null)?.code;
    if (pgCode === "23505") continue; // duplicate code — try another
    console.error("[admin vouchers] insert failed", JSON.stringify(error));
    return NextResponse.json(
      { error: "Could not create the voucher" },
      { status: 500 }
    );
  }
  if (!inserted) {
    return NextResponse.json(
      { error: "Could not allocate a unique code — please try again" },
      { status: 500 }
    );
  }

  // Email the e-card to the BUYER (best-effort — the voucher already exists, so a
  // send failure must not fail the request; delivery_email_sent_at records success
  // so a future resend path can tell). Mirrors the other transactional sends.
  let emailSent = false;
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const html = await render(
        VoucherDelivery({
          purchaserName,
          recipientName,
          treatmentName,
          value,
          code: inserted.code,
          giftMessage,
          expiresLabel: formatLongDate(expiresAt),
          siteUrl: siteConfig.url,
        })
      );
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from: FROM,
        to: purchaserEmail,
        replyTo: REPLY_TO,
        subject: "Your Potter Sanctuary gift voucher",
        html,
      });
      if (result.error) {
        console.error("[admin vouchers] Resend error:", JSON.stringify(result.error));
      } else {
        emailSent = true;
        await supabaseAdmin
          .from("vouchers")
          .update({ delivery_email_sent_at: new Date().toISOString() })
          .eq("id", inserted.id);
      }
    } catch (err) {
      console.error(
        "[admin vouchers] dispatch failed",
        JSON.stringify(err, Object.getOwnPropertyNames(err as object))
      );
    }
  } else {
    console.error("[admin vouchers] RESEND_API_KEY missing — delivery email skipped");
  }

  return NextResponse.json({
    ok: true,
    emailSent,
    voucher: {
      id: inserted.id,
      code: inserted.code,
      treatmentName,
      value,
      recipientName,
      purchaserEmail,
    },
  });
}
