/**
 * Send-date and date-window math for the weekly newsletter.
 *
 * All calendar reasoning happens in America/Los_Angeles wall-clock time; the
 * UTC offset is derived per date so DST transitions land on the right hour.
 */

export const NEWSLETTER_TIME_ZONE = 'America/Los_Angeles';

const SEND_WEEKDAY = 4; // Thursday
const SEND_HOUR = 12;
const MIN_LEAD_MS = 60 * 60 * 1000;
const PLAN_AHEAD_START_DAYS = 14;
const PLAN_AHEAD_END_DAYS = 42;

const pacificParts = new Intl.DateTimeFormat('en-US', {
  timeZone: NEWSLETTER_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function pacificWallClock(instant: Date): { date: string; hour: number; minute: number; second: number } {
  const parts = Object.fromEntries(pacificParts.formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Shift a `YYYY-MM-DD` date by whole days. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Day of week (0 = Sunday) of a `YYYY-MM-DD` date. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** The instant at which the Pacific wall clock reads `date` at `hour`:00. */
function pacificInstant(date: string, hour: number): Date {
  const guess = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00Z`);
  const wall = pacificWallClock(guess);
  const wallAsUtc = Date.parse(
    `${wall.date}T${String(wall.hour).padStart(2, '0')}:${String(wall.minute).padStart(2, '0')}:${String(wall.second).padStart(2, '0')}Z`
  );
  const offsetMs = wallAsUtc - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}

/** The next Thursday 12:00 Pacific that is at least one hour after `now`. */
export function nextSendDate(now: Date): Date {
  const today = pacificWallClock(now).date;
  const daysUntilThursday = (SEND_WEEKDAY - weekdayOf(today) + 7) % 7;
  let candidateDate = addDays(today, daysUntilThursday);
  let candidate = pacificInstant(candidateDate, SEND_HOUR);
  if (candidate.getTime() - now.getTime() < MIN_LEAD_MS) {
    candidateDate = addDays(candidateDate, 7);
    candidate = pacificInstant(candidateDate, SEND_HOUR);
  }
  return candidate;
}

/** `YYYY-MM-DD` of the send in Pacific time; names the draft files. */
export function sendDateKey(send: Date): string {
  return pacificWallClock(send).date;
}

/** The send instant for a `YYYY-MM-DD` send-date key. */
export function sendInstantForKey(key: string): Date {
  return pacificInstant(key, SEND_HOUR);
}

export interface DateWindow {
  start: string;
  end: string;
}

/** "This week" is the Friday after the send through the next Thursday; "plan ahead" is 2–6 weeks out. */
export function issueWindows(send: Date): { thisWeek: DateWindow; planAhead: DateWindow } {
  const key = sendDateKey(send);
  return {
    thisWeek: { start: addDays(key, 1), end: addDays(key, 7) },
    planAhead: { start: addDays(key, PLAN_AHEAD_START_DAYS), end: addDays(key, PLAN_AHEAD_END_DAYS) },
  };
}
