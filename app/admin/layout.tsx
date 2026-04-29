import "./admin.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin · The Potter Sanctuary",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="admin-shell">{children}</div>;
}
