import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in — The Potter Sanctuary",
  description: "Sign in to your client account at The Potter Sanctuary.",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" && params.next.startsWith("/")
    ? params.next
    : "/account";
  const errorMessage = params.error;

  return (
    <main className="login-page">
      <div className="login-card">
        <Link href="/" className="login-brand">
          The Potter Sanctuary
        </Link>
        <h1>Welcome to your sanctuary</h1>
        <p className="login-lede">
          Enter your email and we'll send you a secure link to access your
          account — no password required.
        </p>
        {errorMessage && (
          <div role="alert" className="login-error login-error-banner">
            {decodeURIComponent(errorMessage)}
          </div>
        )}
        <LoginForm next={next} />
        <p className="login-foot">
          <Link href="/">← Back to the studio</Link>
        </p>
      </div>
    </main>
  );
}
