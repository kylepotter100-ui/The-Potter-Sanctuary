import { describe, it, expect } from "vitest";
import { hashIp, isWithinLimit, clientIpFrom } from "@/lib/rate-limit";

// Unpeppered SHA-256 of "203.0.113.7", to prove the pepper is actually applied.
async function plainSha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("hashIp", () => {
  it("produces 64 hex characters", async () => {
    expect(await hashIp("203.0.113.7")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is stable for the same input", async () => {
    const a = await hashIp("203.0.113.7");
    const b = await hashIp("203.0.113.7");
    expect(a).toBe(b);
  });

  it("differs for different IPs", async () => {
    const a = await hashIp("203.0.113.7");
    const b = await hashIp("203.0.113.8");
    expect(a).not.toBe(b);
  });

  it("is peppered — not a bare SHA-256 of the address", async () => {
    // If this ever fails, the stored hashes have become rainbow-table
    // reversible back to real IP addresses.
    expect(await hashIp("203.0.113.7")).not.toBe(
      await plainSha256("203.0.113.7")
    );
  });

  it("handles IPv6 and the 'unknown' fallback", async () => {
    expect(await hashIp("2001:db8::1")).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashIp("unknown")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("isWithinLimit", () => {
  it("allows up to and including the limit", () => {
    // count includes the caller's own event, so the Nth request is the last
    // one allowed and the (N+1)th is blocked.
    expect(isWithinLimit(1, 10)).toBe(true);
    expect(isWithinLimit(9, 10)).toBe(true);
    expect(isWithinLimit(10, 10)).toBe(true);
  });

  it("blocks past the limit", () => {
    expect(isWithinLimit(11, 10)).toBe(false);
    expect(isWithinLimit(999, 10)).toBe(false);
  });

  it("handles a limit of 1", () => {
    expect(isWithinLimit(1, 1)).toBe(true);
    expect(isWithinLimit(2, 1)).toBe(false);
  });
});

describe("clientIpFrom", () => {
  it("reads the Cloudflare-set header", () => {
    const req = new Request("https://example.com", {
      headers: { "cf-connecting-ip": "203.0.113.7" },
    });
    expect(clientIpFrom(req)).toBe("203.0.113.7");
  });

  it("falls back to 'unknown' when absent", () => {
    expect(clientIpFrom(new Request("https://example.com"))).toBe("unknown");
  });

  it("ignores X-Forwarded-For, which the client can spoof", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(clientIpFrom(req)).toBe("unknown");
  });
});
