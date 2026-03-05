import type { ScrapedEvent } from './types';

/** Parse a date string into YYYY-MM-DD format. Returns null if unparseable. */
export function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Try native Date parsing
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  // "DD Mon" or "Mon DD" relative to current year (e.g. "09 Mar", "Mar 09")
  const monthNames: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const mdMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3,})/);
  const dmMatch = trimmed.match(/^([A-Za-z]{3,})\s+(\d{1,2})/);
  if (mdMatch || dmMatch) {
    const day = parseInt(mdMatch ? mdMatch[1] : dmMatch![2]);
    const monStr = (mdMatch ? mdMatch[2] : dmMatch![1]).toLowerCase().slice(0, 3);
    const month = monthNames[monStr];
    if (month !== undefined && day >= 1 && day <= 31) {
      const year = new Date().getFullYear();
      const result = new Date(year, month, day);
      return result.toISOString().split('T')[0];
    }
  }

  return null;
}

/** Parse a time string into HH:MM 24-hour format. Returns null if unparseable. */
export function normalizeTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();

  // Already HH:MM 24h
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;

  // HH:MM:SS
  const hmsMatch = trimmed.match(/^(\d{1,2}):(\d{2}):\d{2}$/);
  if (hmsMatch) {
    return `${hmsMatch[1].padStart(2, '0')}:${hmsMatch[2]}`;
  }

  // 12h format: "7:00 pm", "12:30 AM", "7pm"
  const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)$/);
  if (match12) {
    let hour = parseInt(match12[1]);
    const min = match12[2] || '00';
    const period = match12[3].replace(/\./g, '');
    if (period === 'pm' && hour !== 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${min}`;
  }

  return null;
}

/** Normalize a URL — add https:// if missing, return null for empty. */
export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === '') return null;
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

/** Normalize cost string to a standard format. */
export function normalizeCost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower === 'free' || lower === '$0' || lower === 'no cost' || lower === 'no charge') {
    return 'Free';
  }

  // Already looks like a price
  if (/^\$/.test(trimmed)) return trimmed;

  // Just a number — add dollar sign
  if (/^\d+(\.\d{2})?$/.test(trimmed)) return `$${trimmed}`;

  return trimmed;
}

/** Check if an event's date has already passed (before today). */
export function isPastEvent(event: ScrapedEvent): boolean {
  const today = new Date().toISOString().split('T')[0];
  if (event.end_date) return event.end_date < today;
  return event.start_date < today;
}

/** Apply all normalizations to a scraped event in-place and return it. */
export function normalizeEvent(event: ScrapedEvent): ScrapedEvent {
  event.start_date = normalizeDate(event.start_date) || event.start_date;
  event.end_date = normalizeDate(event.end_date) || null;
  event.start_time = normalizeTime(event.start_time);
  event.end_time = normalizeTime(event.end_time);
  event.website = normalizeUrl(event.website);
  event.registration_url = normalizeUrl(event.registration_url);
  event.image_url = normalizeUrl(event.image_url);
  event.cost = normalizeCost(event.cost);
  return event;
}
