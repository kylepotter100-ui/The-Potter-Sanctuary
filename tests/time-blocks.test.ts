import { describe, it, expect } from "vitest";
import { segmentsInRange, bookingsClashingWithBlock } from "@/lib/time-blocks";
import { resolveOpenSet, candidateRejection } from "@/lib/availability";

describe("segmentsInRange", () => {
  it("covers [from, to) on the 15-minute grid", () => {
    expect(segmentsInRange("12:00", "13:00")).toEqual(["12:00", "12:15", "12:30", "12:45"]);
  });
  it("rejects bad ranges", () => {
    expect(segmentsInRange("13:00", "12:00")).toBeNull();
    expect(segmentsInRange("12:00", "12:00")).toBeNull();
    expect(segmentsInRange("12:10", "13:00")).toBeNull();
    expect(segmentsInRange("05:00", "07:00")).toBeNull();
    expect(segmentsInRange("21:00", "23:00")).toBeNull();
    expect(segmentsInRange("1200", "13:00")).toBeNull();
  });
});

describe("a block closes the calendar around it", () => {
  const template = Array.from({ length: 38 }, (_, i) => ({
    slot_time: `${String(9 + Math.floor((30 + i * 15) / 60)).padStart(2, "0")}:${String((30 + i * 15) % 60).padStart(2, "0")}:00`,
  }));
  const block = segmentsInRange("12:00", "13:00")!.map((t) => ({ slot_time: t, is_active: false }));
  const open = resolveOpenSet(template, block);
  it("a 60-min session can't start inside or run into the block", () => {
    expect(candidateRejection({ openSet: open, existing: [], start: "12:15", duration: 60 })).toBe("closed-segment");
    expect(candidateRejection({ openSet: open, existing: [], start: "11:30", duration: 60 })).toBe("closed-segment");
    expect(candidateRejection({ openSet: open, existing: [], start: "11:00", duration: 60 })).toBeNull();
    expect(candidateRejection({ openSet: open, existing: [], start: "13:00", duration: 60 })).toBeNull();
  });
});

describe("bookingsClashingWithBlock", () => {
  const bk = [
    { id: "a", time: "11:00", duration_minutes: 60 },
    { id: "b", time: "11:30", duration_minutes: 60 },
    { id: "c", time: "13:00", duration_minutes: 30 },
  ];
  it("finds sessions overlapping the block, ignoring the cleanup buffer", () => {
    expect(bookingsClashingWithBlock("12:00", "13:00", bk).map((x) => x.id)).toEqual(["b"]);
  });
});
