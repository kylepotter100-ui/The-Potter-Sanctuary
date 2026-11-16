// Shared field validation for booking payloads (public + admin manual). Pure —
// unit-tested in tests/booking-validate.test.ts.
//
// Why caps and a URL ban on names: the customer's first name is echoed into a
// confirmation email sent FROM the studio's domain to whatever address was
// typed. Without limits, a script could book with
// `fname: "Claim your prize at https://evil.example"` and use the studio as a
// spam/phishing relay, burning its sender reputation.

export const LIMITS = {
  name: 60,
  email: 254,
  phone: 30,
  message: 1000,
  reviewComment: 2000,
} as const;

const URLISH = /(:\/\/|www\.|\.(com|net|org|io|co|ru|xyz|info|top|click|link)\b|[<>]|@)/i;

export type BookingFields = {
  fname: unknown;
  lname: unknown;
  email: unknown;
  phone: unknown;
  message?: unknown;
};

/** Returns a customer-friendly error message, or null when the fields are fine. */
export function bookingFieldsProblem(f: BookingFields): string | null {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const fname = str(f.fname);
  const lname = str(f.lname);
  const email = str(f.email);
  const phone = str(f.phone);
  const message = f.message == null ? "" : str(f.message);

  if (!fname || !lname) return "Please enter your first and last name.";
  if (fname.length > LIMITS.name || lname.length > LIMITS.name) {
    return `Names can be at most ${LIMITS.name} characters.`;
  }
  if (URLISH.test(fname) || URLISH.test(lname)) {
    return "Please enter just your name (no links or symbols).";
  }
  if (!email || email.length > LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Please enter a valid email address.";
  }
  const digits = phone.replace(/\D/g, "");
  if (!phone || phone.length > LIMITS.phone || digits.length < 7 || !/^[0-9+()\-\s.]+$/.test(phone)) {
    return "Please enter a valid phone number.";
  }
  if (f.message != null && typeof f.message !== "string") return "Invalid message.";
  if (message.length > LIMITS.message) {
    return `Your note can be at most ${LIMITS.message} characters.`;
  }
  return null;
}
