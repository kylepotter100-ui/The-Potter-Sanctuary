import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Set it in .env.local (local) or your Cloudflare Pages env (deployed).`
    );
  }
  return value;
}

/**
 * Browser-safe client. Uses the public anon key — RLS policies must allow
 * whatever this client is asked to do.
 */
export function getSupabaseClient(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", supabaseAnonKey),
    {
      auth: { persistSession: false },
    }
  );
}

export const supabaseClient: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? getSupabaseClient() : null;

/**
 * Service-role client. Bypasses RLS. Only use this in API routes and server
 * components — never expose to the browser.
 */
export function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", supabaseServiceRoleKey),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

export const supabaseAdmin: SupabaseClient | null =
  supabaseUrl && supabaseServiceRoleKey ? getSupabaseAdmin() : null;
