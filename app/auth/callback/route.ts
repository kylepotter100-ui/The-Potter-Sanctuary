import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/account";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (user?.email && supabaseAdmin) {
    const email = user.email.toLowerCase();
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
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
