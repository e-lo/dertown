import type { MobileEvent } from './types';

/** Format "HH:MM:SS" → "h:MM AM/PM". Returns "" for null. */
export function formatTime(time: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12; // 0 → 12 (midnight), 12 → 12 (noon)
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

/** Format a start/end time pair as "h:MM AM – h:MM PM" or just "h:MM AM" if no end. */
export function formatTimeRange(startTime: string | null, endTime: string | null): string {
  const start = formatTime(startTime);
  if (!start) return '';
  const end = formatTime(endTime);
  if (!end) return start;
  return `${start} – ${end}`;
}

/** Format "YYYY-MM-DD" for the DayHeader separator. */
export function formatDayHeader(dateStr: string): {
  dayOfWeek: string;
  dayNum: string;
  month: string;
} {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Use local date constructor to avoid UTC offset issues
  const date = new Date(year, month - 1, day);
  return {
    dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
    dayNum: String(day),
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

/** Format a Date object as "YYYY-MM-DD". */
export function getDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's date as "YYYY-MM-DD" in local time. */
export function getTodayDateString(): string {
  return getDateString(new Date());
}

/** Group a sorted event list by start_date. */
export function groupEventsByDate(
  events: MobileEvent[]
): Array<{ date: string; events: MobileEvent[] }> {
  const groups = new Map<string, MobileEvent[]>();
  for (const event of events) {
    const date = event.start_date;
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(event);
  }
  return Array.from(groups.entries()).map(([date, evts]) => ({
    date,
    events: evts.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')),
  }));
}

/**
 * Filter to events that start today or later (or whose end_date is today or later).
 * Pass todayStr as "YYYY-MM-DD"; defaults to today if omitted.
 */
export function filterUpcoming(events: MobileEvent[], todayStr?: string): MobileEvent[] {
  const today = todayStr ?? getTodayDateString();
  return events.filter((event) => {
    if (!event.start_date) return false;
    if (event.start_date >= today) return true;
    if (event.end_date && event.end_date >= today) return true;
    return false;
  });
}

/** Quick-select date ranges for the DatePickerModal. */
export function getThisWeekendRange(): { start: string; end: string } {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 6=Sat
  const todayStr = getDateString(today);

  if (day === 0) {
    // Sunday — the weekend started yesterday; return just today as the remaining weekend day
    return { start: todayStr, end: todayStr };
  }

  const daysUntilSat = day === 6 ? 0 : (6 - day); // Sat=today, otherwise count to Sat
  const sat = new Date(today);
  sat.setDate(today.getDate() + daysUntilSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  return { start: getDateString(sat), end: getDateString(sun) };
}

export function getNextWeekRange(): { start: string; end: string } {
  const today = new Date();
  const day = today.getDay();
  const daysUntilMon = day === 0 ? 1 : (8 - day);
  const mon = new Date(today);
  mon.setDate(today.getDate() + daysUntilMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: getDateString(mon), end: getDateString(sun) };
}
