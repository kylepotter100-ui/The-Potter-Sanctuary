import { describe, it, expect } from "vitest";
import {
  createAdminSessionToken,
  verifyAdminSessionToken,
  constantTimeEqual,
} from "@/lib/admin-session";

const SECRET = "test-secret-0123456789abcdef0123456789abcdef";
const NOW = 1_800_000_000_000;

describe("admin session token", () => {
  it("verifies a token it issued", async () => {
    const t = await createAdminSessionToken(SECRET, NOW, 60);
    expect(await verifyAdminSessionToken(SECRET, t, NOW + 1000)).toBe(true);
  });

  it("rejects the legacy forgeable literal", async () => {
    expect(await verifyAdminSessionToken(SECRET, "authenticated", NOW)).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const t = await createAdminSessionToken("another-secret-0123456789abcdef0123456", NOW, 60);
    expect(await verifyAdminSessionToken(SECRET, t, NOW)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const t = await createAdminSessionToken(SECRET, NOW, 60);
    expect(await verifyAdminSessionToken(SECRET, t, NOW + 61_000)).toBe(false);
  });

  it("rejects a token whose expiry was edited", async () => {
    const t = await createAdminSessionToken(SECRET, NOW, 60);
    const [v, exp, sig] = t.split(".");
    const tampered = `${v}.${Number(exp) + 10_000_000}.${sig}`;
    expect(await verifyAdminSessionToken(SECRET, tampered, NOW)).toBe(false);
  });

  it("rejects malformed input without throwing", async () => {
    for (const bad of ["", "v1", "v1.x.y", "v1.123.%%%", "v2.9999999999999.abc", null, undefined]) {
      expect(await verifyAdminSessionToken(SECRET, bad as string, NOW)).toBe(false);
    }
  });

  it("fails closed with no secret", async () => {
    const t = await createAdminSessionToken(SECRET, NOW, 60);
    expect(await verifyAdminSessionToken(null, t, NOW)).toBe(false);
  });
});

describe("constantTimeEqual", () => {
  it("matches equal strings only", async () => {
    expect(await constantTimeEqual("hunter2", "hunter2")).toBe(true);
    expect(await constantTimeEqual("hunter2", "hunter3")).toBe(false);
    expect(await constantTimeEqual("", "x")).toBe(false);
  });
});
