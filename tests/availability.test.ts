import { describe, it, expect } from "vitest";
import {
  BUFFER_MINUTES,
  candidateRejection,
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
