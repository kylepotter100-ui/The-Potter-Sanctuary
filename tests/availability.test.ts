import { describe, it, expect } from "vitest";
import {
  BUFFER_MINUTES,
  candidateRejection,
  fittingTreatments,
  isCandidateValid,
  minutesToTime,
  resolveOpenSet,
  timeToMinutes,
  validStartTimes,
  type ExistingBooking,
} from "@/lib/availability";

// Full open day: every 15-min segment from 09:30 up to (not including) 19:00.
// 18:45 is the last segment a session may occupy (a 15-min block ending 19:00).
function fullOpenSet(): Set<string> {
  const open = new Set<string>();
  for (let m = timeToMinutes("09:30"); m < timeToMinutes("19:00"); m += 15) {
    open.add(minutesToTime(m));
  }
  return open;
}

describe("candidateRejection — closing & opening rules", () => {
  it("accepts a 60-min session at 18:00 (finishes exactly at close)", () => {
    expect(
      candidateRejection({
        openSet: fullOpenSet(),
        existing: [],
        start: "18:00",
        duration: 60,
      })
    ).toBeNull();
  });

  it("rejects a 60-min session at 18:15 (would finish past 19:00)", () => {
    expect(
      candidateRejection({
        openSet: fullOpenSet(),
        existing: [],
        start: "18:15",
        duration: 60,
      })
    ).toBe("closing");
  });

  it("rejects a start before opening time", () => {
    expect(
      candidateRejection({
        openSet: fullOpenSet(),
        existing: [],
        start: "09:15",
        duration: 60,
      })
    ).toBe("closing");
  });
});

describe("candidateRejection — overlap with the 15-min buffer", () => {
  // Existing 60-min booking at 14:00 reserves [14:00, 15:15).
  const existing: ExistingBooking[] = [{ time: "14:00", duration_minutes: 60 }];

  it("buffer constant is 15 minutes (schema constraint mirrors this)", () => {
    expect(BUFFER_MINUTES).toBe(15);
  });

  it("rejects a session starting inside the existing session", () => {
    expect(
      candidateRejection({ openSet: fullOpenSet(), existing, start: "14:30", duration: 60 })
    ).toBe("overlap");
  });

  it("rejects a session starting in the buffer (15:00 < 15:15)", () => {
    expect(
      candidateRejection({ openSet: fullOpenSet(), existing, start: "15:00", duration: 60 })
    ).toBe("overlap");
  });

  it("accepts a session starting exactly when the buffer ends (15:15)", () => {
    expect(
      candidateRejection({ openSet: fullOpenSet(), existing, start: "15:15", duration: 60 })
    ).toBeNull();
  });

  it("rejects an earlier session whose own buffer collides (13:15+60 → buffer to 14:30)", () => {
    expect(
      candidateRejection({ openSet: fullOpenSet(), existing, start: "13:15", duration: 60 })
    ).toBe("overlap");
  });

  it("accepts an earlier session ending 15 min before (12:45+60 → buffer to 14:00)", () => {
    expect(
      candidateRejection({ openSet: fullOpenSet(), existing, start: "12:45", duration: 60 })
    ).toBeNull();
  });
});

describe("candidateRejection — closed segments", () => {
  it("rejects when any 15-min segment of the SESSION is closed", () => {
    const open = fullOpenSet();
    open.delete("14:30"); // hole inside a 14:00–15:00 session
    expect(
      candidateRejection({ openSet: open, existing: [], start: "14:00", duration: 60 })
    ).toBe("closed-segment");
  });

  it("does NOT require the buffer's segments to be open", () => {
    const open = fullOpenSet();
    open.delete("15:00"); // buffer block of a 14:00–15:00 session
    expect(
      candidateRejection({ openSet: open, existing: [], start: "14:00", duration: 60 })
    ).toBeNull();
  });
});

describe("validStartTimes", () => {
  it("returns sorted starts and excludes blocked ones", () => {
    const existing: ExistingBooking[] = [{ time: "10:00", duration_minutes: 60 }];
    const starts = validStartTimes(fullOpenSet(), existing, 60);
    expect(starts[0]).toBe("11:15"); // 09:30/09:45 collide with [10:00,11:15)
    expect(starts).toEqual([...starts].sort());
    expect(starts).not.toContain("10:30");
    expect(starts).toContain("18:00");
    expect(starts).not.toContain("18:15");
  });

  it("longer treatments get fewer valid starts", () => {
    const sixty = validStartTimes(fullOpenSet(), [], 60);
    const ninety = validStartTimes(fullOpenSet(), [], 90);
    expect(ninety.length).toBeLessThan(sixty.length);
    expect(ninety).not.toContain("18:00"); // 90 min from 18:00 passes close
    expect(ninety).toContain("17:30");
  });
});

describe("resolveOpenSet", () => {
  it("is template ∪ active-overrides − inactive-overrides", () => {
    const open = resolveOpenSet(
      [{ slot_time: "10:00:00" }, { slot_time: "10:15:00" }],
      [
        { slot_time: "11:00:00", is_active: true },
        { slot_time: "10:15:00", is_active: false },
      ]
    );
    expect(open.has("10:00")).toBe(true);
    expect(open.has("10:15")).toBe(false);
    expect(open.has("11:00")).toBe(true);
  });
});

