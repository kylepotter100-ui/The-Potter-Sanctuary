"use client";

// MOCKUP ONLY — non-functional gift-voucher prototype. Everything here is local
// React state with hardcoded placeholder data. NO database, NO API calls, NO
// email, NO payment, NO persistence (a reload resets it). Built so the owner can
// react to the workflow before anything real is built.

import { useState } from "react";
import { services } from "@/lib/services";
import VoucherCard from "./VoucherCard";

function treatmentLabel(s: (typeof services)[number]): string {
  return `${s.name} ${s.nameEm}`.replace(/\s+/g, " ").trim();
}

// Mock unique-code generator (browser-only, prototype). Real version would mint
// a server-checked single-use code — see the "future real build" note.
function mockCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () =>
    Array.from({ length: 4 }, () =>
      alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join("");
  return `PS-${block()}-${block()}`;
}

type VoucherRow = {
  id: string;
  code: string;
  treatment: string;
  value: string;
  recipient: string;
  status: "active" | "redeemed";
  redeemedAgainst?: string;
};

// Placeholder issued vouchers.
const INITIAL_VOUCHERS: VoucherRow[] = [
  { id: "v1", code: "PS-7F2A-9K3D", treatment: "Full Body Aromatherapy", value: "£50", recipient: "Emma Harding", status: "active" },
  { id: "v2", code: "PS-3M8Q-4B6P", treatment: "Hot Stones Full Body", value: "£60", recipient: "Sophie Bennett", status: "active" },
  { id: "v3", code: "PS-9X1K-2T7R", treatment: "Back, Neck & Scalp", value: "£25", recipient: "James Whitfield", status: "redeemed", redeemedAgainst: "James Whitfield — Back, Neck & Scalp — 12 Jun" },
  { id: "v4", code: "PS-5H4D-8N2W", treatment: "Hot Stones Back", value: "£35", recipient: "Olivia Reed", status: "active" },
  { id: "v5", code: "PS-2K6P-7Q9F", treatment: "Full Body Aromatherapy", value: "£50", recipient: "Daniel Cole", status: "active" },
];

// Placeholder upcoming bookings to redeem a voucher against.
const MOCK_UPCOMING = [
  { id: "b1", label: "Carl Powell · Full Body Aromatherapy · 24 Jun" },
  { id: "b2", label: "Emma Harding · Full Body Aromatherapy · 26 Jun" },
  { id: "b3", label: "Sophie Bennett · Hot Stones Full Body · 28 Jun" },
  { id: "b4", label: "Olivia Reed · Hot Stones Back · 2 Jul" },
];

