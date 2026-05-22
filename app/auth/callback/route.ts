import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Legacy/safety-net route for old magic-link emails still sitting in
// inboxes. The primary auth path is now OTP-code via verifyOtp() from
// LoginForm, which doesn't pass through this route at all. If anything
// fails here we just send the user back to /login?expired=1 with a
// friendly message inviting them to request a fresh code.

function safeNext(raw: string | null): string {
  if (!raw) return "/account";
  // Only allow same-origin relative paths. Reject protocol-relative ("//foo")
  // and absolute URLs to avoid open-redirect.
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/account";
  // Strip URL fragments — Supabase's verifier sometimes decodes `%23` to
  // a literal `#`, which then chews up the appended `&code=…`.
  const hashIdx = raw.indexOf("#");
  return hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
}

function expiredRedirect(origin: string) {
  return NextResponse.redirect(new URL("/login?expired=1", origin));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) {
    return expiredRedirect(url.origin);
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code
  );
  if (exchangeError) {
    console.error(
      "[auth-callback]",
      JSON.stringify(exchangeError, Object.getOwnPropertyNames(exchangeError))
    );
    return expiredRedirect(url.origin);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user?.email) {
    console.error(
      "[auth-callback]",
      JSON.stringify(
        userError ?? { message: "no user after exchange" },
        userError ? Object.getOwnPropertyNames(userError) : undefined
      )
    );
    return expiredRedirect(url.origin);
  }

  // Sign-in is gated to existing customers (those who have booked before).
  // Link the auth user to their EXISTING customer record — never create a
  // new one here. If no matching customer exists, this is a stranger who
  // shouldn't have a session: sign them out and bounce to /login.
  if (supabaseAdmin) {
    const email = user.email.toLowerCase();
    try {
      const { data: existing } = await supabaseAdmin
        .from("customers")
        .select("id, user_id")
        .eq("email", email)
        .maybeSingle();

      if (!existing) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          new URL("/login?error=no_customer_record", url.origin)
        );
      }

      if (!existing.user_id) {
        await supabaseAdmin
          .from("customers")
          .update({ user_id: user.id, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
    } catch (err) {
      console.error(
        "[auth-callback]",
        JSON.stringify(err, Object.getOwnPropertyNames(err as object))
      );
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
