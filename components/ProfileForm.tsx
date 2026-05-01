"use client";

import { useState } from "react";

export type ProfileSeed = {
  full_name: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};

type Props = {
  seed: ProfileSeed;
  email: string;
};

export default function ProfileForm({ seed, email }: Props) {
  const [fullName, setFullName] = useState(seed.full_name ?? "");
  const [dob, setDob] = useState(seed.date_of_birth ?? "");
  const [phone, setPhone] = useState(seed.phone_number ?? "");
  const [address, setAddress] = useState(seed.address ?? "");
  const [emName, setEmName] = useState(seed.emergency_contact_name ?? "");
  const [emPhone, setEmPhone] = useState(seed.emergency_contact_phone ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim() || null,
          date_of_birth: dob || null,
          phone_number: phone.trim() || null,
          address: address.trim() || null,
          emergency_contact_name: emName.trim() || null,
          emergency_contact_phone: emPhone.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "Save failed");
      }
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="account-section" noValidate>
      <h2>Your details</h2>
      <div className="q-grid">
        <div className="q-field full">
          <label htmlFor="p-fullname">Full name</label>
          <input
            id="p-fullname"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="q-field">
          <label htmlFor="p-email">Email</label>
          <input id="p-email" type="email" value={email} readOnly />
        </div>
        <div className="q-field">
          <label htmlFor="p-dob">Date of birth</label>
          <input
            id="p-dob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
        </div>
        <div className="q-field">
          <label htmlFor="p-phone">Phone number</label>
          <input
            id="p-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="q-field full">
          <label htmlFor="p-address">Address</label>
          <textarea
            id="p-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div className="q-field">
          <label htmlFor="p-em-name">Emergency contact name</label>
          <input
            id="p-em-name"
            type="text"
            value={emName}
            onChange={(e) => setEmName(e.target.value)}
          />
        </div>
        <div className="q-field">
          <label htmlFor="p-em-phone">Emergency contact phone</label>
          <input
            id="p-em-phone"
            type="tel"
            value={emPhone}
            onChange={(e) => setEmPhone(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <div role="alert" className="login-error" style={{ marginTop: 14 }}>
          {error}
        </div>
      )}
      {savedAt && !error && (
        <div
          style={{
            marginTop: 14,
            color: "var(--sage-deep)",
            fontSize: 14,
            letterSpacing: "0.04em",
          }}
        >
          Saved.
        </div>
      )}
      <button type="submit" className="q-submit" disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
