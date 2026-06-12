import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  addDaysIso,
  minutesUntilUk,
  ukNow,
  ukNowMinutes,
  ukTodayIso,
  ukWallTimeToUtc,
  ukYearMonth,
} from "@/lib/uk-time";

// 2026 facts (externally verifiable): BST runs 29 Mar 01:00 UTC → 25 Oct
// 01:00 UTC; UK is UTC+1 inside that range, UTC+0 outside it.

describe("ukWallTimeToUtc", () => {
  it("summer (BST): 14:00 UK = 13:00 UTC", () => {
    expect(ukWallTimeToUtc("2026-06-15", "14:00").getTime()).toBe(
      Date.UTC(2026, 5, 15, 13, 0)
    );
  });

  it("winter (GMT): 14:00 UK = 14:00 UTC", () => {
    expect(ukWallTimeToUtc("2026-01-15", "14:00").getTime()).toBe(
      Date.UTC(2026, 0, 15, 14, 0)
    );
  });

  it("accepts HH:MM:SS times as stored in the DB", () => {
    expect(ukWallTimeToUtc("2026-06-15", "14:00:00").getTime()).toBe(
      Date.UTC(2026, 5, 15, 13, 0)
    );
  });

  it("spring-forward day before the jump (00:30 still GMT)", () => {
    expect(ukWallTimeToUtc("2026-03-29", "00:30").getTime()).toBe(
      Date.UTC(2026, 2, 29, 0, 30)
    );
  });

  it("spring-forward day after the jump (03:00 is BST)", () => {
    expect(ukWallTimeToUtc("2026-03-29", "03:00").getTime()).toBe(
      Date.UTC(2026, 2, 29, 2, 0)
    );
  });

  it("fall-back day before the change (00:30 still BST → 23:30 UTC prev day)", () => {
    expect(ukWallTimeToUtc("2026-10-25", "00:30").getTime()).toBe(
      Date.UTC(2026, 9, 24, 23, 30)
    );
  });

  it("fall-back day after the change (14:00 is GMT)", () => {
    expect(ukWallTimeToUtc("2026-10-25", "14:00").getTime()).toBe(
      Date.UTC(2026, 9, 25, 14, 0)
    );
  });
});

describe("minutesUntilUk — the cancel-cutoff math", () => {
  it("BST: 13:50 UK is 10 minutes before a 14:00 UK booking (cutoff must block)", () => {
    const now = new Date(Date.UTC(2026, 5, 15, 12, 50)); // 13:50 BST
    expect(minutesUntilUk("2026-06-15", "14:00", now)).toBe(10);
  });

  it("BST: 13:30 UK is 30 minutes before (cutoff must allow)", () => {
    const now = new Date(Date.UTC(2026, 5, 15, 12, 30)); // 13:30 BST
    expect(minutesUntilUk("2026-06-15", "14:00", now)).toBe(30);
  });

  it("goes negative once the appointment has started", () => {
    const now = new Date(Date.UTC(2026, 5, 15, 13, 30)); // 14:30 BST
    expect(minutesUntilUk("2026-06-15", "14:00", now)).toBe(-30);
  });

  it("winter behaves identically (regression guard)", () => {
    const now = new Date(Date.UTC(2026, 0, 15, 13, 50));
    expect(minutesUntilUk("2026-01-15", "14:00", now)).toBe(10);
  });
});

describe("uk 'now' helpers around the BST midnight boundary", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("23:30 UTC on a BST evening is already 00:30 the NEXT UK day", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 15, 23, 30)));
    expect(ukTodayIso()).toBe("2026-06-16");
    expect(ukNowMinutes()).toBe(30);
    expect(ukNow()).toEqual({ dateIso: "2026-06-16", minutes: 30 });
  });

  it("ukYearMonth rolls the month with UK wall time, not UTC", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 30, 23, 30))); // 00:30 on 1 July UK
    expect(ukYearMonth()).toEqual({ year: 2026, month: 7 });
  });

  it("winter: UTC and UK agree", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 15, 23, 30)));
    expect(ukTodayIso()).toBe("2026-01-15");
    expect(ukNowMinutes()).toBe(23 * 60 + 30);
  });
});

describe("addDaysIso", () => {
  it("adds across month ends", () => {
    expect(addDaysIso("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDaysIso("2026-06-15", 60)).toBe("2026-08-14");
    expect(addDaysIso("2026-06-15", -1)).toBe("2026-06-14");
  });
});