describe("isCandidateValid", () => {
  it("matches candidateRejection === null", () => {
    expect(
      isCandidateValid({ openSet: fullOpenSet(), existing: [], start: "14:00", duration: 60 })
    ).toBe(true);
  });
});

describe("candidateRejection — admin 'book anytime' mode", () => {
  // Admin mode = manual booking by the owner: open-set, closing-time and
  // opening-time rules are skipped (any day, any time of day), but the overlap
  // guard MUST still hold.

  it("allows an out-of-hours start (before opening) that is normally 'closing'", () => {
    expect(
      candidateRejection({
        openSet: new Set(),
        existing: [],
        start: "08:00",
        duration: 60,
        adminMode: true,
      })
    ).toBeNull();
  });

  it("allows a late session that would finish past close", () => {
    expect(
      candidateRejection({
        openSet: new Set(),
        existing: [],
        start: "20:00",
        duration: 60,
        adminMode: true,
      })
    ).toBeNull();
  });

  it("allows a start not in the open set (closed day) — empty open set is fine", () => {
    expect(
      candidateRejection({
        openSet: new Set(),
        existing: [],
        start: "13:00",
        duration: 30,
        adminMode: true,
      })
    ).toBeNull();
  });

  it("STILL rejects a real clash with an existing booking", () => {
    // Existing 60-min at 14:00 reserves [14:00, 15:15). A 30-min at 14:30
    // intersects it and must be rejected even in admin mode.
    expect(
      candidateRejection({
        openSet: new Set(),
        existing: [{ time: "14:00", duration_minutes: 60 }],
        start: "14:30",
        duration: 30,
        adminMode: true,
      })
    ).toBe("overlap");
  });

  it("allows a back-to-back start once the buffer has cleared (no overlap)", () => {
    // [14:00,15:15) reserved → 15:15 is the first clear start.
    expect(
      candidateRejection({
        openSet: new Set(),
        existing: [{ time: "14:00", duration_minutes: 60 }],
        start: "15:15",
        duration: 30,
        adminMode: true,
      })
    ).toBeNull();
  });
});

// ===========================================================================
// Changing a booking's TREATMENT changes its duration, so the booking must be
// re-checked against the day. The booking being edited is excluded from
// `existing` (a booking can never clash with itself) — these tests pin the
// growth/shrink rules that the admin change-treatment flow relies on.
// ===========================================================================
describe("treatment change — duration growth at a fixed start", () => {
  // The booking under edit is at 14:00; another client is booked at 15:00/30,
  // occupying [15:00, 15:45) once its buffer is counted.
  const follower: ExistingBooking[] = [{ time: "15:00", duration_minutes: 30 }];

  it("shrinking always still fits (60 -> 30 at the same start)", () => {
    expect(
      candidateRejection({
        openSet: fullOpenSet(),
        existing: follower,
        start: "14:00",
        duration: 30,
      })
    ).toBeNull();
  });

  it("growing into the following booking is rejected as an overlap", () => {
    // 14:00 + 60 + 15 buffer = 15:15, which intersects [15:00, 15:45).
    expect(
      candidateRejection({
        openSet: fullOpenSet(),
        existing: follower,
        start: "14:00",
        duration: 60,
      })
    ).toBe("overlap");
  });

  it("growing is fine when the gap is big enough", () => {
    expect(
      candidateRejection({
        openSet: fullOpenSet(),
        existing: [{ time: "16:00", duration_minutes: 30 }],
        start: "14:00",
        duration: 60,
      })
    ).toBeNull();
  });

  it("growing past closing time is rejected (17:30 + 60 ends 18:30... 18:15 + 60 does not)", () => {
    expect(
      candidateRejection({
        openSet: fullOpenSet(),
        existing: [],
        start: "18:15",
        duration: 60,
      })
    ).toBe("closing");
  });

  it("the edited booking must be excluded or it blocks its own slot", () => {
    const self: ExistingBooking[] = [{ time: "14:00", duration_minutes: 30 }];
    // Included: the row overlaps itself and every change looks impossible.
    expect(
      candidateRejection({
        openSet: fullOpenSet(),
        existing: self,
        start: "14:00",
        duration: 30,
      })
    ).toBe("overlap");
    // Excluded (what the feature actually does): the same change is valid.
    expect(
      candidateRejection({
        openSet: fullOpenSet(),
        existing: [],
        start: "14:00",
        duration: 30,
      })
    ).toBeNull();
  });
});

describe("fittingTreatments — drives the change-treatment picker", () => {
  it("offers only the 30-min treatments in a gap that can't hold 60 min", () => {
    const fits = fittingTreatments(
      fullOpenSet(),
      [{ time: "15:00", duration_minutes: 30 }],
      "14:00"
    );
    // 60-min treatments would run into the 15:00 booking; 30-min ones fit.
    expect(fits).toContain("back-neck-scalp");
    expect(fits).toContain("hot-stones-back");
    expect(fits).not.toContain("full-body-aromatherapy");
    expect(fits).not.toContain("hot-stones-full");
  });

  it("offers every treatment when the day is clear", () => {
    expect(fittingTreatments(fullOpenSet(), [], "10:00")).toHaveLength(4);
  });

  it("offers nothing at a start time that is past closing for all durations", () => {
    expect(fittingTreatments(fullOpenSet(), [], "18:45")).toHaveLength(0);
  });
});
