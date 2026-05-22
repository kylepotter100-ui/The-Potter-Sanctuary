import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Pre-flight for the OTP sign-in flow. Sign-in is gated to EXISTING
// customers (people who have booked before). A verified customer who has
// never signed in has a `customers` row but no Supabase auth user yet — and
// the project blocks public OTP signups, so their first `signInWithOtp`
// fails with "Signups not allowed for otp".
//
// Workaround: once the customer check passes, pre-create the auth user with
// the service role (which bypasses the public-signup gate). The client then
// calls signInWithOtp with shouldCreateUser:false, so the OTP just sends to
// a user that already exists — no signup path, no 422.
//
// Security boundary: the `customers` lookup below. Only an email that
// already has a customer record reaches createUser; everyone else gets
// { exists: false } and no auth user is created.
export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Auth is not configured." },
      { status: 503 }
    );
  }

  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return NextResponse.json({ exists: false });
  }

  try {
    // Step 1 — gate: must be an existing customer.
    const { data: customer, error: customerErr } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (customerErr) throw customerErr;
    if (!customer) {
      return NextResponse.json(
        { exists: false },
        { headers: { "Cache-Control": "private, no-cache, no-store" } }
      );
    }

    // Step 2 — ensure an auth user exists for this email. We attempt the
    // create directly and treat an "already registered" response as success.
    // This is race-free and avoids paging through admin.listUsers().
    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      // We already trust this email via the customer record, so skip the
      // confirmation flow — the OTP itself is the verification.
      email_confirm: true,
    });
    if (createErr && !isAlreadyRegistered(createErr)) {
      throw createErr;
    }

    return NextResponse.json(
      { exists: true },
      { headers: { "Cache-Control": "private, no-cache, no-store" } }
    );
  } catch (err) {
    console.error(
      "[api/customer/prepare-signin]",
      JSON.stringify(err, Object.getOwnPropertyNames(err as object))
    );
    return NextResponse.json(
      { error: "Could not prepare sign-in. Please try again." },
      { status: 500 }
    );
  }
}

// admin.createUser returns a 422 with code "email_exists" when the address is
// already registered. That's the happy path for a returning customer — the
// auth user is already there, so there's nothing to create.
function isAlreadyRegistered(err: unknown): boolean {
  const e = err as { code?: string; status?: number; message?: string };
  return (
    e.code === "email_exists" ||
    e.status === 422 ||
    /already.*(registered|exist)/i.test(e.message ?? "")
  );
}
