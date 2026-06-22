"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { services, durationMinutesForTreatmentId } from "@/lib/services";
import {
  validStartTimes,
  candidateRejection,
  type ExistingBooking,
} from "@/lib/availability";
import { normalizePhone } from "@/lib/phone";
import { ukNow } from "@/lib/uk-time";

export type InitialClient = {
  id: string;
  fname: string;
  lname: string;
  email: string;
  phone: string;
  gender: string | null;
  visits: number;
  hasQuestionnaire: boolean;
};

type ClientHit = {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  gender: string | null;
  visits: number;
  hasQuestionnaire: boolean;
};

type AvailabilityData = {
  slotsByDay: Record<number, string[]>;
  blockedDates: string[];
  bookedSlots: Record<string, { time: string; duration: number }[]>;
  slotOverrides?: Record<string, Record<string, boolean>>;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOWS = ["S", "M", "T", "W", "T", "F", "S"];
const SHORTEST = Math.min(...services.map((s) => s.durationMinutes));

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function formatLongDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
function minToTime(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60
  ).padStart(2, "0")}`;
}
function timeToMin(t: string) {
  const [h, m] = t.slice(0, 5).split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];

export default function AdminNewBooking({
  initialClient,
}: {
  initialClient: InitialClient | null;
}) {
  const router = useRouter();
  const today = useMemo(() => startOfDay(new Date()), []);

  const [step, setStep] = useState(1);
  const [treatmentId, setTreatmentId] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [bookAnytime, setBookAnytime] = useState(false);

  const [fname, setFname] = useState(initialClient?.fname ?? "");
  const [lname, setLname] = useState(initialClient?.lname ?? "");
  const [phone, setPhone] = useState(initialClient?.phone ?? "");
  const [email, setEmail] = useState(initialClient?.email ?? "");
  const [gender, setGender] = useState<string | null>(
    initialClient?.gender ?? null
  );
  const [message, setMessage] = useState("");

  const [matchedId, setMatchedId] = useState<string | null>(
    initialClient?.id ?? null
  );
  const [matchVisits, setMatchVisits] = useState<number>(
    initialClient?.visits ?? 0
  );
  const [matchHasQ, setMatchHasQ] = useState<boolean>(
    initialClient?.hasQuestionnaire ?? false
  );
  const [detailsUnchanged, setDetailsUnchanged] = useState<boolean | null>(null);

  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<ClientHit[] | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const treatment = treatmentId
    ? services.find((s) => s.bookingId === treatmentId) ?? null
    : null;
  const duration = treatment ? treatment.durationMinutes : SHORTEST;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/availability", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AvailabilityData | null) => {
        if (!cancelled && d) setAvailability(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ----- slot computation -----
  const blockedSet = useMemo(
    () => new Set(availability?.blockedDates ?? []),
    [availability]
  );
  const bookedByDate = useMemo(
    () => availability?.bookedSlots ?? {},
    [availability]
  );
  const overridesByDate = useMemo(
    () => availability?.slotOverrides ?? {},
    [availability]
  );

  function existingFor(dt: Date): ExistingBooking[] {
    return (bookedByDate[isoDate(dt)] ?? []).map((b) => ({
      time: b.time,
      duration_minutes: b.duration,
    }));
  }
  function openSetFor(dt: Date): Set<string> {
    const set = new Set(availability?.slotsByDay[dt.getDay()] ?? []);
    const ov = overridesByDate[isoDate(dt)] ?? {};
    for (const [t, active] of Object.entries(ov)) {
      if (active) set.add(t);
      else set.delete(t);
    }
    return set;
  }
  function freeSlotsFor(dt: Date): string[] {
    if (!availability) return [];
    const iso = isoDate(dt);
    const existing = existingFor(dt);

    if (bookAnytime) {
      // Full-day 15-min grid; only the overlap check applies (admin mode).
      const out: string[] = [];
      for (let m = 0; m + duration <= 24 * 60; m += 15) {
        const start = minToTime(m);
        const rej = candidateRejection({
          openSet: new Set(),
          existing,
          start,
          duration,
          adminMode: true,
        });
        if (rej === null) out.push(start);
      }
      return out;
    }

    if (blockedSet.has(iso)) return [];
    let slots = validStartTimes(openSetFor(dt), existing, duration);
    const { dateIso: ukToday, minutes: ukMinutes } = ukNow();
    if (iso === ukToday) {
      const cutoff = ukMinutes + 15;
      slots = slots.filter((t) => timeToMin(t) >= cutoff);
    }
    return slots;
  }

  const calCells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{
      key: string;
      label: number;
      date: Date | null;
      disabled: boolean;
      selected: boolean;
    }> = [];
    for (let i = 0; i < startDow; i++)
      cells.push({ key: `b-${i}`, label: 0, date: null, disabled: true, selected: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(viewYear, viewMonth, d);
      const isPast = dt < today;
      let disabled = isPast;
      if (!disabled && !bookAnytime) {
        disabled = !availability ? dt.getDay() === 0 || dt.getDay() === 1 : freeSlotsFor(dt).length === 0;
      }
      cells.push({
        key: `d-${d}`,
        label: d,
        date: dt,
        disabled,
        selected: !!date && dt.getTime() === date.getTime(),
      });
    }
    return cells;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth, today, date, treatmentId, bookAnytime, availability, blockedSet, bookedByDate, overridesByDate]);

  const slotList = useMemo(() => {
    if (!date || !availability) return [];
    return freeSlotsFor(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, treatmentId, bookAnytime, availability, blockedSet, bookedByDate, overridesByDate]);

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    else if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  // ----- client search + returning detection -----
  function applyClient(hit: ClientHit) {
    setMatchedId(hit.id);
    setMatchVisits(hit.visits);
    setMatchHasQ(hit.hasQuestionnaire);
    setFname(hit.firstName || hit.fullName.split(" ")[0] || "");
    setLname(hit.lastName || hit.fullName.split(" ").slice(1).join(" ") || "");
    setEmail(hit.email);
    setPhone(hit.phone || "");
    if (hit.gender) setGender(hit.gender);
    setResults(null);
    setSearchQ(hit.fullName);
    setDetailsUnchanged(null);
  }
  function clearClient() {
    setMatchedId(null);
    setMatchVisits(0);
    setMatchHasQ(false);
    setDetailsUnchanged(null);
    setFname(""); setLname(""); setEmail(""); setPhone(""); setGender(null);
    setSearchQ("");
    setResults(null);
  }

  function onSearch(v: string) {
    setSearchQ(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (v.trim().length < 2) { setResults(null); return; }
    searchTimer.current = setTimeout(() => {
      fetch(`/api/admin/customers/search?q=${encodeURIComponent(v.trim())}`)
        .then((r) => (r.ok ? r.json() : { clients: [] }))
        .then((d: { clients: ClientHit[] }) => setResults(d.clients ?? []))
        .catch(() => setResults([]));
    }, 300);
  }

  // When details are typed for a NEW (unmatched) entry, check if they actually
  // match an existing client (email exact or normalized phone) — mirrors the
  // server reconciliation so the returning/new banner is accurate before submit.
  useEffect(() => {
    if (matchedId) return; // already selected
    const e = email.trim().toLowerCase();
    const p = normalizePhone(phone);
    const enoughEmail = /\S+@\S+\.\S+/.test(e);
    if (!enoughEmail && p.length < 10) return;
    if (detectTimer.current) clearTimeout(detectTimer.current);
    detectTimer.current = setTimeout(() => {
      const q = enoughEmail ? e : phone.trim();
      fetch(`/api/admin/customers/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { clients: [] }))
        .then((d: { clients: ClientHit[] }) => {
          const hit = (d.clients ?? []).find(
            (c) =>
              c.email.toLowerCase() === e ||
              (c.phone && normalizePhone(c.phone) === p && p.length >= 10)
          );
          if (hit) {
            setMatchedId(hit.id);
            setMatchVisits(hit.visits);
            setMatchHasQ(hit.hasQuestionnaire);
          }
        })
        .catch(() => {});
    }, 400);
    return () => {
      if (detectTimer.current) clearTimeout(detectTimer.current);
    };
  }, [email, phone, matchedId]);

  // ----- step gating -----
  const canStep1 = !!treatment;
  const canStep2 = !!date && !!time;
  const emailValid = /\S+@\S+\.\S+/.test(email);
  const canStep3 =
    !!gender &&
    !!fname.trim() &&
    !!lname.trim() &&
    !!phone.trim() &&
    emailValid &&
    (!(matchedId && matchHasQ) || detailsUnchanged !== null);

  function goStep(n: number) {
    setError(null);
    setStep(n);
  }

  async function submit() {
    if (!treatment || !date || !time) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: isoDate(date),
          time,
          serviceId: treatment.bookingId,
          gender,
          fname,
          lname,
          phone,
          email,
          message,
          detailsUnchanged: matchedId && matchHasQ ? detailsUnchanged : null,
          bookAnytime,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
          error?: string;
        } | null;
        throw new Error(body?.message || body?.error || "Could not save booking");
      }
      const body = (await res.json()) as { id: string };
      setSuccessId(body.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save booking");
    } finally {
      setSubmitting(false);
    }
  }

  const dateLabel = date ? formatLongDate(date) : "";

  // ----- render -----
  const stepDefs = [
    { n: 1, lbl: "Treatment" },
    { n: 2, lbl: "Date & time" },
    { n: 3, lbl: "Client" },
    { n: 4, lbl: "Confirm" },
  ];

  if (successId) {
    return (
      <div className="admin-card mb-success">
        <div className="mb-check">✓</div>
        <h2 style={{ marginBottom: 6 }}>Booking confirmed</h2>
        <p className="lede" style={{ margin: "0 auto 18px", maxWidth: 420 }}>
          Standard booking confirmation
          {!matchedId || !matchHasQ ? " (with the questionnaire link)" : ""} sent
          to <strong>{email}</strong>. It&apos;s now in the diary and removed from
          website availability.
        </p>
        <div className="btn-row" style={{ justifyContent: "center" }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setSuccessId(null);
              setStep(1);
              setTreatmentId(null);
              setDate(null);
              setTime(null);
              setBookAnytime(false);
              setMessage("");
              clearClient();
            }}
          >
            Take another booking
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => router.push("/admin/bookings")}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-flow">
      <div className="mb-steps">
        {stepDefs.map((s, i) => (
          <div key={s.n} className="contents">
            <div className={`mb-step${step === s.n ? " active" : ""}${s.n < step ? " done" : ""}`}>
              <span className="mb-dot">{s.n < step ? "✓" : s.n}</span>
              <span className="mb-step-lbl">{s.lbl}</span>
            </div>
            {i < stepDefs.length - 1 && <span className="mb-step-bar" />}
          </div>
        ))}
      </div>

      {error && (
        <div role="alert" className="error-text">
          {error}
        </div>
      )}

      {/* STEP 1 — TREATMENT */}
      {step === 1 && (
        <>
          <div className="admin-card">
            <p className="admin-subheading">Choose a treatment</p>
            <div className="svc-pick-list">
              {services.map((s, i) => (
                <button
                  key={s.bookingId}
                  type="button"
                  className={`svc-pick${treatmentId === s.bookingId ? " is-on" : ""}`}
                  onClick={() => setTreatmentId(s.bookingId)}
                >
                  <span className="svc-pick-num">0{i + 1}</span>
                  <span>
                    <span className="svc-pick-name">
                      {s.name} {s.nameEm}
                    </span>
                    <span className="svc-pick-dur">
                      {s.duration} · {s.pressure}
                    </span>
                  </span>
                  <span className="svc-pick-price">{s.priceLabel}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mb-actions">
            <button type="button" className="btn btn-ghost" onClick={() => router.push("/admin/bookings")}>
              Cancel
            </button>
            <button type="button" className="btn" disabled={!canStep1} onClick={() => goStep(2)}>
              Continue →
            </button>
          </div>
        </>
      )}

      {/* STEP 2 — DATE & TIME */}
      {step === 2 && (
        <>
          <div className="admin-card">
            <div className="mb-twocol">
              <div>
                <div className="mb-cal-head">
                  <span className="mb-cal-month">
                    {MONTHS[viewMonth]} {viewYear}
                  </span>
                  <span className="mb-cal-nav">
                    <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}>‹</button>
                    <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}>›</button>
                  </span>
                </div>
                <div className="mb-cal">
                  {DOWS.map((d, i) => (
                    <div className="mb-dow" key={`dow-${i}`}>{d}</div>
                  ))}
                  {calCells.map((c) => (
                    <div
                      key={c.key}
                      className={`mb-day${!c.date ? " blank" : ""}${c.disabled ? " off" : " in"}${c.selected ? " sel" : ""}`}
                      onClick={() => {
                        if (c.disabled || !c.date) return;
                        setDate(c.date);
                        setTime(null);
                      }}
                    >
                      {c.label > 0 ? c.label : ""}
                    </div>
                  ))}
                </div>
                <label className="mb-anytime">
                  <input
                    type="checkbox"
                    checked={bookAnytime}
                    onChange={(e) => {
                      setBookAnytime(e.target.checked);
                      setTime(null);
                    }}
                  />
                  Book anytime — unlock every day &amp; time (clashes still blocked)
                </label>
              </div>
              <div>
                <p className="mb-slots-h">
                  {date ? `Times for ${dateLabel}` : "Select a date to see times"}
                </p>
                {date && slotList.length === 0 && (
                  <p className="lede" style={{ margin: 0 }}>
                    No available times on this day.
                  </p>
                )}
                <div className="mb-slots">
                  {slotList.map((t) => {
                    const offHours = timeToMin(t) < timeToMin("09:30") || timeToMin(t) > timeToMin("18:45");
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`mb-slot${time === t ? " sel" : ""}${bookAnytime && offHours ? " off-hours" : ""}`}
                        onClick={() => setTime(t)}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="mb-actions">
            <button type="button" className="btn btn-ghost" onClick={() => goStep(1)}>← Back</button>
            <button type="button" className="btn" disabled={!canStep2} onClick={() => goStep(3)}>Continue →</button>
          </div>
        </>
      )}

      {/* STEP 3 — CLIENT */}
      {step === 3 && (
        <>
          <div className="admin-card">
            <p className="admin-subheading">Client</p>
            <label className="admin-search" style={{ marginBottom: 6 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={searchQ}
                placeholder="Search existing client (name, email, phone)…"
                autoComplete="off"
                onChange={(e) => onSearch(e.target.value)}
              />
            </label>
            {results && (
              <div className="mb-results">
                {results.length === 0 ? (
                  <div className="mb-result muted">No match — fill in the details below for a new client.</div>
                ) : (
                  results.map((c) => (
                    <button key={c.id} type="button" className="mb-result" onClick={() => applyClient(c)}>
                      <span className="mb-result-main">
                        <span className="mb-result-name">{c.fullName}</span>
                        <span className="mb-result-meta">
                          {c.email}{c.phone ? ` · ${c.phone}` : ""}
                        </span>
                      </span>
                      <span className="btn btn-sm">Select</span>
                    </button>
                  ))
                )}
              </div>
            )}
            <p className="mb-or">— or enter details below for a new client —</p>

            {matchedId ? (
              <div className="mb-banner mb-banner-returning">
                <div className="mb-banner-head">✓ Returning client</div>
                <div className="mb-banner-sub">
                  {matchVisits} previous visit{matchVisits === 1 ? "" : "s"} ·
                  questionnaire {matchHasQ ? "✓ on file" : "— not completed"}
                </div>
                {matchHasQ && (
                  <div className="field" style={{ margin: "12px 0 0" }}>
                    <label>Have their consultation details changed?</label>
                    <div className="pillrow">
                      <button
                        type="button"
                        className={`gender-pill${detailsUnchanged === true ? " active" : ""}`}
                        onClick={() => setDetailsUnchanged(true)}
                      >
                        No, nothing changed
                      </button>
                      <button
                        type="button"
                        className={`gender-pill${detailsUnchanged === false ? " active" : ""}`}
                        onClick={() => setDetailsUnchanged(false)}
                      >
                        Yes, send the questionnaire
                      </button>
                    </div>
                  </div>
                )}
                <div className="mb-banner-actions">
                  <a className="linklike" href={`/admin/clients/${matchedId}`} target="_blank" rel="noreferrer">
                    View client history →
                  </a>
                  <button type="button" className="linklike" onClick={clearClient}>
                    Clear / new client
                  </button>
                </div>
              </div>
            ) : (
              (fname.trim() && emailValid) || (fname.trim() && normalizePhone(phone).length >= 10) ? (
                <div className="mb-banner mb-banner-new">
                  <div className="mb-banner-head">＋ New client — a record will be created on booking</div>
                  <div className="mb-banner-sub">
                    No match for these details. The confirmation email will include the consultation questionnaire link.
                  </div>
                </div>
              ) : null
            )}

            <div className="field">
              <label>Gender</label>
              <div className="pillrow">
                {GENDERS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`gender-pill${gender === g ? " active" : ""}`}
                    onClick={() => setGender(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-frow">
              <div className="field">
                <label htmlFor="mb-fname">First name</label>
                <input id="mb-fname" value={fname} onChange={(e) => setFname(e.target.value)} placeholder="First name" />
              </div>
              <div className="field">
                <label htmlFor="mb-lname">Last name</label>
                <input id="mb-lname" value={lname} onChange={(e) => setLname(e.target.value)} placeholder="Last name" />
              </div>
            </div>
            <div className="mb-frow">
              <div className="field">
                <label htmlFor="mb-phone">Phone</label>
                <input id="mb-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07000 000 000" />
              </div>
              <div className="field">
                <label htmlFor="mb-email">Email</label>
                <input id="mb-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="mb-msg">
                Message <span style={{ textTransform: "none", letterSpacing: 0, opacity: 0.6 }}>(optional)</span>
              </label>
              <textarea id="mb-msg" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Anything to note — areas to avoid, scent preferences…" />
            </div>
          </div>
          <div className="mb-actions">
            <button type="button" className="btn btn-ghost" onClick={() => goStep(2)}>← Back</button>
            <button type="button" className="btn" disabled={!canStep3} onClick={() => goStep(4)}>Review →</button>
          </div>
        </>
      )}

      {/* STEP 4 — CONFIRM */}
      {step === 4 && treatment && date && time && (
        <>
          <div className="admin-card">
            <p className="admin-subheading">Confirm booking</p>
            <div className="mb-sum">
              <div className="row"><span className="l">Treatment</span><span className="r">{treatment.name} {treatment.nameEm}</span></div>
              <div className="row"><span className="l">When</span><span className="r">{dateLabel} · {time}</span></div>
              <div className="row"><span className="l">Duration</span><span className="r">{treatment.duration}</span></div>
              <div className="row"><span className="l">Price</span><span className="r">£{treatment.price} · cash on the day</span></div>
              <div className="row"><span className="l">Client</span><span className="r">{fname} {lname}<br /><span className="muted" style={{ fontSize: 13 }}>{email} · {phone}</span></span></div>
              <div className="row"><span className="l">Status</span><span className="r">{matchedId ? "Returning client" : "New client (record will be created)"}{bookAnytime ? " · booked anytime" : ""}</span></div>
            </div>
            <div className="info-text" style={{ marginBottom: 0 }}>
              On confirm: the booking is saved as <strong>confirmed</strong> and the client is emailed the standard booking confirmation
              {!matchedId || !matchHasQ ? " with the questionnaire link" : ""}. No owner email — you made this booking.
            </div>
          </div>
          <div className="mb-actions">
            <button type="button" className="btn btn-ghost" onClick={() => goStep(3)} disabled={submitting}>← Back</button>
            <button type="button" className="btn" onClick={submit} disabled={submitting}>
              {submitting ? "Saving…" : "Confirm & send email →"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
