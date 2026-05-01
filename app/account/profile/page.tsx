import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import ProfileForm, { type ProfileSeed } from "@/components/ProfileForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your profile — The Potter Sanctuary",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user || !user.email) {
    redirect("/login?next=/account/profile");
  }

  if (!supabaseAdmin) {
    return (
      <main className="account-page">
        <div className="account-shell">
          <h1>Your profile</h1>
          <p className="account-empty">Supabase isn't configured yet.</p>
        </div>
      </main>
    );
  }

  const emailLower = user.email.toLowerCase();
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select(
      "full_name, date_of_birth, phone_number, address, emergency_contact_name, emergency_contact_phone"
    )
    .eq("email", emailLower)
    .maybeSingle();

  const seed: ProfileSeed = {
    full_name: customer?.full_name ?? null,
    date_of_birth: customer?.date_of_birth ?? null,
    phone_number: customer?.phone_number ?? null,
    address: customer?.address ?? null,
    emergency_contact_name: customer?.emergency_contact_name ?? null,
    emergency_contact_phone: customer?.emergency_contact_phone ?? null,
  };

  return (
    <main className="account-page">
      <div className="account-shell">
        <header className="account-header">
          <div>
            <h1>Your profile</h1>
            <div className="email">{user.email}</div>
          </div>
          <div className="account-actions">
            <Link href="/account" className="account-link">
              ← Back to account
            </Link>
          </div>
        </header>
        <ProfileForm seed={seed} email={user.email} />
      </div>
    </main>
  );
}
