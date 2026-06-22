import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import { supabaseAdmin } from "@/lib/supabase";
import { searchClients } from "@/lib/clients";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{ q?: string }>;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  if (!supabaseAdmin) {
    return (
      <>
        <AdminHeader active="clients" />
        <main className="admin-main">
          <h1>Clients</h1>
          <p className="lede">Supabase isn&apos;t configured yet.</p>
        </main>
      </>
    );
  }

  const clients = await searchClients(supabaseAdmin, query);

  return (
    <>
      <AdminHeader active="clients" />
      <main className="admin-main">
        <div className="admin-title-row">
          <div>
            <h1>Clients</h1>
            <p className="lede">Search and view client history.</p>
          </div>
          <Link
            href={`/admin/bookings/new?from=${encodeURIComponent("/admin/clients")}`}
            className="btn"
          >
            + New booking
          </Link>
        </div>

        {/* GET form → ?q= ; server-side filter (name / email / phone). */}
        <form className="admin-search-row" method="get" action="/admin/clients">
          <label className="admin-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search name, email or phone…"
              autoComplete="off"
            />
          </label>
          <button type="submit" className="btn btn-ghost">
            Search
          </button>
        </form>

        {clients.length === 0 ? (
          <div className="admin-card">
            {query
              ? `No clients match “${query}”.`
              : "No clients yet — they appear here as soon as a booking is made."}
          </div>
        ) : (
          <table className="admin-table admin-table-clickable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Visits</th>
                <th>Last visit</th>
                <th>Questionnaire</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="row-link">
                  <td data-label="Name">
                    <Link href={`/admin/clients/${c.id}`} className="row-link-target">
                      <span className="t-name">{c.fullName}</span>
                    </Link>
                  </td>
                  <td data-label="Contact">
                    <span className="muted">
                      {c.email}
                      {c.phone ? (
                        <>
                          <br />
                          {c.phone}
                        </>
                      ) : null}
                    </span>
                  </td>
                  <td data-label="Visits">{c.visits}</td>
                  <td data-label="Last visit">{fmtDate(c.lastVisit)}</td>
                  <td data-label="Questionnaire">
                    {c.hasQuestionnaire ? (
                      <span className="chip chip-ok">✓ Yes</span>
                    ) : (
                      <span className="chip chip-warn">— Not yet</span>
                    )}
                  </td>
                  <td data-label="" className="row-link-arrow">
                    <Link href={`/admin/clients/${c.id}`}>Open →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {clients.length > 0 && (
          <p className="count-note">
            Showing {clients.length} client{clients.length === 1 ? "" : "s"}
            {query ? ` matching “${query}”` : ""}.
          </p>
        )}
      </main>
    </>
  );
}
