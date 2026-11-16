import { describe, it, expect } from "vitest";
import { bookingFieldsProblem, LIMITS } from "@/lib/booking-validate";

const ok = { fname: "Jane", lname: "O'Neill-Smith", email: "jane@example.co.uk", phone: "+44 (0)7700 900123", message: "Allergic to nuts" };

describe("bookingFieldsProblem", () => {
  it("accepts ordinary details", () => {
    expect(bookingFieldsProblem(ok)).toBeNull();
    expect(bookingFieldsProblem({ ...ok, message: undefined })).toBeNull();
    expect(bookingFieldsProblem({ ...ok, fname: "Zoë", lname: "Ó Briain" })).toBeNull();
  });
  it("rejects links and markup in names (email-relay spam)", () => {
    for (const bad of ["Win at https://x.io", "www.spam", "visit evil.com now", "<b>Jo</b>", "a@b"]) {
      expect(bookingFieldsProblem({ ...ok, fname: bad })).toMatch(/just your name/);
    }
  });
  it("caps lengths", () => {
    expect(bookingFieldsProblem({ ...ok, lname: "x".repeat(LIMITS.name + 1) })).toMatch(/at most/);
    expect(bookingFieldsProblem({ ...ok, message: "x".repeat(LIMITS.message + 1) })).toMatch(/at most/);
    expect(bookingFieldsProblem({ ...ok, email: "a".repeat(250) + "@x.co" })).toMatch(/email/);
  });
  it("rejects junk phone numbers", () => {
    for (const bad of ["123", "call me", "0770090012312312312312312312312"]) {
      expect(bookingFieldsProblem({ ...ok, phone: bad })).toMatch(/phone/);
    }
  });
  it("rejects non-string types", () => {
    expect(bookingFieldsProblem({ ...ok, fname: { $ne: 1 } })).not.toBeNull();
    expect(bookingFieldsProblem({ ...ok, message: 42 })).not.toBeNull();
  });
});
