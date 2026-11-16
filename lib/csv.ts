// CSV cell encoding for the admin bookings export.

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Formula injection: a customer-typed name like `=HYPERLINK(...)` or
  // `+cmd|...` would execute when the owner opens the export in Excel/Sheets.
  // A leading apostrophe makes the spreadsheet treat the cell as plain text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  // Quote and escape if the value contains comma, quote, or newline.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
