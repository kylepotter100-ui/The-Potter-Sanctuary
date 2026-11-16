// Part-day personal time ("block out 12:00–13:30 for lunch"). Implemented as
// per-date slot_overrides with is_active=false for every 15-minute segment in
// the range, so the public calendar, /api/availability and server-side slot
// validation all honour it with no extra code: candidateRejection rejects any
// treatment whose segments touch a closed one, so a 60-minute session can't
// start at 11:30 and run into a 12:00 block. Pure helpers — unit-tested.

import { BUFFER_MINUTES, minutesToTime, timeToMinutes } from "@/lib/availability";

export const GRID = 15;
export const EARLIEST = "06:00";
export const LATEST = "22:00";

/** "HH:MM" segments covering [from, to). Null if the range is invalid. */
export function segmentsInRange(from: string, to: string): string[] | null {
  if (!/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to)) return null;
  const a = timeToMinutes(from);
  const b = timeToMinutes(to);
  if (a % GRID !== 0 || b % GRID !== 0) return null;
  if (a >= b) return null;
  if (a < timeToMinutes(EARLIEST) || b > timeToMinutes(LATEST)) return null;
  const out: string[] = [];
  for (let m = a; m < b; m += GRID) out.push(minutesToTime(m));
  return out;
}

/**
 * Existing bookings whose session [start, start+duration) overlaps the block
 * [from, to). The cleanup buffer after a session is not counted — it's fine
 * for the owner's own time to begin while the room is being reset.
 */
export function bookingsClashingWithBlock(
  from: string,
  to: string,
  bookings: { id: string; time: string; duration_minutes: number; name?: string }[]
): typeof bookings {
  const a = timeToMinutes(from);
  const b = timeToMinutes(to);
  return bookings.filter((bk) => {
    const s = timeToMinutes(bk.time);
    const e = s + bk.duration_minutes;
    return s < b && a < e;
  });
}

export { BUFFER_MINUTES };
