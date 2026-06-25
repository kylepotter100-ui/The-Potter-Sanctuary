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

export type ConsultSeed = {
  conditions: Record<string, boolean>;
  allergies_specify: string | null;
  other_medical_conditions: string | null;
  under_medical_care: boolean | null;
  medical_care_explanation: string | null;
  focus_areas: string[];
  areas_to_avoid: string | null;
  pressure_preference: "Light" | "Medium" | "Firm" | null;
} | null;

type Props = {
  seed: ProfileSeed;
  consult: ConsultSeed;
  email: string;
};

const HEALTH_CONDITIONS: Array<{ key: string; label: string }> = [
  { key: "high_blood_pressure", label: "High blood pressure" },
  { key: "low_blood_pressure", label: "Low blood pressure" },
  { key: "heart_condition", label: "Heart condition" },
  { key: "diabetes", label: "Diabetes" },
  { key: "arthritis", label: "Arthritis" },
  { key: "chronic_pain", label: "Chronic pain" },
  { key: "headaches_migraines", label: "Headaches / migraines" },
  { key: "recent_injury", label: "Recent injury" },
  { key: "pregnancy", label: "Pregnancy" },
  { key: "skin_conditions", label: "Skin conditions" },
  { key: "allergies", label: "Allergies" },
];
const FOCUS_AREAS = ["Back", "Neck", "Shoulders", "Legs", "Arms", "Feet", "Full Body"];

