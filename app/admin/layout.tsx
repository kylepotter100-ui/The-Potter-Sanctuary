import "./admin.css";
import type { Metadata } from "next";
import AdminTabBar from "@/components/AdminTabBar";

export const metadata: Metadata = {
  title: "Admin · The Potter Sanctuary",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      {children}
      <AdminTabBar />
    </div>
  );
}
