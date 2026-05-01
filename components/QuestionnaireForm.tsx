"use client";

import { useState } from "react";

export type CustomerSeed = {
  full_name: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  email: string;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};

export type ConsultationSeed = {
  conditions: Record<string, boolean>;
  allergies_specify: string | null;
  other_medical_conditions: string | null;
  under_medical_care: boolean | null;
  medical_care_explanation: string | null;
  focus_areas: string[];
  areas_to_avoid: string | null;
  pressure_preference: "Light" | "Medium" | "Firm" | null;
  had_professional_massage_before: boolean | null;
  experiences_stress_regularly: boolean | null;
  primary_reason: string | null;
  additional_info: string | null;
};

type Props = {
  bookingId: string | null;
  customer: CustomerSeed;
  previous: ConsultationSeed | null;
};

const HEALTH_CONDITIONS: Array<{ key: string; label: string }> = [
  { key: "high_blood_pressure", label: "High blood pressure" },
  { key: "low_blood_pressure", label: "Low blood pressure" },
  { key: "heart_condition", label: "Heart condition" },
  { key: "diabetes", label: "Diabetes" },
  { key: "arthritis", label: "Arthritis" },
  { key: "chronic_pain", label: "Chronic pain" },
  { key: "headaches_migraines", label: "Headaches/Migraines" },
  { key: "recent_injury", label: "Recent injury" },
  { key: "pregnancy", label: "Pregnancy" },
  { key: "skin_conditions", label: "Skin conditions" },
  { key: "allergies", label: "Allergies" },
];

