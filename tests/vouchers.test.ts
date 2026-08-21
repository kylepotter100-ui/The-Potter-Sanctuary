import { describe, it, expect } from "vitest";
import { services } from "@/lib/services";
import {
  generateVoucherCode,
  isValidVoucherCodeFormat,
  isComplimentaryVoucher,
  voucherValueLabel,
  normalizeVoucherCode,
  voucherBookingIssue,
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

describe("normalizeVoucherCode", () => {
  it("accepts the ways people actually type a code", () => {
    for (const input of [
      "PS-7F2A-9K3D",
      "ps-7f2a-9k3d",
      "  PS-7F2A-9K3D  ",
      "PS7F2A9K3D",
      "ps 7f2a 9k3d",
      "PS--7F2A--9K3D",
    ]) {
      expect(normalizeVoucherCode(input)).toBe("PS-7F2A-9K3D");
    }
  });

  it("leaves unrecognisable input for the format check to reject", () => {
    // Never decides validity itself — just uppercases and hands on.
    expect(normalizeVoucherCode("hello")).toBe("HELLO");
    expect(normalizeVoucherCode("")).toBe("");
    expect(isValidVoucherCodeFormat(normalizeVoucherCode("hello"))).toBe(false);
  });

  it("does not invent a valid code from an ambiguous-character one", () => {
    // I/O/0/1 are excluded from the alphabet, so this must stay rejected.
    expect(isValidVoucherCodeFormat(normalizeVoucherCode("PS-0OI1-9K3D"))).toBe(
      false
    );
  });
});

describe("voucherBookingIssue", () => {
  const TODAY = "2026-08-21";
  const active = {
    status: "active",
    expires_at: "2027-08-21",
    treatment_id: "full-body-aromatherapy",
  };

  it("passes an active, in-date, matching voucher", () => {
    expect(voucherBookingIssue(active, "full-body-aromatherapy", TODAY)).toBe(
      null
    );
  });

  it("never expires when expires_at is null", () => {
    expect(
      voucherBookingIssue(
        { ...active, expires_at: null },
        "full-body-aromatherapy",
        TODAY
      )
    ).toBe(null);
  });

  it("is inclusive of the expiry date", () => {
    // "Valid until 21 Aug" must still work ON the 21st.
    expect(
      voucherBookingIssue(
        { ...active, expires_at: TODAY },
        "full-body-aromatherapy",
        TODAY
      )
    ).toBe(null);
    expect(
      voucherBookingIssue(
        { ...active, expires_at: "2026-08-20" },
        "full-body-aromatherapy",
        TODAY
      )
    ).toBe("expired");
  });

  it("rejects a redeemed voucher", () => {
    expect(
      voucherBookingIssue(
        { ...active, status: "redeemed" },
        "full-body-aromatherapy",
        TODAY
      )
    ).toBe("not_active");
  });

  it("rejects a treatment mismatch", () => {
    expect(voucherBookingIssue(active, "hot-stones-full", TODAY)).toBe(
      "treatment_mismatch"
    );
  });

  it("reports not_active FIRST, leaking nothing about a used voucher", () => {
    // A redeemed code must not reveal its expiry or its treatment — that
    // ordering is the anti-enumeration guarantee.
    expect(
      voucherBookingIssue(
        { status: "redeemed", expires_at: "2020-01-01", treatment_id: "x" },
        "full-body-aromatherapy",
        TODAY
      )
    ).toBe("not_active");
  });

  it("treats a complimentary (£0) voucher like any other", () => {
    // Value plays no part here — a £0 voucher books exactly the same way.
    expect(voucherBookingIssue(active, "full-body-aromatherapy", TODAY)).toBe(
      null
    );
  });

  it("accepts every real treatment id", () => {
    for (const svc of services) {
      expect(
        voucherBookingIssue(
          { ...active, treatment_id: svc.bookingId },
          svc.bookingId,
          TODAY
        )
      ).toBe(null);
    }
  });
});
