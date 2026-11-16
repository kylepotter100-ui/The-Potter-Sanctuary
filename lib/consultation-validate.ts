// Shape + length validation for the customer profile and consultation
// (health) payloads. Both routes are authenticated and scoped to the caller's
// own row, but they previously wrote whatever JSON arrived — arbitrary keys
// into the `conditions` jsonb, megabyte strings, wrong types. These helpers
// return a clean object containing ONLY known fields, or a friendly error.
// Pure — unit-tested in tests/consultation-validate.test.ts.

import { ukTodayIso } from "@/lib/uk-time";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const TEXT_MAX = 2000;

function text(v: unknown, max: number, label: string): Result<string | null> {
  if (v === null || v === undefined) return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false, error: `${label} must be text.` };
  const t = v.trim();
  if (t.length > max) return { ok: false, error: `${label} is too long (max ${max} characters).` };
  return { ok: true, value: t || null };
}

function bool(v: unknown, label: string): Result<boolean | null> {
  if (v === null || v === undefined) return { ok: true, value: null };
  if (typeof v !== "boolean") return { ok: false, error: `${label} must be yes or no.` };
  return { ok: true, value: v };
}

function isoDate(v: unknown, label: string): Result<string | null> {
  if (v === null || v === undefined || v === "") return { ok: true, value: null };
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
    return { ok: false, error: `${label} must be a valid date.` };
  }
  return { ok: true, value: v };
}

export type CustomerProfileFields = {
  full_name: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};

export function sanitizeCustomerProfile(input: unknown): Result<CustomerProfileFields> {
  if (!input || typeof input !== "object") return { ok: false, error: "Missing details." };
  const c = input as Record<string, unknown>;
  const checks = {
    full_name: text(c.full_name, 120, "Name"),
    date_of_birth: isoDate(c.date_of_birth, "Date of birth"),
    phone_number: text(c.phone_number, 30, "Phone"),
    address: text(c.address, 300, "Address"),
    emergency_contact_name: text(c.emergency_contact_name, 120, "Emergency contact name"),
    emergency_contact_phone: text(c.emergency_contact_phone, 30, "Emergency contact phone"),
  };
  const out: Record<string, unknown> = {};
  for (const [k, r] of Object.entries(checks)) {
    if (!r.ok) return r;
    out[k] = r.value;
  }
  return { ok: true, value: out as CustomerProfileFields };
}

export type ConsultationFields = {
  conditions: Record<string, boolean>;
  allergies_specify: string | null;
  other_medical_conditions: string | null;
  under_medical_care: boolean | null;
  medical_care_explanation: string | null;
  focus_areas: string[];
  areas_to_avoid: string | null;
  pressure_preference: "Light" | "Medium" | "Firm" | null;
  had_professional_massage_before?: boolean | null;
  experiences_stress_regularly: boolean | null;
  primary_reason: string | null;
  additional_info: string | null;
};

export type ConsentFields = {
  consent_given: true;
  signature_name: string;
  consent_date: string;
};

export function sanitizeConsultation(
  input: unknown,
  opts: { includeHadMassageBefore?: boolean } = {}
): Result<ConsultationFields> {
  if (!input || typeof input !== "object") return { ok: false, error: "Missing consultation." };
  const r = input as Record<string, unknown>;

  const conditions: Record<string, boolean> = {};
  if (r.conditions !== undefined && r.conditions !== null) {
    if (typeof r.conditions !== "object" || Array.isArray(r.conditions)) {
      return { ok: false, error: "Invalid health conditions." };
    }
    const entries = Object.entries(r.conditions as Record<string, unknown>);
    if (entries.length > 40) return { ok: false, error: "Invalid health conditions." };
    for (const [k, v] of entries) {
      if (!/^[a-z0-9_]{1,40}$/.test(k) || typeof v !== "boolean") {
        return { ok: false, error: "Invalid health conditions." };
      }
      conditions[k] = v;
    }
  }

  let focus: string[] = [];
  if (r.focus_areas !== undefined && r.focus_areas !== null) {
    if (
      !Array.isArray(r.focus_areas) ||
      r.focus_areas.length > 12 ||
      r.focus_areas.some((x) => typeof x !== "string" || x.length > 40)
    ) {
      return { ok: false, error: "Invalid focus areas." };
    }
    focus = r.focus_areas as string[];
  }

  const pressure = r.pressure_preference ?? null;
  if (pressure !== null && !["Light", "Medium", "Firm"].includes(pressure as string)) {
    return { ok: false, error: "Invalid pressure preference." };
  }

  const fields: [keyof ConsultationFields, Result<unknown>][] = [
    ["allergies_specify", text(r.allergies_specify, TEXT_MAX, "Allergies")],
    ["other_medical_conditions", text(r.other_medical_conditions, TEXT_MAX, "Other medical conditions")],
    ["under_medical_care", bool(r.under_medical_care, "Under medical care")],
    ["medical_care_explanation", text(r.medical_care_explanation, TEXT_MAX, "Medical care details")],
    ["areas_to_avoid", text(r.areas_to_avoid, TEXT_MAX, "Areas to avoid")],
    ["experiences_stress_regularly", bool(r.experiences_stress_regularly, "Stress")],
    ["primary_reason", text(r.primary_reason, TEXT_MAX, "Reason for visit")],
    ["additional_info", text(r.additional_info, TEXT_MAX, "Additional information")],
  ];
  if (opts.includeHadMassageBefore) {
    fields.push(["had_professional_massage_before", bool(r.had_professional_massage_before, "Massage before")]);
  }
  const out: Record<string, unknown> = {
    conditions,
    focus_areas: focus,
    pressure_preference: pressure,
  };
  for (const [k, res] of fields) {
    if (!res.ok) return res;
    out[k] = res.value;
  }
  return { ok: true, value: out as ConsultationFields };
}

export function sanitizeConsent(input: unknown): Result<ConsentFields> {
  const r = (input ?? {}) as Record<string, unknown>;
  if (r.consent_given !== true) return { ok: false, error: "Consent is required" };
  const sig = text(r.signature_name, 120, "Signature");
  if (!sig.ok) return sig;
  if (!sig.value) return { ok: false, error: "Signature is required" };
  const d = isoDate(r.consent_date, "Consent date");
  if (!d.ok) return d;
  return {
    ok: true,
    value: {
      consent_given: true,
      signature_name: sig.value,
      consent_date: d.value ?? ukTodayIso(),
    },
  };
}