const FOCUS_AREAS = [
  "Back",
  "Neck",
  "Shoulders",
  "Legs",
  "Arms",
  "Feet",
  "Full Body",
];

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function QuestionnaireForm({
  bookingId,
  customer,
  previous,
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(customer.full_name ?? "");
  const [dob, setDob] = useState(customer.date_of_birth ?? "");
  const [phone, setPhone] = useState(customer.phone_number ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [emName, setEmName] = useState(customer.emergency_contact_name ?? "");
  const [emPhone, setEmPhone] = useState(customer.emergency_contact_phone ?? "");

  const [conditions, setConditions] = useState<Record<string, boolean>>(
    previous?.conditions ?? {}
  );
  const [allergiesSpecify, setAllergiesSpecify] = useState(
    previous?.allergies_specify ?? ""
  );
  const [otherConditions, setOtherConditions] = useState(
    previous?.other_medical_conditions ?? ""
  );
  const [underMedicalCare, setUnderMedicalCare] = useState<boolean | null>(
    previous?.under_medical_care ?? null
  );
  const [medicalCareExplanation, setMedicalCareExplanation] = useState(
    previous?.medical_care_explanation ?? ""
  );

  const [focusAreas, setFocusAreas] = useState<string[]>(
    previous?.focus_areas ?? []
  );
  const [areasToAvoid, setAreasToAvoid] = useState(
    previous?.areas_to_avoid ?? ""
  );
  const [pressure, setPressure] = useState<"Light" | "Medium" | "Firm" | "">(
    previous?.pressure_preference ?? ""
  );
  const [hadMassageBefore, setHadMassageBefore] = useState<boolean | null>(
    previous?.had_professional_massage_before ?? null
  );

  const [stressRegularly, setStressRegularly] = useState<boolean | null>(
    previous?.experiences_stress_regularly ?? null
  );
  const [primaryReason, setPrimaryReason] = useState(
    previous?.primary_reason ?? ""
  );
  const [additionalInfo, setAdditionalInfo] = useState(
    previous?.additional_info ?? ""
  );

  const [consentGiven, setConsentGiven] = useState(false);
  const [signature, setSignature] = useState("");
  const consentDate = todayIso();

  function toggleCondition(key: string) {
    setConditions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleFocusArea(area: string) {
    setFocusAreas((prev) => {
      const has = prev.includes(area);
      if (has) return prev.filter((a) => a !== area);
      if (area === "Full Body") return ["Full Body"];
      return [...prev.filter((a) => a !== "Full Body"), area];
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consentGiven) {
      setError("Please confirm consent before submitting.");
      return;
    }
    if (!signature.trim()) {
      setError("Please type your full name as your signature.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          customer: {
            full_name: fullName.trim() || null,
            date_of_birth: dob || null,
            phone_number: phone.trim() || null,
            address: address.trim() || null,
            emergency_contact_name: emName.trim() || null,
            emergency_contact_phone: emPhone.trim() || null,
          },
          response: {
            conditions,
            allergies_specify: conditions.allergies
              ? allergiesSpecify.trim() || null
              : null,
            other_medical_conditions: otherConditions.trim() || null,
            under_medical_care: underMedicalCare,
            medical_care_explanation:
              underMedicalCare ? medicalCareExplanation.trim() || null : null,
            focus_areas: focusAreas,
            areas_to_avoid: areasToAvoid.trim() || null,
            pressure_preference: pressure || null,
            had_professional_massage_before: hadMassageBefore,
            experiences_stress_regularly: stressRegularly,
            primary_reason: primaryReason.trim() || null,
            additional_info: additionalInfo.trim() || null,
            consent_given: consentGiven,
            signature_name: signature.trim(),
            consent_date: consentDate,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "Submission failed");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="q-success">
        <div className="icon" aria-hidden="true">✓</div>
        <h1>Thank you.</h1>
        <p>
          Your therapist will review this before your session. We look forward
          to caring for you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {/* SECTION 1 */}
      <section className="q-section">
        <h2>Client Information</h2>
        <div className="q-grid">
          <div className="q-field full">
            <label htmlFor="q-fullname">Full name</label>
            <input
              id="q-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="q-field">
            <label htmlFor="q-dob">Date of birth</label>
            <input
              id="q-dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </div>
          <div className="q-field">
            <label htmlFor="q-phone">Phone number</label>
            <input
              id="q-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="q-field full">
            <label htmlFor="q-email">Email</label>
            <input
              id="q-email"
              type="email"
              value={customer.email}
              readOnly
            />
          </div>
          <div className="q-field full">
            <label htmlFor="q-address">Address</label>
            <textarea
              id="q-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="q-field">
            <label htmlFor="q-em-name">Emergency contact name</label>
            <input
              id="q-em-name"
              type="text"
              value={emName}
              onChange={(e) => setEmName(e.target.value)}
            />
          </div>
          <div className="q-field">
            <label htmlFor="q-em-phone">Emergency contact phone</label>
            <input
              id="q-em-phone"
              type="tel"
              value={emPhone}
              onChange={(e) => setEmPhone(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* SECTION 2 */}
      <section className="q-section">
        <h2>Health History</h2>
        <div className="q-checks" style={{ marginBottom: 16 }}>
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
        {conditions.allergies && (
          <div className="q-field full" style={{ marginBottom: 14 }}>
            <label htmlFor="q-allergies">Please specify allergies</label>
            <input
              id="q-allergies"
              type="text"
              value={allergiesSpecify}
              onChange={(e) => setAllergiesSpecify(e.target.value)}
            />
          </div>
        )}
        <div className="q-field full" style={{ marginBottom: 14 }}>
          <label htmlFor="q-other-conditions">Other medical conditions</label>
          <textarea
            id="q-other-conditions"
            value={otherConditions}
            onChange={(e) => setOtherConditions(e.target.value)}
          />
        </div>
        <div className="q-field full">
          <label>Are you currently under medical care?</label>
          <div className="q-radio-row">
            <label>
              <input
                type="radio"
                name="under-care"
                checked={underMedicalCare === true}
                onChange={() => setUnderMedicalCare(true)}
              />
              Yes
            </label>
            <label>
              <input
                type="radio"
                name="under-care"
                checked={underMedicalCare === false}
                onChange={() => setUnderMedicalCare(false)}
              />
              No
            </label>
          </div>
        </div>
        {underMedicalCare === true && (
          <div className="q-field full" style={{ marginTop: 12 }}>
            <label htmlFor="q-medical-care">If yes, please explain</label>
            <textarea
              id="q-medical-care"
              value={medicalCareExplanation}
              onChange={(e) => setMedicalCareExplanation(e.target.value)}
            />
          </div>
        )}
      </section>

      {/* SECTION 3 */}
      <section className="q-section">
        <h2>Massage Preferences</h2>
        <div className="q-field full" style={{ marginBottom: 14 }}>
          <label>What areas would you like to focus on?</label>
          <div className="q-checks">
            {FOCUS_AREAS.map((area) => (
              <label className="q-check" key={area}>
                <input
                  type="checkbox"
                  checked={focusAreas.includes(area)}
                  onChange={() => toggleFocusArea(area)}
                />
                {area}
              </label>
            ))}
          </div>
        </div>
        <div className="q-field full" style={{ marginBottom: 14 }}>
          <label htmlFor="q-avoid">Areas to avoid</label>
          <textarea
            id="q-avoid"
            value={areasToAvoid}
            onChange={(e) => setAreasToAvoid(e.target.value)}
          />
        </div>
        <div className="q-field full" style={{ marginBottom: 14 }}>
          <label>Pressure preference</label>
          <div className="q-radio-row">
            {(["Light", "Medium", "Firm"] as const).map((p) => (
              <label key={p}>
                <input
                  type="radio"
                  name="pressure"
                  checked={pressure === p}
                  onChange={() => setPressure(p)}
                />
                {p}
              </label>
            ))}
          </div>
        </div>
        <div className="q-field full">
          <label>Have you had a professional massage before?</label>
          <div className="q-radio-row">
            <label>
              <input
                type="radio"
                name="had-massage"
                checked={hadMassageBefore === true}
                onChange={() => setHadMassageBefore(true)}
              />
              Yes
            </label>
            <label>
              <input
                type="radio"
                name="had-massage"
                checked={hadMassageBefore === false}
                onChange={() => setHadMassageBefore(false)}
              />
              No
            </label>
          </div>
        </div>
      </section>

      {/* SECTION 4 */}
      <section className="q-section">
        <h2>Lifestyle &amp; Wellness</h2>
        <div className="q-field full" style={{ marginBottom: 14 }}>
          <label>Do you experience stress regularly?</label>
          <div className="q-radio-row">
            <label>
              <input
                type="radio"
                name="stress"
                checked={stressRegularly === true}
                onChange={() => setStressRegularly(true)}
              />
              Yes
            </label>
            <label>
              <input
                type="radio"
                name="stress"
                checked={stressRegularly === false}
                onChange={() => setStressRegularly(false)}
              />
              No
            </label>
          </div>
        </div>
        <div className="q-field full" style={{ marginBottom: 14 }}>
          <label htmlFor="q-reason">Primary reason for today's visit</label>
          <textarea
            id="q-reason"
            value={primaryReason}
            onChange={(e) => setPrimaryReason(e.target.value)}
          />
        </div>
        <div className="q-field full">
          <label htmlFor="q-additional">
            Any additional information you'd like your therapist to know
          </label>
          <textarea
            id="q-additional"
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
          />
        </div>
      </section>

      {/* SECTION 5 */}
      <section className="q-section">
        <h2>Consent &amp; Signature</h2>
        <div className="q-consent">
          I understand that massage therapy is for relaxation and wellness
          purposes and is not a substitute for medical treatment. I have
          provided accurate health information and will inform my therapist of
          any changes.
        </div>
        <label className="q-check" style={{ marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            required
          />
          I confirm and consent
        </label>
        <div className="q-grid">
          <div className="q-field">
            <label htmlFor="q-signature">Type your full name as signature</label>
            <input
              id="q-signature"
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              required
            />
          </div>
          <div className="q-field">
            <label htmlFor="q-date">Date</label>
            <input id="q-date" type="date" value={consentDate} readOnly />
          </div>
        </div>

        {error && (
          <div role="alert" className="login-error" style={{ marginTop: 14 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="q-submit"
          disabled={submitting || !consentGiven}
        >
          {submitting ? "Submitting…" : "Submit consultation"}
        </button>
      </section>
    </form>
  );
}
