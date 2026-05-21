"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { services } from "@/lib/services";
import InlineSignInModal from "@/components/InlineSignInModal";

type ServiceSelection = {
  svc: string;
  name: string;
  price: number;
  duration: string;
};

type Props = {
  preselectId?: string;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DOWS = ["S", "M", "T", "W", "T", "F", "S"];

type AvailabilityData = {
  slotsByDay: Record<number, string[]>;
  blockedDates: string[];
  bookedSlots: Record<string, string[]>;
  slotOverrides?: Record<string, Record<string, boolean>>;
};

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function formatLongDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Current date (YYYY-MM-DD) and minutes-since-midnight in Europe/London,
// independent of the visitor's own timezone. Used to hide past time slots
// on same-day bookings.
function ukNow(): { dateIso: string; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const dateIso = `${get("year")}-${get("month")}-${get("day")}`;
  // "24" can appear at midnight in some engines — normalise to 0.
  const hh = parseInt(get("hour"), 10) % 24;
  const mm = parseInt(get("minute"), 10);
  return { dateIso, minutes: hh * 60 + mm };
}

function slotToMinutes(t: string): number {
  const [hh, mm] = t.slice(0, 5).split(":");
  return parseInt(hh, 10) * 60 + parseInt(mm, 10);
}

export default function Booking({ preselectId }: Props) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [step, setStep] = useState(1);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [service, setService] = useState<ServiceSelection | null>(() => {
    if (!preselectId) return null;
    const s = services.find((x) => x.bookingId === preselectId);
    if (!s) return null;
    return {
      svc: s.bookingId,
      name: `${s.name} ${s.nameEm}`.trim(),
      price: s.price,
      duration: s.duration,
    };
  });
  const [gender, setGender] = useState<string | null>(null);
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [hasPriorConsultation, setHasPriorConsultation] = useState(false);
  // For returning customers, ask whether their consultation details changed.
  // null = not yet answered, true = no change, false = needs new questionnaire.
  const [detailsUnchanged, setDetailsUnchanged] = useState<boolean | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  // Returning-customer banner: shown once per session when an entered email
  // matches an existing customer and the visitor isn't already signed in.
  const [returningBanner, setReturningBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const emailCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pull live availability + blocked dates from the admin-controlled tables so
  // Scroll the relevant section into view on mobile when the step
  // changes. Desktop layouts already keep everything visible, so we skip
  // the smooth-scroll there to avoid feeling jumpy.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 769px)").matches) return;
    const target = document.getElementById(`step-pane-${step}`);
    if (target) {
      // Defer one frame so the pane's `.active` class has applied and
      // its height is correct before we measure scroll offsets.
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [step]);

  // Within step 1, scroll to the time-pane after picking a date so the
  // available slots are immediately in view on mobile.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 769px)").matches) return;
    if (!date) return;
    const target = document.getElementById("time-pane");
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [date]);

  // After picking a time on step 1, nudge the Continue button into view.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 769px)").matches) return;
    if (!time || step !== 1) return;
    const target = document.getElementById("step-actions-1");
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [time, step]);

  // After picking a treatment on step 2, nudge the Continue button into view.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 769px)").matches) return;
    if (!service || step !== 2) return;
    const target = document.getElementById("step-actions-2");
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [service, step]);

  // the calendar mirrors what the studio has set up.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/availability", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as AvailabilityData;
        if (!cancelled) {
          setAvailability(data);
          setAvailabilityError(null);
        }
      } catch {
        if (!cancelled) setAvailabilityError("Couldn't load live availability.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for external "preselect" events from the homepage service cards.
  useEffect(() => {
    const onPreselect = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const s = services.find((x) => x.bookingId === id);
      if (!s) return;
      setService({
        svc: s.bookingId,
        name: `${s.name} ${s.nameEm}`.trim(),
        price: s.price,
        duration: s.duration,
      });
    };
    window.addEventListener("tps:preselect", onPreselect);
    return () => window.removeEventListener("tps:preselect", onPreselect);
  }, []);

  // Pre-fill the form from the signed-in customer's profile (delivered by
  // SignInPrompt's /api/me fetch via a custom event so we share one round-trip).
  useEffect(() => {
    type CustomerDetails = {
      email: string;
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
      phone_number: string | null;
      gender: string | null;
    };
    const onDetails = (e: Event) => {
      const c = (e as CustomEvent<CustomerDetails>).detail;
      if (!c) return;
      const fn = c.first_name || (c.full_name ? c.full_name.split(" ")[0] : "");
      const ln =
        c.last_name ||
        (c.full_name ? c.full_name.split(" ").slice(1).join(" ") : "");
      setFname((prev) => prev || fn);
      setLname((prev) => prev || ln);
      setEmail((prev) => prev || c.email || "");
      setPhone((prev) => prev || c.phone_number || "");
      setGender((prev) => prev || c.gender || null);
    };
    window.addEventListener("tps:customer-details", onDetails);
    // Also fetch directly in case the prompt fired before we mounted.
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { customer: null, hasConsultation: false }))
      .then(
        (data: {
          user?: { id: string } | null;
          customer: CustomerDetails | null;
          hasConsultation?: boolean;
        }) => {
          if (cancelled) return;
          if (data.user) setSignedIn(true);
          if (data.hasConsultation) setHasPriorConsultation(true);
          if (!data.customer) return;
          const c = data.customer;
          const fn =
            c.first_name || (c.full_name ? c.full_name.split(" ")[0] : "");
          const ln =
            c.last_name ||
            (c.full_name ? c.full_name.split(" ").slice(1).join(" ") : "");
          setFname((prev) => prev || fn);
          setLname((prev) => prev || ln);
          setEmail((prev) => prev || c.email || "");
          setPhone((prev) => prev || c.phone_number || "");
          setGender((prev) => prev || c.gender || null);
        }
      )
      .catch(() => {});
    return () => {
      window.removeEventListener("tps:customer-details", onDetails);
      cancelled = true;
    };
  }, []);

  // Debounced returning-customer detection. When the visitor (who isn't
  // signed in) types a known email, surface a banner inviting them to
  // sign in for faster booking. Only shows once per session.
  useEffect(() => {
    if (signedIn || bannerDismissed) return;
    if (!/\S+@\S+\.\S+/.test(email)) {
      setReturningBanner(false);
      return;
    }
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    const value = email.trim().toLowerCase();
    emailCheckTimer.current = setTimeout(() => {
      fetch("/api/customer/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      })
        .then((r) => (r.ok ? r.json() : { exists: false }))
        .then((data: { exists?: boolean }) => {
          if (!signedIn && !bannerDismissed && data.exists) {
            setReturningBanner(true);
          }
        })
        .catch(() => {});
    }, 500);
    return () => {
      if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    };
  }, [email, signedIn, bannerDismissed]);

  // After an inline sign-in, pull the customer's profile to pre-fill the
  // form and surface the "details changed?" question.
  async function onInlineSignedIn() {
    setSignInModalOpen(false);
    setReturningBanner(false);
    setSignedIn(true);
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        customer: {
          email: string;
          full_name: string | null;
          first_name: string | null;
          last_name: string | null;
          phone_number: string | null;
          gender: string | null;
        } | null;
        hasConsultation?: boolean;
      };
      if (data.hasConsultation) setHasPriorConsultation(true);
      const c = data.customer;
      if (c) {
        const fn =
          c.first_name || (c.full_name ? c.full_name.split(" ")[0] : "");
        const ln =
          c.last_name ||
          (c.full_name ? c.full_name.split(" ").slice(1).join(" ") : "");
        if (fn) setFname(fn);
        if (ln) setLname(ln);
        if (c.email) setEmail(c.email);
        if (c.phone_number) setPhone(c.phone_number);
        if (c.gender) setGender(c.gender);
      }
    } catch {
      // best-effort pre-fill
    }
  }

  const next1Disabled = !date || !time;
  const next2Disabled = !service;
  const next3Disabled =
    !gender ||
    !fname.trim() ||
    !lname.trim() ||
    !phone.trim() ||
    !/\S+@\S+\.\S+/.test(email) ||
    // Returning customers must answer the consultation-changed question.
    (hasPriorConsultation && detailsUnchanged === null);

  const dateLabel = date ? formatLongDate(date) : "";

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

  function freeSlotsFor(dt: Date): string[] {
    if (!availability) return [];
    const iso = isoDate(dt);
    if (blockedSet.has(iso)) return [];
    const dow = dt.getDay();
    const baseSet = new Set(availability.slotsByDay[dow] ?? []);
    // Apply per-date overrides — `false` removes a slot, `true` adds one
    // that the day_of_week template wouldn't normally include.
    const overrides = overridesByDate[iso] ?? {};
    for (const [time, active] of Object.entries(overrides)) {
      if (active) baseSet.add(time);
      else baseSet.delete(time);
    }
    const taken = new Set(bookedByDate[iso] ?? []);
    let slots = Array.from(baseSet).filter((t) => !taken.has(t));

    // For today (UK time), hide any slot that's already started or is
    // within the next 15 minutes — no point offering a slot that can't
    // realistically be honoured.
    const { dateIso: ukToday, minutes: ukMinutes } = ukNow();
    if (iso === ukToday) {
      const cutoff = ukMinutes + 15;
      slots = slots.filter((t) => slotToMinutes(t) >= cutoff);
    }

    return slots.sort();
  }

  const calCells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
    const cells: Array<{
      key: string;
      label: number;
      date: Date | null;
      muted: boolean;
      disabled: boolean;
      today: boolean;
      selected: boolean;
    }> = [];
    for (let i = startDow - 1; i >= 0; i--) {
      cells.push({
        key: `pre-${i}`,
        label: daysInPrev - i,
        date: null,
        muted: true,
        disabled: true,
        today: false,
        selected: false,
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(viewYear, viewMonth, d);
      const dow = dt.getDay();
      const isPast = dt < today;
      const isBlocked = blockedSet.has(isoDate(dt));
      // Once availability data is loaded, the day is open if `freeSlotsFor`
      // resolves to at least one slot — that function merges the
      // day_of_week template, per-date slot_overrides, and booked slots,
      // so it naturally handles Mon/Sun (no template, but admin can open
      // them via overrides) and partially-booked days.
      // Before availability loads we fall back to a Tue-Sat skeleton so
      // the calendar isn't blank during the initial paint.
      const noSlots = availability
        ? freeSlotsFor(dt).length === 0
        : dow === 0 || dow === 1;
      const disabled = isPast || isBlocked || noSlots;
      const isToday = dt.getTime() === today.getTime();
      const isSelected = !!date && dt.getTime() === date.getTime();
      cells.push({
        key: `d-${d}`,
        label: d,
        date: dt,
        muted: false,
        disabled,
        today: isToday,
        selected: isSelected,
      });
    }
    const remainder = (startDow + daysInMonth) % 7;
    if (remainder) {
      for (let i = 1; i <= 7 - remainder; i++) {
        cells.push({
          key: `post-${i}`,
          label: i,
          date: null,
          muted: true,
          disabled: true,
          today: false,
          selected: false,
        });
      }
    }
    return cells;
    // freeSlotsFor closes over availability/blockedSet/bookedByDate/overridesByDate,
    // so including all of them here keeps the memo in sync when any change.
  }, [viewYear, viewMonth, today, date, availability, blockedSet, bookedByDate, overridesByDate]);

  const slotState = useMemo(() => {
    if (!date) return [] as Array<{ time: string; disabled: boolean }>;
    if (!availability) return [];
    return freeSlotsFor(date).map((t) => ({ time: t, disabled: false }));
    // freeSlotsFor depends on availability/blockedSet/bookedByDate/overridesByDate;
    // deps below cover all of them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, availability, blockedSet, bookedByDate, overridesByDate]);

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  function bookAnother() {
    // Reset everything except the customer details we just typed in —
    // those are valid for the next booking too. Refetch availability so
    // the slot we just took is removed.
    setStep(1);
    setDate(null);
    setTime(null);
    setMessage("");
    setDetailsUnchanged(null);
    setSubmitError(null);
    fetch("/api/availability", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AvailabilityData | null) => {
        if (data) setAvailability(data);
      })
      .catch(() => {});
    // Scroll the booking card back to the top.
    requestAnimationFrame(() => {
      const card = document.getElementById("bookingCard");
      if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function submit() {
    if (!date || !time || !service) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: isoDate(date),
          dateLabel,
          time,
          service,
          gender,
          fname,
          lname,
          phone,
          email,
          message,
          // Returning customers tell us whether their consultation details
          // are still current. Omitted for first-time bookings.
          detailsUnchanged: hasPriorConsultation ? detailsUnchanged : null,
        }),
      });
      if (res.status === 409) {
        // Race-loss: another customer grabbed the same slot between page
        // load and submit. Refresh availability, drop the picked time,
        // and send the customer back to step 1 so they can pick again.
        setSubmitError(
          "Sorry, that time slot was just taken. Please pick another time."
        );
        setTime(null);
        setStep(1);
        try {
          const fresh = await fetch("/api/availability", { cache: "no-store" });
          if (fresh.ok) {
            setAvailability((await fresh.json()) as AvailabilityData);
          }
        } catch {
          // best-effort — the user can also just refresh the page
        }
        return;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "Booking failed");
      }
      setStep(4);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not send booking"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="booking-card" id="bookingCard">
      {submitError && step !== 3 && (
        <div role="alert" className="booking-top-error">
          {submitError}
        </div>
      )}
      <div className="steps">
        {[
          { n: 1, lbl: "Date" },
          { n: 2, lbl: "Treatment" },
          { n: 3, lbl: "Details" },
          { n: 4, lbl: "Confirm" },
        ].map((s, i, arr) => (
          <div key={s.n} className="contents">
            <div
              className={`step${step === s.n ? " active" : ""}${
                s.n < step ? " complete" : ""
              }`}
            >
              <div className="dot">
                <span className="num">{s.n}</span>
              </div>
              <div className="lbl">{s.lbl}</div>
            </div>
            {i < arr.length - 1 && <div className="step-bar" />}
          </div>
        ))}
      </div>

      {/* Step 1 — Date & Time */}
      <div className={`step-pane${step === 1 ? " active" : ""}`} id="step-pane-1">
        <div className="calendar">
          <div className="cal-pane">
            <div className="cal-head">
              <div className="month">
                {MONTHS[viewMonth]} {viewYear}
              </div>
              <div className="nav">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => shiftMonth(-1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => shiftMonth(1)}
                >
                  ›
                </button>
              </div>
            </div>
            <div className="cal-grid">
              {DOWS.map((d, i) => (
                <div className="dow" key={`dow-${i}`}>
                  {d}
                </div>
              ))}
              {calCells.map((c) => {
                const cls = `day${c.muted ? " muted" : ""}${
                  c.disabled ? " disabled" : ""
                }${c.today ? " today" : ""}${c.selected ? " selected" : ""}`;
                return (
                  <div
                    key={c.key}
                    className={cls}
                    onClick={() => {
                      if (c.disabled || !c.date) return;
                      setDate(c.date);
                      setTime(null);
                    }}
                  >
                    {c.label}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="time-pane" id="time-pane">
            <h4>Available times</h4>
            <div className="hint">
              {date ? dateLabel : "Select a date to see times"}
            </div>
            <div className="slots">
              {date && availability && slotState.length === 0 && (
                <div className="hint" style={{ gridColumn: "1 / -1" }}>
                  No availability on this day.
                </div>
              )}
              {slotState.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  className={`slot${s.disabled ? " disabled" : ""}${
                    time === s.time ? " active" : ""
                  }`}
                  onClick={() => !s.disabled && setTime(s.time)}
                >
                  {s.time}
                </button>
              ))}
            </div>
            {availabilityError && (
              <div className="hint" style={{ marginTop: 10 }}>
                {availabilityError}
              </div>
            )}
          </div>
        </div>
        {date && (
          <div className="selected-summary">
            <span className="l">Selected</span>
            <span className="r">
              {dateLabel}
              {time ? ` · ${time}` : " · pick a time"}
            </span>
          </div>
        )}
        <div className="step-actions" id="step-actions-1">
          <span />
          <button
            type="button"
            className="next"
            disabled={next1Disabled}
            onClick={() => setStep(2)}
          >
            Continue →
          </button>
        </div>
      </div>

      {/* Step 2 — Treatment */}
      <div className={`step-pane${step === 2 ? " active" : ""}`} id="step-pane-2">
        <h4
          style={{
            fontFamily: "var(--font-serif), 'Cormorant Garamond', serif",
            fontWeight: 300,
            fontSize: 24,
            marginBottom: 6,
          }}
        >
          Choose a treatment
        </h4>
        <div className="hint">Select one to continue</div>
        <div className="svc-options">
          {services.map((s, i) => {
            const id = s.bookingId;
            const active = service?.svc === id;
            const num = String(i + 1).padStart(2, "0");
            return (
              <button
                key={id}
                type="button"
                className={`svc-option${active ? " active" : ""}`}
                onClick={() =>
                  setService({
                    svc: id,
                    name: `${s.name} ${s.nameEm}`.trim(),
                    price: s.price,
                    duration: s.duration,
                  })
                }
              >
                <span className="num">{num}</span>
                <span>
                  <div className="name">
                    {s.name} {s.nameEm}
                  </div>
                  <div className="duration">
                    {s.duration} · {s.pressure}
                  </div>
                </span>
                <span className="price">{s.priceLabel}</span>
              </button>
            );
          })}
        </div>
        <div className="step-actions" id="step-actions-2">
          <button type="button" className="back" onClick={() => setStep(1)}>
            ← Back
          </button>
          <button
            type="button"
            className="next"
            disabled={next2Disabled}
            onClick={() => setStep(3)}
          >
            Continue →
          </button>
        </div>
      </div>

      {/* Step 3 — Details */}
      <div className={`step-pane${step === 3 ? " active" : ""}`} id="step-pane-3">
        <h4
          style={{
            fontFamily: "var(--font-serif), 'Cormorant Garamond', serif",
            fontWeight: 300,
            fontSize: 24,
            marginBottom: 6,
          }}
        >
          Your details
        </h4>
        <div className="hint">We'll only use these to confirm your visit</div>

        {returningBanner && !signedIn && (
          <div className="returning-banner" role="region" aria-label="Returning customer">
            <button
              type="button"
              className="returning-banner-close"
              aria-label="Dismiss"
              onClick={() => {
                setReturningBanner(false);
                setBannerDismissed(true);
              }}
            >
              ×
            </button>
            <p>
              Welcome back to The Potter Sanctuary — sign in for faster
              booking. Your details and consultation will be remembered.
            </p>
            <button
              type="button"
              className="returning-banner-btn"
              onClick={() => setSignInModalOpen(true)}
            >
              Sign in
            </button>
          </div>
        )}

        <div className="field">
          <label>Gender</label>
          <div className="gender-row">
            {["Female", "Male", "Non-binary", "Prefer not to say"].map((g) => (
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

        <div className="field-row">
          <div className="field">
            <label htmlFor="fname">First name</label>
            <input
              id="fname"
              type="text"
              placeholder="Your first name"
              value={fname}
              onChange={(e) => setFname(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="lname">Last name</label>
            <input
              id="lname"
              type="text"
              placeholder="Your last name"
              value={lname}
              onChange={(e) => setLname(e.target.value)}
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              type="tel"
              placeholder="07000 000 000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="message">
            Message{" "}
            <span
              style={{
                opacity: 0.5,
                letterSpacing: 0,
                textTransform: "none",
                fontSize: 11,
              }}
            >
              (optional)
            </span>
          </label>
          <textarea
            id="message"
            placeholder="Anything we should know — pregnancy, allergies, areas to avoid, scent preferences…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {hasPriorConsultation && (
          <div className="field">
            <label>
              Have any of your consultation details changed since your last
              visit? (e.g. medical conditions, allergies, medications)
            </label>
            <div className="gender-row">
              <button
                type="button"
                className={`gender-pill${
                  detailsUnchanged === true ? " active" : ""
                }`}
                onClick={() => setDetailsUnchanged(true)}
              >
                No, nothing has changed
              </button>
              <button
                type="button"
                className={`gender-pill${
                  detailsUnchanged === false ? " active" : ""
                }`}
                onClick={() => setDetailsUnchanged(false)}
              >
                Yes, I need to update
              </button>
            </div>
          </div>
        )}

        {submitError && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              padding: "10px 14px",
              background: "#f7e3e2",
              border: "1px solid #c98a86",
              borderRadius: 6,
              fontSize: 13,
              color: "#5b201d",
            }}
          >
            {submitError}
          </div>
        )}

        <div className="step-actions">
          <button type="button" className="back" onClick={() => setStep(2)}>
            ← Back
          </button>
          <button
            type="button"
            className="next"
            disabled={next3Disabled || submitting}
            onClick={submit}
          >
            {submitting ? "Sending…" : "Review & book →"}
          </button>
        </div>
      </div>

      {/* Step 4 — Confirm */}
      <div className={`step-pane${step === 4 ? " active" : ""}`} id="step-pane-4">
        <div className="confirm">
          <div className="check">✓</div>
          <h3>Reservation received</h3>
          <p>
            Thank you, {fname || "friend"} — we'll be in touch within the day to
            confirm. Studio address and parking notes will follow by email.
          </p>
          {date && time && service && (
            <div className="confirm-summary">
              <div className="row">
                <span className="l">When</span>
                <span className="r">
                  {dateLabel} · {time}
                </span>
              </div>
              <div className="row">
                <span className="l">Treatment</span>
                <span className="r">{service.name}</span>
              </div>
              <div className="row">
                <span className="l">Duration</span>
                <span className="r">{service.duration}</span>
              </div>
              <div className="row">
                <span className="l">Price</span>
                <span className="r">£{service.price}</span>
              </div>
              <div className="row">
                <span className="l">Name</span>
                <span className="r">
                  {fname} {lname}
                </span>
              </div>
              <div className="row">
                <span className="l">Contact</span>
                <span className="r">
                  {phone} · {email}
                </span>
              </div>
            </div>
          )}
          <div className="confirm-actions">
            <button
              type="button"
              className="next"
              onClick={bookAnother}
            >
              Book another session
            </button>
          </div>
        </div>
      </div>

      {signInModalOpen && (
        <InlineSignInModal
          initialEmail={email}
          onClose={() => setSignInModalOpen(false)}
          onSignedIn={onInlineSignedIn}
        />
      )}
    </div>
  );
}
