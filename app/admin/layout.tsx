import "./admin.css";
import type { Metadata, Viewport } from "next";
import AdminTabBar from "@/components/AdminTabBar";
import AdminServiceWorker from "@/components/AdminServiceWorker";

export const metadata: Metadata = {
  title: "Admin · The Potter Sanctuary",
  robots: { index: false, follow: false },
  // Admin-only PWA. Next merges metadata down the segment tree, so the manifest
  // link + apple meta render on /admin/* only — the public site is untouched.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Sanctuary Admin",
    statusBarStyle: "default",
  },
  // Next 15 emits the modern `mobile-web-app-capable`; also emit the legacy
  // `apple-mobile-web-app-capable` for maximum iOS standalone compatibility.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

// Admin-scoped viewport. Next.js merges viewport down the segment tree, so this
// applies to /admin/* only — the public site keeps the root viewport (no cover).
// viewportFit:"cover" is required for env(safe-area-inset-*) to resolve to real
// values, which the bottom tab bar relies on to clear the iOS home indicator.
export const viewport: Viewport = {
  themeColor: "#8A9E85",
  viewportFit: "cover",
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
      <AdminServiceWorker />
    </div>
  );
}
