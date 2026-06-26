import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_VALUE } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get(ADMIN_SESSION_COOKIE)?.value === ADMIN_SESSION_VALUE;
}

// Mark a voucher redeemed — single-use. The conditional update (status='active')
// is the guard: a second redeem matches zero rows and returns 409, so a
// photocopied/forwarded voucher can never be redeemed twice.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }

  const { id } = await params;

  const { data: rows, error } = await supabaseAdmin
    .from("vouchers")
    .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "active")
    .select("id, code, status, redeemed_at");

  if (error) {
    console.error("[admin vouchers redeem] update failed", JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json(
      {
        error: "already_redeemed",
        message: "This voucher can't be redeemed — it may already be used.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, voucher: rows[0] });
}
