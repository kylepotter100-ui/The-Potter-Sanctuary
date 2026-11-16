import { describe, it, expect } from "vitest";
import { buildIcs, googleCalendarUrl, eventTimes } from "@/lib/calendar";

const b = { bookingId: "abc-123", date: "2026-07-15", time: "10:30", durationMinutes: 60, treatmentName: "Hot Stones Full Body" };

describe("calendar invite", () => {
  it("uses UK wall-clock → UTC (BST in July: 10:30 UK = 09:30Z)", () => {
    const { start, end } = eventTimes(b);
    expect(start.toISOString()).toBe("2026-07-15T09:30:00.000Z");
    expect(end.toISOString()).toBe("2026-07-15T10:30:00.000Z");
  });
  it("GMT in winter: 10:30 UK = 10:30Z", () => {
    expect(eventTimes({ ...b, date: "2026-12-01" }).start.toISOString()).toBe("2026-12-01T10:30:00.000Z");
  });
  it("produces a valid, CRLF, folded VEVENT with stable UID", () => {
    const ics = buildIcs({ ...b, sequence: 3 }, new Date("2026-01-01T00:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("UID:abc-123@thepottersanctuary.co.uk\r\n");
    expect(ics).toContain("SEQUENCE:3\r\n");
    expect(ics).toContain("DTSTART:20260715T093000Z\r\n");
    expect(ics).toContain("DTEND:20260715T103000Z\r\n");
    expect(ics).toContain("LOCATION:22 Lockheed Close\\, Beck Row\\, IP28 3AB");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("Google link carries the UTC range", () => {
    expect(googleCalendarUrl(b)).toContain("dates=20260715T093000Z%2F20260715T103000Z");
  });
});
