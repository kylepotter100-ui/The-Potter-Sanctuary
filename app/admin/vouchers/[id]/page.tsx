import type { ReactNode } from "react";
import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import { supabaseAdmin } from "@/lib/supabase";
import { voucherValueLabel } from "@/lib/vouchers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = Promise<{ id: string }>;

type VoucherRow = {
  id: string;
  code: string;
  treatment_name: string;
  value: number;
  status: "active" | "redeemed";
  purchaser_name: string;
  purchaser_email: string;
  recipient_name: string;
  gift_message: string | null;
  created_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function fmtDateTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="voucher-detail-row">
      <span className="voucher-detail-label">{label}</span>
      <span className="voucher-detail-value">{value}</span>
    </div>
  );
}

export default async function VoucherDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const back = "/admin/bookings?tab=vouchers";

  if (!supabaseAdmin) {
    return (
      <>
        <AdminHeader active="bookings" />
        <main className="admin-main">
          <h1>Voucher</h1>
          <p className="lede">Supabase isn&apos;t configured yet.</p>
        </main>
      </>
    );
  }

  const { data: voucher } = await supabaseAdmin
    .from("vouchers")
    .select(
      "id, code, treatment_name, value, status, purchaser_name, purchaser_email, recipient_name, gift_message, created_at, expires_at, redeemed_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!voucher) {
    return (
      <>
        <AdminHeader active="bookings" />
        <main className="admin-main">
          <p style={{ marginBottom: 8 }}>
            <Link href={back} className="admin-back-link">
              ← Back to vouchers
            </Link>
          </p>
          <h1>Voucher not found</h1>
          <p className="lede">This voucher may have been deleted.</p>
        </main>
      </>
    );
  }

  const v = voucher as VoucherRow;
  const redeemed = v.status === "redeemed";

  return (
    <>
      <AdminHeader active="bookings" />
      <main className="admin-main">
        <p style={{ marginBottom: 8 }}>
          <Link href={back} className="admin-back-link">
            ← Back to vouchers
          </Link>
        </p>

        <div className="admin-title-row">
          <div>
            <h1 style={{ fontFamily: "var(--font-serif)" }}>Gift voucher</h1>
            <p className="lede" style={{ margin: 0 }}>{v.code}</p>
          </div>
          <span className={`badge ${redeemed ? "badge-cancelled" : "badge-confirmed"}`}>
            {redeemed ? "Redeemed" : "Active"}
          </span>
        </div>

        <section className="admin-card">
          <Row label="Voucher code" value={v.code} />
          <Row label="Treatment" value={v.treatment_name} />
          <Row label="Value" value={voucherValueLabel(v.value)} />
          <Row label="Status" value={redeemed ? "Redeemed" : "Active"} />
        </section>

        <section className="admin-card">
          <Row label="Purchased by" value={v.purchaser_name} />
          <Row label="Purchaser email" value={v.purchaser_email} />
          <Row label="Gifted to" value={v.recipient_name} />
          <Row
            label="Gift message"
            value={v.gift_message ? v.gift_message : <span className="muted">—</span>}
          />
        </section>

        <section className="admin-card">
          <Row label="Issued" value={fmtDateTime(v.created_at)} />
          <Row label="Valid until" value={fmtDate(v.expires_at)} />
          <Row
            label="Redeemed"
            value={redeemed ? fmtDateTime(v.redeemed_at) : <span className="muted">Not yet</span>}
          />
        </section>
      </main>
    </>
  );
}
