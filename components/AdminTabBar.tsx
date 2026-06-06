"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// App-style bottom navigation for the admin area. Visible only at the mobile
// breakpoint (and in the installed PWA) via CSS; hidden on desktop where the
// AdminHeader nav takes over. Rendered once from app/admin/layout.tsx.

type Tab = {
  href: string;
  label: string;
  isActive: (path: string) => boolean;
  icon: React.ReactNode;
};

const TABS: Tab[] = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    isActive: (p) => p === "/admin/dashboard",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/admin/bookings",
    label: "Bookings",
    // Stays active on /admin/bookings/[id] detail pages.
    isActive: (p) => p.startsWith("/admin/bookings"),
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
        <path d="M3 9.5h18" />
        <path d="M8 2.5v4" />
        <path d="M16 2.5v4" />
      </svg>
    ),
  },
  {
    href: "/admin/availability",
    label: "Availability",
    isActive: (p) => p.startsWith("/admin/availability"),
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5l3.2 2" />
      </svg>
    ),
  },
];

export default function AdminTabBar() {
  const pathname = usePathname();

  // Never show on the unauthenticated login route (/admin) — only on the
  // authenticated sub-pages. The admin layout wraps the login page too.
  if (!pathname || pathname === "/admin") return null;

  return (
    <nav className="admin-tabbar" aria-label="Admin sections">
      {TABS.map((tab) => {
        const active = tab.isActive(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`admin-tab${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="admin-tab-icon">{tab.icon}</span>
            <span className="admin-tab-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
