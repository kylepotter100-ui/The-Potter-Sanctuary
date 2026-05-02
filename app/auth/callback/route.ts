import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function safeNext(raw: string | null): string {
  if (!raw) return "/account";
  // Only allow same-origin relative paths. Reject protocol-relative ("//foo")
  // and absolute URLs to avoid open-redirect.
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/account";
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=could_not_authenticate", url.origin)
    );
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
    return NextResponse.redirect(
      new URL("/login?error=could_not_authenticate", url.origin)
    );
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
    return NextResponse.redirect(
      new URL("/login?error=could_not_authenticate", url.origin)
    );
  }

  // Best-effort: ensure a customer row exists for the authenticated user so
  // the rest of the app can rely on it. Failure here doesn't block sign-in.
  if (supabaseAdmin) {
    const email = user.email.toLowerCase();
    try {
      const { data: existing } = await supabaseAdmin
        .from("customers")
        .select("id, user_id")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        if (!existing.user_id) {
          await supabaseAdmin
            .from("customers")
            .update({ user_id: user.id, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        }
      } else {
        await supabaseAdmin.from("customers").insert({
          user_id: user.id,
          email,
        });
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
