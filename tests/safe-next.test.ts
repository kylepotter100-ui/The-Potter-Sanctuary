import { describe, it, expect } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext (post sign-in redirect)", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/account")).toBe("/account");
    expect(safeNext("/account/reschedule/abc?x=1")).toBe("/account/reschedule/abc?x=1");
    expect(safeNext("/questionnaire?booking=1#frag")).toBe("/questionnaire?booking=1");
  });
  it("rejects anything that leaves the site", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "/\\/evil.com", "\\\\evil.com", "/\tevil", "javascript:alert(1)", "evil.com", ""]) {
      expect(safeNext(bad)).toBe("/account");
    }
    expect(safeNext(null)).toBe("/account");
  });
});
