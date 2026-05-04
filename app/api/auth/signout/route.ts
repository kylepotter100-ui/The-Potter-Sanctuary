import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch (error) {
    // If Supabase is unreachable we still want the user to land back on
    // the homepage with a sense that they've been signed out — the
    // session cookie is invalidated by the redirect chain regardless.
    console.error(
      "[signout] error:",
      JSON.stringify(error, Object.getOwnPropertyNames(error as object))
    );
  }
  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/", url.origin), { status: 303 });
}
