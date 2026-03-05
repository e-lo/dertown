import ical from 'node-ical';
import type { ScrapedEvent } from './types';

/** Parse an iCal feed string into ScrapedEvent objects. */
export function parseIcalFeed(icalText: string): ScrapedEvent[] {
  const parsed = ical.sync.parseICS(icalText);
  const events: ScrapedEvent[] = [];

  for (const key of Object.keys(parsed)) {
    const item = parsed[key];
    if (item.type !== 'VEVENT') continue;

    const startDate = extractDate(item.start);
    if (!startDate) continue; // skip entries without a date

    const startTime = extractTime(item.start);
    const endDate = extractDate(item.end);
    const endTime = extractTime(item.end);

    // If start and end are the same date, don't set end_date
    const effectiveEndDate = endDate && endDate !== startDate ? endDate : null;

    events.push({
      title: cleanIcalText(item.summary || ''),
      description: cleanIcalText(item.description || null),
      start_date: startDate,
      end_date: effectiveEndDate,
      start_time: startTime,
      end_time: endTime,
      location_name: cleanIcalText(extractLocationName(item.location)),
      cost: null, // iCal doesn't have a cost field
      registration_required: null,
      registration_url: null,
      website: item.url || null,
      image_url: null,
    });
  }

  return events;
}

/** Extract YYYY-MM-DD from an iCal date/datetime value. */
function extractDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  const str = String(val);
  // YYYYMMDD or YYYYMMDDTHHMMSS
  const match = str.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return null;
}

/** Extract HH:MM from an iCal datetime value. Returns null for all-day events. */
function extractTime(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    const h = val.getHours();
    const m = val.getMinutes();
    // All-day events often have 00:00 — we'll still return it,
    // the caller can decide if it's meaningful
    if (h === 0 && m === 0) return null;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const str = String(val);
  const match = str.match(/T(\d{2})(\d{2})(\d{2})/);
  if (match) {
    const h = parseInt(match[1]);
    const m = parseInt(match[2]);
    if (h === 0 && m === 0) return null;
    return `${match[1]}:${match[2]}`;
  }
  return null;
}

/** Extract just the venue name from a full iCal LOCATION string.
 *  e.g. "Bushel & Bee Taproom, 900 Front Street, Leavenworth, WA" → "Bushel & Bee Taproom"
 */
function extractLocationName(location: string | null | undefined): string | null {
  if (!location) return null;
  // iCal LOCATION is often "Venue Name, Street Address, City, State, ZIP, Country"
  // Take the first comma-separated part as the venue name
  const parts = location.split(',');
  return parts[0].trim() || null;
}

/** Clean iCal text: unescape commas, semicolons, strip excessive whitespace. */
function cleanIcalText(text: string | null | undefined): string | null {
  if (!text) return null;
  return text
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim() || null;
}
