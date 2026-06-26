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
};

// Placeholder issued vouchers.
const INITIAL_VOUCHERS: VoucherRow[] = [
  { id: "v1", code: "PS-7F2A-9K3D", treatment: "Full Body Aromatherapy", value: "£50", recipient: "Emma Harding", status: "active" },
  { id: "v2", code: "PS-3M8Q-4B6P", treatment: "Hot Stones Full Body", value: "£60", recipient: "Sophie Bennett", status: "active" },
  { id: "v3", code: "PS-9X1K-2T7R", treatment: "Back, Neck & Scalp", value: "£25", recipient: "James Whitfield", status: "redeemed" },
  { id: "v4", code: "PS-5H4D-8N2W", treatment: "Hot Stones Back", value: "£35", recipient: "Olivia Reed", status: "active" },
  { id: "v5", code: "PS-2K6P-7Q9F", treatment: "Full Body Aromatherapy", value: "£50", recipient: "Daniel Cole", status: "active" },
];

export default function VouchersPanel() {
  // ---- Create form (mock) ----
  const [treatmentSlug, setTreatmentSlug] = useState<string | null>(null);
  const [purchaser, setPurchaser] = useState("");
  const [purchaserEmail, setPurchaserEmail] = useState("");
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

  const canGenerate =
    !!selected &&
    !!purchaser.trim() &&
    !!purchaserEmail.trim() &&
    !!recipient.trim();

  function generate() {
    if (!canGenerate || !selected) return;
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
    setPurchaserEmail("");
    setRecipient("");
    setGiftMessage("");
  }

  // ---- Vouchers list + redemption (mock) — simply marks the row redeemed ----
  const [vouchers, setVouchers] = useState<VoucherRow[]>(INITIAL_VOUCHERS);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const redeemingVoucher = vouchers.find((v) => v.id === redeemingId) ?? null;

  function confirmRedeem() {
    if (!redeemingId) return;
    setVouchers((prev) =>
      prev.map((v) =>
        v.id === redeemingId ? { ...v, status: "redeemed" } : v
      )
    );
    setRedeemingId(null);
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
          You&apos;ve already been paid (bank transfer or cash). Create the
          voucher, then it&apos;s emailed to the buyer.
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

            {/* Purchaser (the buyer) */}
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

            {/* Recipient (who it's for) */}
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

            <button
              type="button"
              className="btn"
              disabled={!canGenerate}
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
              This e-card is emailed to the buyer
              {purchaserEmail ? (
                <> at <strong>{purchaserEmail}</strong></>
              ) : null}
              , who gives it to {recipient || "the recipient"}. (Mockup — no
              email is sent.)
            </p>
            <button type="button" className="btn-ghost" onClick={reset}>
              Create another
            </button>
          </div>
        )}
      </section>

      {/* ============ VOUCHERS LIST + REDEMPTION ============ */}
      <section className="admin-card">
        <h2>Issued vouchers</h2>
        <p className="voucher-flow-note">
          The client books an appointment as normal and brings their voucher. At
          the appointment, you find the voucher here and mark it redeemed —
          confirming it&apos;s already paid. (Clients don&apos;t enter codes
          online; you redeem on their behalf.)
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
              </div>
              <div className="voucher-row-action">
                {v.status === "active" ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setRedeemingId(v.id)}
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

      {/* ============ REDEEM CONFIRMATION (simple — no booking) ============ */}
      {redeemingVoucher && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Mark voucher redeemed"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRedeemingId(null);
          }}
        >
          <div className="modal-card">
            <h3 className="modal-title">Mark voucher redeemed?</h3>
            <p style={{ fontSize: 13, color: "var(--admin-ink-soft)", margin: "0 0 8px" }}>
              {redeemingVoucher.code} · {redeemingVoucher.treatment} ·{" "}
              {redeemingVoucher.value} · for {redeemingVoucher.recipient}
            </p>
            <p style={{ fontSize: 13, color: "var(--admin-ink-soft)", margin: 0 }}>
              This marks the voucher as used. Mockup — nothing is saved.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setRedeemingId(null)}
              >
                Cancel
              </button>
              <button type="button" className="btn" onClick={confirmRedeem}>
                Mark redeemed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
