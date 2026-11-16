import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { searchClients } from "@/lib/clients";

export const dynamic = "force-dynamic";


// Admin-only client search (name / email / phone) used by the manual-booking
// page's "find existing client" typeahead.
export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ clients: [] });

  const clients = await searchClients(supabaseAdmin, q);
  return NextResponse.json({ clients });
}
