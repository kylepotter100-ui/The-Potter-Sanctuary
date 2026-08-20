import { describe, it, expect } from "vitest";
import { services } from "@/lib/services";
import {
  generateVoucherCode,
  isValidVoucherCodeFormat,
  isComplimentaryVoucher,
  voucherValueLabel,
} from "@/lib/vouchers";

describe("generateVoucherCode", () => {
  it("always produces PS-XXXX-XXXX in the unambiguous alphabet", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateVoucherCode();
      expect(code).toMatch(/^PS-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(isValidVoucherCodeFormat(code)).toBe(true);
    }
  });

  it("never uses ambiguous characters (0, O, 1, I)", () => {
    const joined = Array.from({ length: 300 }, () => generateVoucherCode()).join("");
    expect(joined).not.toMatch(/[01OI]/);
  });

  it("is reasonably unique across many draws", () => {
    const set = new Set(Array.from({ length: 2000 }, () => generateVoucherCode()));
    expect(set.size).toBeGreaterThan(1990);
  });
});

describe("isValidVoucherCodeFormat", () => {
  it("accepts a well-formed code", () => {
    expect(isValidVoucherCodeFormat("PS-7F2A-9K3D")).toBe(true);
  });

  it("rejects malformed codes", () => {
    for (const bad of [
      "",
      "PS-XXXX",
      "ps-abcd-efgh", // lowercase
      "PS-ABC-DEFG", // wrong length
      "XX-ABCD-EFGH", // wrong prefix
      "PS-ABCD-EFG0", // ambiguous 0
      "PS-ABCD-EFGI", // ambiguous I
      "PS-ABCDEFGH", // missing separators
    ]) {
      expect(isValidVoucherCodeFormat(bad)).toBe(false);
    }
  });
});

describe("isComplimentaryVoucher", () => {
  it("treats only a zero value as complimentary", () => {
    expect(isComplimentaryVoucher(0)).toBe(true);
    for (const price of [25, 35, 50, 60]) {
      expect(isComplimentaryVoucher(price)).toBe(false);
    }
  });

  it("holds for every real treatment price", () => {
    // The derived-from-zero rule is only unambiguous while every treatment
    // costs something. If a £0 treatment is ever added, this fails loudly.
    for (const s of services) {
      expect(isComplimentaryVoucher(s.price)).toBe(false);
    }
  });
});

describe("voucherValueLabel", () => {
  it("reads 'Complimentary' at zero, never '£0'", () => {
    expect(voucherValueLabel(0)).toBe("Complimentary");
    expect(voucherValueLabel(0)).not.toContain("0");
  });

  it("renders a plain pounds amount otherwise", () => {
    expect(voucherValueLabel(50)).toBe("£50");
    expect(voucherValueLabel(25)).toBe("£25");
  });
});
