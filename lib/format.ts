// Shared date / time formatters used by booking emails.

export function formatLongDate(iso: string): string {
  // "2025-06-02" → "Monday, 2 June 2025"
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatTime12h(t: string): string {
  // "10:30" or "10:30:00" → "10:30am"
  const [hStr, mStr] = t.split(":");
  const h24 = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h24) || Number.isNaN(m)) return t;
  const period = h24 >= 12 ? "pm" : "am";
  const h12 = ((h24 + 11) % 12) + 1;
  const mm = m.toString().padStart(2, "0");
  return m === 0 ? `${h12}${period}` : `${h12}:${mm}${period}`;
}

export function formatTimestamp(d: Date = new Date()): string {
  // "Mon, 2 Jun 2025, 10:30"
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
