"use client";

// Admin gift-voucher panel (Vouchers segment of the Bookings page). Owner-
// initiated: create a voucher (the buyer is emailed the e-card) and redeem it at
// the appointment. The issued list is server-fed via the `vouchers` prop; after
// a create/redeem we call router.refresh() to re-pull it.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { services } from "@/lib/services";
import { voucherValueLabel } from "@/lib/vouchers";
import VoucherCard from "./VoucherCard";

export type VoucherListItem = {
  id: string;
  code: string;
  treatment_name: string;
  value: number;
  recipient_name: string;
  status: "active" | "redeemed";
};

function treatmentLabel(s: (typeof services)[number]): string {
  return `${s.name} ${s.nameEm}`.replace(/\s+/g, " ").trim();
}

type Created = {
  treatmentName: string;
  value: number;
  code: string;
  recipientName: string;
  purchaserEmail: string;
  emailSent: boolean;
};

export default function VouchersPanel({
  vouchers,
}: {
  vouchers: VoucherListItem[];
}) {
  const router = useRouter();

  // ---- Create form ----
  const [treatmentId, setTreatmentId] = useState<string | null>(null);
  const [purchaser, setPurchaser] = useState("");
  const [purchaserEmail, setPurchaserEmail] = useState("");
  const [recipient, setRecipient] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [complimentary, setComplimentary] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  const selected = treatmentId
    ? services.find((s) => s.bookingId === treatmentId) ?? null
    : null;
  const canCreate =
    !!selected &&
    !!purchaser.trim() &&
    /\S+@\S+\.\S+/.test(purchaserEmail.trim()) &&
    !!recipient.trim();

  async function create() {
    if (!canCreate || !selected) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treatmentId: selected.bookingId,
          purchaserName: purchaser.trim(),
          purchaserEmail: purchaserEmail.trim(),
          recipientName: recipient.trim(),
          giftMessage: giftMessage.trim() || undefined,
          complimentary,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; emailSent?: boolean; voucher?: { treatmentName: string; value: number; code: string; recipientName: string; purchaserEmail: string }; error?: string; message?: string }
        | null;
      if (!res.ok || !body?.ok || !body.voucher) {
        throw new Error(body?.message || body?.error || "Could not create the voucher");
      }
      setCreated({ ...body.voucher, emailSent: !!body.emailSent });
      router.refresh(); // so the new voucher shows in the issued list
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create the voucher");
    } finally {
      setCreating(false);
    }
  }
  function reset() {
    setCreated(null);
    setTreatmentId(null);
    setPurchaser("");
    setPurchaserEmail("");
    setRecipient("");
    setGiftMessage("");
    setComplimentary(false);
    setCreateError(null);
  }

  // ---- Redeem ----
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const redeemingVoucher = vouchers.find((v) => v.id === redeemingId) ?? null;

  async function confirmRedeem() {
    if (!redeemingId) return;
    setRedeeming(true);
    setRedeemError(null);
    try {
      const res = await fetch(`/api/admin/vouchers/${redeemingId}/redeem`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; message?: string }
        | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.message || body?.error || "Could not redeem the voucher");
      }
      setRedeemingId(null);
      router.refresh();
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : "Could not redeem the voucher");
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <div className="vouchers-panel">
      <div className="admin-title-row">
        <div>
          <h1>Gift vouchers</h1>
          <p className="lede">Create a branded voucher and redeem it at the appointment.</p>
        </div>
      </div>

      {/* ============ CREATE ============ */}
      <section className="admin-card voucher-create">
        <h2>Create a voucher</h2>
        <p className="lede" style={{ marginTop: 0 }}>
          {complimentary ? (
            <>
              This one&apos;s on the house — nothing to collect. Create the
              voucher, then it&apos;s emailed to the recipient.
            </>
          ) : (
            <>
              You&apos;ve already been paid (bank transfer or cash). Create the
              voucher, then it&apos;s emailed to the buyer.
            </>
          )}
        </p>

        {!created ? (
          <>
            <div className="field">
              <label>Treatment</label>
              <div className="voucher-svc-list">
                {services.map((s) => {
                  const on = treatmentId === s.bookingId;
                  return (
                    <button
                      type="button"
                      key={s.bookingId}
                      className={`svc-pick${on ? " is-on" : ""}`}
                      onClick={() => setTreatmentId(s.bookingId)}
                      aria-pressed={on}
                    >
                      <span className="svc-pick-meta">
                        <span className="svc-pick-name">{treatmentLabel(s)}</span>
                        <span className="svc-pick-dur">{s.duration}</span>
                      </span>
                      <span className="svc-pick-price">{s.priceLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="voucher-price-line">
              <span>Voucher value</span>
              <strong>
                {complimentary
                  ? "Complimentary"
                  : selected
                    ? selected.priceLabel
                    : "—"}
              </strong>
            </div>

            <div className="voucher-group voucher-comp-group">
              <div className="voucher-group-h">Complimentary</div>
              <label className="voucher-comp">
                <input
                  type="checkbox"
                  checked={complimentary}
                  onChange={(e) => setComplimentary(e.target.checked)}
                />
                <span>Give this treatment free of charge</span>
              </label>
              <div className="voucher-group-sub">
                The voucher is issued at £0, so it doesn&apos;t count towards
                your revenue figures. It still emails and redeems as normal.
              </div>
            </div>

            <div className="voucher-group">
              <div className="voucher-group-h">Purchaser — the buyer</div>
              <div className="voucher-group-sub">
                The voucher e-card is emailed to this address; the buyer then
                gives it to the recipient.
              </div>
              <div className="field">
                <label htmlFor="v-purchaser">Purchaser name</label>
                <input
                  id="v-purchaser"
                  type="text"
                  value={purchaser}
                  onChange={(e) => setPurchaser(e.target.value)}
                  placeholder="e.g. Sophie Bennett"
                />
              </div>
              <div className="field">
                <label htmlFor="v-purchaser-email">Purchaser email</label>
                <input
                  id="v-purchaser-email"
                  type="email"
                  value={purchaserEmail}
                  onChange={(e) => setPurchaserEmail(e.target.value)}
                  placeholder="buyer@email.com"
                />
              </div>
            </div>

            <div className="voucher-group">
              <div className="voucher-group-h">Recipient — who it&apos;s for</div>
              <div className="voucher-group-sub">
                The person being gifted the treatment — their name is shown on
                the voucher.
              </div>
              <div className="field">
                <label htmlFor="v-recipient">Recipient name</label>
                <input
                  id="v-recipient"
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="e.g. Emma Harding"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="v-message">Gift message (optional)</label>
              <textarea
                id="v-message"
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                placeholder="A short note to include on the email"
              />
            </div>

            {createError && (
              <div role="alert" className="modal-error" style={{ marginBottom: 12 }}>
                {createError}
              </div>
            )}

            <button
              type="button"
              className="btn"
              disabled={!canCreate || creating}
              onClick={create}
            >
              {creating ? "Creating…" : "Generate voucher"}
            </button>
          </>
        ) : (
          <div className="voucher-success">
            <div className="voucher-success-head">
              <span className="badge badge-confirmed">✓ Voucher created</span>
              <span className="voucher-success-code">{created.code}</span>
            </div>
            <VoucherCard
              treatmentName={created.treatmentName}
              price={voucherValueLabel(created.value)}
              code={created.code}
            />
            <p className="lede voucher-success-note">
              {created.emailSent ? (
                <>Emailed to <strong>{created.purchaserEmail}</strong>, who gives it to {created.recipientName}.</>
              ) : (
                <>Voucher created. The delivery email couldn&apos;t be sent just now — check the email settings.</>
              )}
            </p>
            <button type="button" className="btn-ghost" onClick={reset}>
              Create another
            </button>
          </div>
        )}
      </section>

      {/* ============ ISSUED LIST + REDEEM ============ */}
      <section className="admin-card">
        <h2>Issued vouchers</h2>
        <p className="voucher-flow-note">
          The client books an appointment as normal and brings their voucher. At
          the appointment, you find the voucher here and mark it redeemed —
          confirming it&apos;s already paid. (Clients don&apos;t enter codes
          online; you redeem on their behalf.)
        </p>

        {vouchers.length === 0 ? (
          <p className="lede" style={{ margin: 0 }}>No vouchers issued yet.</p>
        ) : (
          <div className="voucher-list">
            {vouchers.map((v) => (
              <div key={v.id} className="voucher-row">
                <Link href={`/admin/vouchers/${v.id}`} className="voucher-row-main">
                  <div className="voucher-row-top">
                    <span className="voucher-row-code">{v.code}</span>
                    <span
                      className={`badge ${
                        v.status === "active" ? "badge-confirmed" : "badge-cancelled"
                      }`}
                    >
                      {v.status === "active" ? "Active" : "Redeemed"}
                    </span>
                  </div>
                  <div className="voucher-row-treat">
                    {v.treatment_name} · {voucherValueLabel(v.value)}
                  </div>
                  <div className="voucher-row-recipient">For {v.recipient_name}</div>
                </Link>
                <div className="voucher-row-action">
                  {v.status === "active" ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        setRedeemError(null);
                        setRedeemingId(v.id);
                      }}
                    >
                      Mark redeemed
                    </button>
                  ) : (
                    <button type="button" className="btn btn-sm" disabled>
                      Redeemed
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ============ REDEEM CONFIRM ============ */}
      {redeemingVoucher && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Mark voucher redeemed"
          onClick={(e) => {
            if (e.target === e.currentTarget && !redeeming) setRedeemingId(null);
          }}
        >
          <div className="modal-card">
            <h3 className="modal-title">Mark voucher redeemed?</h3>
            <p style={{ fontSize: 13, color: "var(--admin-ink-soft)", margin: "0 0 8px" }}>
              {redeemingVoucher.code} · {redeemingVoucher.treatment_name} ·{" "}
              {voucherValueLabel(redeemingVoucher.value)} · for{" "}
              {redeemingVoucher.recipient_name}
            </p>
            <p style={{ fontSize: 13, color: "var(--admin-ink-soft)", margin: 0 }}>
              This marks the voucher as used and can&apos;t be undone.
            </p>
            {redeemError && (
              <div role="alert" className="modal-error" style={{ marginTop: 12 }}>
                {redeemError}
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setRedeemingId(null)}
                disabled={redeeming}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={confirmRedeem}
                disabled={redeeming}
              >
                {redeeming ? "Redeeming…" : "Mark redeemed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
