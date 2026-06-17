import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";

// Shared building blocks for the per-route admin loading skeletons. The header
// (and the tab bar from the layout) render instantly, so only the data area
// shows placeholders — navigation feels immediate instead of blank.

type Active = "dashboard" | "bookings" | "availability";

/** A single shimmer bar. Width/height are caller-controlled to match content. */
export function SkLine({ w = "100%", h }: { w?: string; h?: number }) {
  return (
    <span
      className="sk-line"
      style={{ width: w, ...(h ? { height: h } : null) }}
      aria-hidden="true"
    />
  );
}

/** A content card placeholder reusing the real `.admin-card` look. */
export function SkCard({ children }: { children: React.ReactNode }) {
  return <div className="admin-card sk-card">{children}</div>;
}

export default function AdminSkeleton({
  active,
  back,
  title,
  lede,
  children,
}: {
  active?: Active;
  back?: { href: string; label: string };
  title?: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminHeader active={active} />
      <main className="admin-main" aria-busy="true">
        {back && (
          <p style={{ marginBottom: 8 }}>
            <Link href={back.href} className="admin-back-link">
              {back.label}
            </Link>
          </p>
        )}
        {title && <h1>{title}</h1>}
        {lede && <p className="lede">{lede}</p>}
        {children}
      </main>
    </>
  );
}