export default function ProfileForm({ seed, consult, email }: Props) {
  // Contact details
  const [fullName, setFullName] = useState(seed.full_name ?? "");
  const [dob, setDob] = useState(seed.date_of_birth ?? "");
  const [phone, setPhone] = useState(seed.phone_number ?? "");
  const [address, setAddress] = useState(seed.address ?? "");
  const [emName, setEmName] = useState(seed.emergency_contact_name ?? "");
  const [emPhone, setEmPhone] = useState(seed.emergency_contact_phone ?? "");

  // Consultation / health
  const [conditions, setConditions] = useState<Record<string, boolean>>(
    consult?.conditions ?? {}
  );
  const [allergiesSpecify, setAllergiesSpecify] = useState(
    consult?.allergies_specify ?? ""
  );
  const [otherConditions, setOtherConditions] = useState(
    consult?.other_medical_conditions ?? ""
  );
  const [underCare, setUnderCare] = useState<boolean | null>(
    consult?.under_medical_care ?? null
  );
  const [careExplanation, setCareExplanation] = useState(
    consult?.medical_care_explanation ?? ""
  );
  const [focusAreas, setFocusAreas] = useState<string[]>(
    consult?.focus_areas ?? []
  );
  const [areasToAvoid, setAreasToAvoid] = useState(consult?.areas_to_avoid ?? "");
  const [pressure, setPressure] = useState<"Light" | "Medium" | "Firm" | "">(
    consult?.pressure_preference ?? ""
  );

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleCondition(key: string) {
    setConditions((p) => ({ ...p, [key]: !p[key] }));
  }
  function toggleFocus(area: string) {
    setFocusAreas((p) => {
      if (p.includes(area)) return p.filter((a) => a !== area);
      if (area === "Full Body") return ["Full Body"];
      return [...p.filter((a) => a !== "Full Body"), area];
    });
  }

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
          consultation: {
            conditions,
            allergies_specify: conditions.allergies
              ? allergiesSpecify.trim() || null
              : null,
            other_medical_conditions: otherConditions.trim() || null,
            under_medical_care: underCare,
            medical_care_explanation:
              underCare ? careExplanation.trim() || null : null,
            focus_areas: focusAreas,
            areas_to_avoid: areasToAvoid.trim() || null,
            pressure_preference: pressure || null,
          },
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
    <form onSubmit={onSubmit} noValidate>
      {/* Contact details */}
      <section className="account-section">
        <h2>Your details</h2>
        <div className="q-grid">
          <div className="q-field full">
            <label htmlFor="p-fullname">Full name</label>
            <input id="p-fullname" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="q-field">
            <label htmlFor="p-email">Email</label>
            <input id="p-email" type="email" value={email} readOnly />
          </div>
          <div className="q-field">
            <label htmlFor="p-dob">Date of birth</label>
            <input id="p-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <div className="q-field">
            <label htmlFor="p-phone">Phone number</label>
            <input id="p-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="q-field full">
            <label htmlFor="p-address">Address</label>
            <textarea id="p-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="q-field">
            <label htmlFor="p-em-name">Emergency contact name</label>
            <input id="p-em-name" type="text" value={emName} onChange={(e) => setEmName(e.target.value)} />
          </div>
          <div className="q-field">
            <label htmlFor="p-em-phone">Emergency contact phone</label>
            <input id="p-em-phone" type="tel" value={emPhone} onChange={(e) => setEmPhone(e.target.value)} />
          </div>
        </div>
      </section>

      {/* Consultation & health */}
      <section className="account-section">
        <h2>Consultation &amp; health details</h2>
        <p className="account-empty" style={{ margin: "0 0 16px" }}>
          Keep these up to date — they&apos;re used to tailor and prepare for your
          treatments, and apply to your upcoming visits.
        </p>

        <div className="q-field full">
          <label>Health conditions</label>
          <div className="q-checks">
            {HEALTH_CONDITIONS.map((c) => (
              <label className="q-check" key={c.key}>
                <input
                  type="checkbox"
                  checked={!!conditions[c.key]}
                  onChange={() => toggleCondition(c.key)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>
        {conditions.allergies && (
          <div className="q-field full">
            <label htmlFor="p-allergies">Please specify allergies</label>
            <input id="p-allergies" type="text" value={allergiesSpecify} onChange={(e) => setAllergiesSpecify(e.target.value)} />
          </div>
        )}
        <div className="q-field full">
          <label htmlFor="p-other">Other medical conditions</label>
          <textarea id="p-other" value={otherConditions} onChange={(e) => setOtherConditions(e.target.value)} />
        </div>
        <div className="q-field full">
          <label>Currently under medical care?</label>
          <div className="q-radio-row">
            <label><input type="radio" name="p-care" checked={underCare === true} onChange={() => setUnderCare(true)} /> Yes</label>
            <label><input type="radio" name="p-care" checked={underCare === false} onChange={() => setUnderCare(false)} /> No</label>
          </div>
        </div>
        {underCare === true && (
          <div className="q-field full">
            <label htmlFor="p-care-exp">If yes, please explain</label>
            <textarea id="p-care-exp" value={careExplanation} onChange={(e) => setCareExplanation(e.target.value)} />
          </div>
        )}
        <div className="q-field full">
          <label>Focus areas</label>
          <div className="q-checks">
            {FOCUS_AREAS.map((a) => (
              <label className="q-check" key={a}>
                <input type="checkbox" checked={focusAreas.includes(a)} onChange={() => toggleFocus(a)} />
                {a}
              </label>
            ))}
          </div>
        </div>
        <div className="q-field full">
          <label htmlFor="p-avoid">Areas to avoid</label>
          <input id="p-avoid" type="text" value={areasToAvoid} onChange={(e) => setAreasToAvoid(e.target.value)} />
        </div>
        <div className="q-field full">
          <label>Pressure preference</label>
          <div className="q-radio-row">
            {(["Light", "Medium", "Firm"] as const).map((p) => (
              <label key={p}>
                <input type="radio" name="p-pressure" checked={pressure === p} onChange={() => setPressure(p)} /> {p}
              </label>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="login-error" style={{ marginTop: 14 }}>
          {error}
        </div>
      )}
      {savedAt && !error && (
        <div style={{ marginTop: 14, color: "var(--sage-deep)", fontSize: 14, letterSpacing: "0.04em" }}>
          Saved.
        </div>
      )}
      <button type="submit" className="q-submit" disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
