// "Add to calendar" for client emails: an iCalendar (.ics) attachment that
// Apple Calendar, Outlook and Gmail all understand, plus one-click Google and
// Outlook.com links. Times come from lib/uk-time (rule 3: booking date/time are
// UK wall-clock values) and are written in UTC so every device shows the
// right local time. Pure — unit-tested.

import { ukWallTimeToUtc } from "@/lib/uk-time";
import { siteConfig } from "@/lib/site";

export type CalendarBooking = {
  bookingId: string;
  date: string; // YYYY-MM-DD (UK)
  time: string; // HH:MM[:SS] (UK)
  durationMinutes: number;
  treatmentName: string;
  /** Bump on every change (reschedule/treatment change) so calendars update. */
  sequence?: number;
};

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// RFC 5545: lines over 75 octets are folded with CRLF + space.
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 75;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

export function eventTimes(b: CalendarBooking) {
  const start = ukWallTimeToUtc(b.date, b.time.slice(0, 5));
  const end = new Date(start.getTime() + b.durationMinutes * 60_000);
  return { start, end };
}

export function eventTitle(b: CalendarBooking) {
  return `${b.treatmentName} — ${siteConfig.name}`;
}

export function eventDetails(b: CalendarBooking) {
  return `Your ${b.treatmentName} at ${siteConfig.name}.\nManage or reschedule: ${siteConfig.url}/account\nQuestions: ${siteConfig.contact.email}`;
}

export function buildIcs(b: CalendarBooking, now: Date = new Date()): string {
  const { start, end } = eventTimes(b);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Potter Sanctuary//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.bookingId}@thepottersanctuary.co.uk`,
    `SEQUENCE:${b.sequence ?? 0}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(eventTitle(b))}`,
    `DESCRIPTION:${esc(eventDetails(b))}`,
    `LOCATION:${esc(siteConfig.privateAddress)}`,
    `URL:${siteConfig.url}/account`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(eventTitle(b))}`,
    "TRIGGER:-PT2H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Resend attachment (base64 via btoa — Web APIs only, rule 1). */
export function icsAttachment(b: CalendarBooking) {
  const bytes = new TextEncoder().encode(buildIcs(b));
  let bin = "";
  for (const x of bytes) bin += String.fromCharCode(x);
  return {
    filename: "the-potter-sanctuary-appointment.ics",
    content: btoa(bin),
    contentType: "text/calendar; charset=utf-8; method=PUBLISH",
  };
}

export function googleCalendarUrl(b: CalendarBooking): string {
  const { start, end } = eventTimes(b);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: eventTitle(b),
    dates: `${stamp(start)}/${stamp(end)}`,
    details: eventDetails(b),
    location: siteConfig.privateAddress,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function outlookCalendarUrl(b: CalendarBooking): string {
  const { start, end } = eventTimes(b);
  const q = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: eventTitle(b),
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: eventDetails(b),
    location: siteConfig.privateAddress,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${q.toString()}`;
}

export function directionsUrl(): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(siteConfig.privateAddress)}`;
}

/** Everything an appointment email needs for its calendar + directions block. */
export function emailCalendar(b: CalendarBooking) {
  return {
    googleUrl: googleCalendarUrl(b),
    outlookUrl: outlookCalendarUrl(b),
    directionsUrl: directionsUrl(),
    address: siteConfig.privateAddress,
    notes: siteConfig.arrivalNotes || null,
  };
}
