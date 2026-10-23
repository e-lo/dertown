import type { DateWindow } from './dates';
import type { IssueEvent, NewsletterSourceEvent } from './types';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_PLURAL = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDate(date: string): { weekday: number; month: number; day: number } {
  const d = new Date(`${date}T12:00:00Z`);
  return { weekday: d.getUTCDay(), month: d.getUTCMonth(), day: d.getUTCDate() };
}

function monthDay(date: string): string {
  const { month, day } = parseDate(date);
  return `${MONTH_SHORT[month]} ${day}`;
}

/** '18:00:00' → '6pm', '19:30:00' → '7:30pm'. */
export function formatClockTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour12}:${String(m).padStart(2, '0')}${suffix}` : `${hour12}${suffix}`;
}

function joinWithAmpersand(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`;
}

function singleOccurrenceLabel(row: NewsletterSourceEvent): string {
  const start = parseDate(row.start_date);
  if (row.end_date && row.end_date > row.start_date) {
    const end = parseDate(row.end_date);
    const endLabel = end.month === start.month ? String(end.day) : monthDay(row.end_date);
    return `${WEEKDAY_SHORT[start.weekday]}–${WEEKDAY_SHORT[end.weekday]}, ${monthDay(row.start_date)}–${endLabel}`;
  }
  const time = row.start_time ? formatClockTime(row.start_time) : 'All day';
  return `${WEEKDAY_SHORT[start.weekday]}, ${monthDay(row.start_date)} · ${time}`;
}

function seriesLabel(occurrences: NewsletterSourceEvent[]): string {
  const weekdays = [...new Set(occurrences.map((o) => parseDate(o.start_date).weekday))];
  const days = joinWithAmpersand(weekdays.map((w) => WEEKDAY_PLURAL[w]));
  const times = new Set(occurrences.map((o) => o.start_time));
  if (times.size !== 1) return days;
  const [time] = times;
  return `${days} · ${time ? formatClockTime(time) : 'All day'}`;
}

function overlaps(row: NewsletterSourceEvent, window: DateWindow): boolean {
  return row.start_date <= window.end && (row.end_date ?? row.start_date) >= window.start;
}

function byStart(a: NewsletterSourceEvent, b: NewsletterSourceEvent): number {
  return a.start_date.localeCompare(b.start_date) || (a.start_time ?? '').localeCompare(b.start_time ?? '');
}

/**
 * Events overlapping `window`, one entry per event or recurring series, sorted
 * by the day they're listed under and then start time.
 */
export function selectIssueEvents(rows: NewsletterSourceEvent[], window: DateWindow): IssueEvent[] {
  const groups = new Map<string, NewsletterSourceEvent[]>();
  for (const row of rows.filter((r) => overlaps(r, window))) {
    const key = row.parent_event_id ?? row.id;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const entries = [...groups.entries()].map(([key, group]) => {
    const occurrences = [...group].sort(byStart);
    const representative = occurrences.find((o) => o.id === key) ?? occurrences[0];
    const first = occurrences[0];
    const event: IssueEvent = {
      id: key,
      title: representative.title,
      displayDate: first.start_date > window.start ? first.start_date : window.start,
      whenLabel: occurrences.length > 1 ? seriesLabel(occurrences) : singleOccurrenceLabel(first),
      locationName: representative.location_name,
      imageUrl: representative.external_image_url,
      imageAlt: representative.image_alt_text,
      description: representative.description,
      featured: occurrences.some((o) => o.featured === true),
      tag: representative.primary_tag_name,
      occurrenceIds: occurrences.map((o) => o.id),
    };
    return { event, sortTime: first.start_time ?? '' };
  });

  return entries
    .sort((a, b) => a.event.displayDate.localeCompare(b.event.displayDate) || a.sortTime.localeCompare(b.sortTime))
    .map((e) => e.event);
}
