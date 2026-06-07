// Small, dependency-free input-validation helpers shared by API route handlers.
// Server-side guards against oversized payloads (DoS / DB bloat / UI overflow)
// and malformed email recipients. These are defensive caps — they do not change
// what counts as valid business input.

// True when a string value exceeds `max` characters. Non-strings are ignored
// (callers handle type/required separately).
export function tooLong(value: unknown, max: number): boolean {
  return typeof value === "string" && value.length > max;
}

// Returns the first field whose value exceeds its cap, or null if all are within
// limits. Usage: const bad = firstTooLong({ fname: [v, 100], message: [m, 5000] }).
export function firstTooLong(
  fields: Record<string, [unknown, number]>
): string | null {
  for (const [name, [value, max]] of Object.entries(fields)) {
    if (tooLong(value, max)) return name;
  }
  return null;
}

// Conservative email format check for defense-in-depth before sending mail.
// Not a full RFC validator — just rejects obviously malformed / injectable values.
export function isValidEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

// Strip CR/LF and cap length on values interpolated into email subject lines
// (defense-in-depth against header injection).
export function safeSubject(value: string, max = 200): string {
  return value.replace(/[\r\n]+/g, " ").slice(0, max);
}
