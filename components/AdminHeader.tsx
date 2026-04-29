import Link from "next/link";

type Props = {
  active?: "dashboard" | "bookings" | "availability";
};

export default function AdminHeader({ active }: Props) {
  return (
    <header className="admin-header">
      <Link href="/admin/dashboard" className="brand">
        The Potter Sanctuary <em>— Admin</em>
      </Link>
      <nav className="nav-links">
        <Link
          href="/admin/dashboard"
          className={active === "dashboard" ? "active" : undefined}
        >
          Dashboard
        </Link>
        <Link
          href="/admin/bookings"
          className={active === "bookings" ? "active" : undefined}
        >
          Bookings
        </Link>
        <Link
          href="/admin/availability"
          className={active === "availability" ? "active" : undefined}
        >
          Availability
        </Link>
      </nav>
      <form action="/api/admin/logout" method="post">
        <button type="submit" className="logout">
          Log out
        </button>
      </form>
    </header>
  );
}
