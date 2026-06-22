import { describe, it, expect } from "vitest";
import { normalizePhone } from "@/lib/phone";

// normalizePhone is a SECOND exact-match key for customer identity. It must be
// deterministic (formatting + UK country-code only) and stay in lockstep with
// the phone_normalized generated column in supabase/schema.sql.

describe("normalizePhone", () => {
  it("strips spaces, hyphens, parens and dots", () => {
    expect(normalizePhone("07700 900123")).toBe("07700900123");
    expect(normalizePhone("07700-900-123")).toBe("07700900123");
    expect(normalizePhone("(07700) 900.123")).toBe("07700900123");
  });

  it("treats +44, 0044 and 0 forms of the same UK number as equal", () => {
    const canonical = "07700900123";
    expect(normalizePhone("07700900123")).toBe(canonical);
    expect(normalizePhone("+44 7700 900123")).toBe(canonical);
    expect(normalizePhone("+447700900123")).toBe(canonical);
    expect(normalizePhone("0044 7700 900123")).toBe(canonical);
    expect(normalizePhone("00447700900123")).toBe(canonical);
  });

  it("returns empty string for empty / null / junk input", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone(undefined)).toBe("");
    expect(normalizePhone("n/a")).toBe("");
  });

  it("preserves non-UK / unrecognised numbers as digits-only (still self-equal)", () => {
    // US-style number: no +44/0044 prefix, no 12-digit-44 rule → digits only.
    expect(normalizePhone("+1 (415) 555-2671")).toBe("14155552671");
    expect(normalizePhone("1 415 555 2671")).toBe("14155552671");
  });

  it("only collapses a leading 44 when the result is a full 12-digit UK number", () => {
    // 12 digits starting 44 → UK, collapse to trunk 0.
    expect(normalizePhone("447700900123")).toBe("07700900123");
    // A 44... string of a different length is left untouched (no false collapse).
    expect(normalizePhone("4470012")).toBe("4470012");
  });
});