export default function VouchersPanel() {
  // ---- Create form (mock) ----
  const [treatmentSlug, setTreatmentSlug] = useState<string | null>(null);
  const [purchaser, setPurchaser] = useState("");
  const [recipient, setRecipient] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [generated, setGenerated] = useState<{
    treatment: string;
    price: string;
    code: string;
  } | null>(null);

  const selected = treatmentSlug
    ? services.find((s) => s.slug === treatmentSlug) ?? null
    : null;

  function generate() {
    if (!selected) return;
    setGenerated({
      treatment: treatmentLabel(selected),
      price: selected.priceLabel,
      code: mockCode(),
    });
  }
  function reset() {
    setGenerated(null);
    setTreatmentSlug(null);
    setPurchaser("");
    setRecipient("");
    setGiftMessage("");
  }

  // ---- Vouchers list + redemption (mock) ----
  const [vouchers, setVouchers] = useState<VoucherRow[]>(INITIAL_VOUCHERS);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeemBookingId, setRedeemBookingId] = useState<string>("");

  const redeemingVoucher = vouchers.find((v) => v.id === redeemingId) ?? null;

  function openRedeem(id: string) {
    setRedeemingId(id);
    setRedeemBookingId("");
  }
  function confirmRedeem() {
    if (!redeemingId || !redeemBookingId) return;
    const booking = MOCK_UPCOMING.find((b) => b.id === redeemBookingId);
    setVouchers((prev) =>
      prev.map((v) =>
        v.id === redeemingId
          ? {
              ...v,
              status: "redeemed",
              redeemedAgainst: booking
                ? booking.label.replace(/ · /g, " — ")
                : undefined,
            }
          : v
      )
    );
    setRedeemingId(null);
    setRedeemBookingId("");
  }

  return (
    <div className="vouchers-panel">
      <div className="admin-title-row">
        <div>
          <h1>Gift vouchers</h1>
          <p className="lede">Create a branded voucher and redeem it at the appointment.</p>
        </div>
      </div>

      <div className="voucher-mock-flag">
        Prototype — placeholder data only. Nothing here is saved or sent.
      </div>

      {/* ============ CREATE VOUCHER ============ */}
      <section className="admin-card voucher-create">
        <h2>Create a voucher</h2>
        <p className="lede" style={{ marginTop: 0 }}>
          You&apos;ve already been paid (bank transfer or cash). Create the voucher,
          then email the e-card to the buyer.
        </p>

        {!generated ? (
          <>
            <div className="field">
              <label>Treatment</label>
              <div className="voucher-svc-list">
                {services.map((s) => {
                  const on = treatmentSlug === s.slug;
                  return (
                    <button
                      type="button"
                      key={s.slug}
                      className={`svc-pick${on ? " is-on" : ""}`}
                      onClick={() => setTreatmentSlug(s.slug)}
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
              <strong>{selected ? selected.priceLabel : "—"}</strong>
            </div>

            <div className="field">
              <label htmlFor="v-purchaser">Purchaser name</label>
              <input
                id="v-purchaser"
                type="text"
                value={purchaser}
                onChange={(e) => setPurchaser(e.target.value)}
                placeholder="Who bought the voucher"
              />
            </div>
            <div className="field">
              <label htmlFor="v-recipient">Recipient name</label>
              <input
                id="v-recipient"
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Who it's for"
              />
            </div>
            <div className="field">
              <label htmlFor="v-message">Gift message (optional)</label>
              <textarea
                id="v-message"
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                placeholder="A short note to include"
              />
            </div>

            <button
              type="button"
              className="btn"
              disabled={!selected}
              onClick={generate}
            >
              Generate voucher
            </button>
          </>
        ) : (
          <div className="voucher-success">
            <div className="voucher-success-head">
              <span className="badge badge-confirmed">✓ Voucher created</span>
              <span className="voucher-success-code">{generated.code}</span>
            </div>
            <VoucherCard
              treatmentName={generated.treatment}
              price={generated.price}
              code={generated.code}
            />
            <p className="lede voucher-success-note">
              In the real version this e-card is emailed to the buyer
              {recipient ? <> for <strong>{recipient}</strong></> : null}. (Mockup —
              no email is sent.)
            </p>
            <button type="button" className="btn-ghost" onClick={reset}>
              Create another
            </button>
          </div>
        )}
      </section>

      {/* ============ E-CARD EXAMPLES ============ */}
      <section className="admin-card">
        <h2>E-card — every treatment</h2>
        <p className="lede" style={{ marginTop: 0 }}>
          One template, reworded per treatment. This is the image emailed to the
          buyer.
        </p>
        <div className="voucher-examples">
          {services.map((s) => (
            <VoucherCard
              key={s.slug}
              treatmentName={treatmentLabel(s)}
              price={s.priceLabel}
              code="PS-XXXX-XXXX"
            />
          ))}
        </div>
      </section>

      {/* ============ VOUCHERS LIST + REDEMPTION ============ */}
      <section className="admin-card">
        <h2>Issued vouchers</h2>
        <p className="voucher-flow-note">
          The client books an appointment as normal and brings their voucher. At
          the appointment, you find the voucher here and mark it redeemed against
          their booking — confirming it&apos;s already paid. (Clients don&apos;t
          enter codes online; you redeem on their behalf.)
        </p>

        <div className="voucher-list">
          {vouchers.map((v) => (
            <div key={v.id} className="voucher-row">
              <div className="voucher-row-main">
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
                  {v.treatment} · {v.value}
                </div>
                <div className="voucher-row-recipient">For {v.recipient}</div>
                {v.status === "redeemed" && v.redeemedAgainst && (
                  <div className="voucher-row-redeemed">
                    Redeemed against: {v.redeemedAgainst}
                  </div>
                )}
              </div>
              <div className="voucher-row-action">
                {v.status === "active" ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => openRedeem(v.id)}
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
      </section>

      {/* ============ REDEEM CONFIRMATION (mock modal) ============ */}
      {redeemingVoucher && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Redeem voucher against an appointment"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRedeemingId(null);
          }}
        >
          <div className="modal-card">
            <h3 className="modal-title">Redeem this voucher against an appointment</h3>
            <p style={{ fontSize: 13, color: "var(--admin-ink-soft)", margin: "0 0 14px" }}>
              {redeemingVoucher.code} · {redeemingVoucher.treatment} ·{" "}
              {redeemingVoucher.value}
            </p>
            <div className="field">
              <label htmlFor="redeem-booking">Upcoming appointment</label>
              <select
                id="redeem-booking"
                value={redeemBookingId}
                onChange={(e) => setRedeemBookingId(e.target.value)}
              >
                <option value="">Select an appointment…</option>
                {MOCK_UPCOMING.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <p style={{ fontSize: 12, color: "var(--admin-ink-soft)", margin: "0 0 14px" }}>
              Confirms the voucher covers this appointment (already paid). Mockup —
              nothing is saved.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setRedeemingId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={!redeemBookingId}
                onClick={confirmRedeem}
              >
                Confirm redemption
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
