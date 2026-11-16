import type { Resend } from "resend";
import { toPlainText } from "@react-email/render";
import { supabaseAdmin } from "@/lib/supabase";

// THE gate for every automated email to a CLIENT about a booking
// (confirmation, reminders, questionnaire nudges, review requests,
// reschedule/cancel/treatment-change notices). Owner notifications don't go
// through here.
//
// A booking may not be emailed when:
//   - it has no email address (phone-only manual booking);
//   - the owner ticked "don't email this client" on it (suppress_comms);
//   - the client's contact preference is 'phone' or 'none'.
//
// Before migration 20261117_contact_preferences is applied those columns
// don't exist; that is detected and treated as "email allowed" (nobody can
// have opted out yet), so deploying this code first changes nothing.
// Any OTHER lookup failure fails CLOSED — better a missed email than
// emailing someone who asked not to be.

export type CommsDecision =
  | { allowed: true }
  | { allowed: false; reason: "no_email" | "suppressed" | "phone_only" | "no_contact" | "lookup_failed" };

type SendArgs = Parameters<Resend["emails"]["send"]>[0];
export type SendResult = { error: unknown; skipped?: Exclude<CommsDecision, { allowed: true }>["reason"] };

const SCHEMA_MISSING = new Set(["42703", "PGRST204", "PGRST200"]);

export async function customerCommsDecision(bookingId: string): Promise<CommsDecision> {
  if (!supabaseAdmin) return { allowed: false, reason: "lookup_failed" };
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("customer_email, suppress_comms, comms_customer:customers(contact_preference)")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) {
    if (SCHEMA_MISSING.has((error as { code?: string }).code ?? "")) {
      return { allowed: true }; // pre-migration: legacy behaviour
    }
    console.error("[customer-email] lookup failed — not sending", error.code, error.message);
    return { allowed: false, reason: "lookup_failed" };
  }
  if (!data || !data.customer_email) return { allowed: false, reason: "no_email" };
  if (data.suppress_comms) return { allowed: false, reason: "suppressed" };
  const rel = data.comms_customer as { contact_preference?: string } | { contact_preference?: string }[] | null;
  const pref = (Array.isArray(rel) ? rel[0] : rel)?.contact_preference ?? "email";
  if (pref === "phone") return { allowed: false, reason: "phone_only" };
  if (pref === "none") return { allowed: false, reason: "no_contact" };
  return { allowed: true };
}

/** Send a client email about `bookingId`, unless the gate says no. */
export async function sendCustomerEmail(
  resend: Resend,
  bookingId: string,
  msg: SendArgs
): Promise<SendResult> {
  const decision = await customerCommsDecision(bookingId);
  if (!decision.allowed) {
    console.log(`[customer-email] not sent (${decision.reason}) booking=${bookingId}`);
    return { error: null, skipped: decision.reason };
  }
  // Plain-text alternative: better deliverability (spam filters favour
  // multipart mail) and readable in text-only clients and screen readers.
  const withText =
    typeof (msg as { html?: unknown }).html === "string" && !(msg as { text?: unknown }).text
      ? ({ ...msg, text: toPlainText((msg as { html: string }).html) } as SendArgs)
      : msg;
  const r = (await resend.emails.send(withText)) as { error: unknown };
  return { error: r.error };
}

export const COMMS_REASON_LABEL: Record<string, string> = {
  no_email: "no email address on file",
  suppressed: "set to 'don't email' for this booking",
  phone_only: "client prefers a phone call",
  no_contact: "client asked not to be contacted",
  lookup_failed: "couldn't check contact preferences",
};
