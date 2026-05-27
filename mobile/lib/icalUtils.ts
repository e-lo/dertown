/**
 * Local iCal generation and sharing.
 *
 * Builds a .ics file entirely from data already in the app — no network
 * request, no SSL dependency. Works in dev and prod identically.
 *
 * On iOS the share sheet surfaces "Add to Calendar" directly.
 * On Android calendar apps (Google Calendar, Samsung Calendar, etc.)
 * appear in the system share dialog.
 */
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Minimal shape needed to build a VEVENT. */
export interface ICSEventData {
  id: string;
  title: string;
  start_date: string;              // "YYYY-MM-DD"
  start_time: string | null;       // "HH:MM:SS" or null (all-day)
  end_date?: string | null;        // "YYYY-MM-DD"
  end_time: string | null;         // "HH:MM:SS"
  location?: { name: string; address?: string | null } | null;
  description?: string | null;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a date+time as iCal local time string: YYYYMMDDTHHMMSS */
function icalLocalDT(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-');
  const [h, min, s] = timeStr.split(':');
  return `${y}${m}${d}T${pad(Number(h))}${pad(Number(min))}${pad(Number(s ?? 0))}`;
}

/** Add one hour to a HH:MM:SS string (string-only, no Date, no timezone risk). */
function addOneHour(timeStr: string): string {
  const [h, m, s] = timeStr.split(':').map(Number);
  return `${pad((h + 1) % 24)}${pad(m)}${pad(s ?? 0)}`;
}

const VTIMEZONE = `BEGIN:VTIMEZONE\r\nTZID:America/Los_Angeles\r\nX-LIC-LOCATION:America/Los_Angeles\r\nBEGIN:DAYLIGHT\r\nTZOFFSETFROM:-0800\r\nTZOFFSETTO:-0700\r\nTZNAME:PDT\r\nDTSTART:19700308T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\r\nEND:DAYLIGHT\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:-0700\r\nTZOFFSETTO:-0800\r\nTZNAME:PST\r\nDTSTART:19701101T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r\nEND:STANDARD\r\nEND:VTIMEZONE`;

function buildVEvent(event: ICSEventData, dtstamp: string): string | null {
  try {
    const endDate = event.end_date ?? event.start_date;
    const isAllDay = !event.start_time;

    let dtstart: string;
    let dtend: string;

    if (isAllDay) {
      const [y, m, d] = endDate.split('-').map(Number);
      // iCal all-day DTEND is exclusive — next day
      const next = new Date(y, m - 1, d + 1);
      const nextStr = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
      dtstart = `DTSTART;VALUE=DATE:${event.start_date.replace(/-/g, '')}`;
      dtend   = `DTEND;VALUE=DATE:${nextStr}`;
    } else {
      dtstart = `DTSTART;TZID=America/Los_Angeles:${icalLocalDT(event.start_date, event.start_time!)}`;
      const endTimeStr = event.end_time
        ? icalLocalDT(endDate, event.end_time)
        : icalLocalDT(event.start_date, addOneHour(event.start_time!));
      dtend = `DTEND;TZID=America/Los_Angeles:${endTimeStr}`;
    }

    const locationStr = event.location?.address ?? event.location?.name ?? '';
    const lines = [
      'BEGIN:VEVENT',
      dtstart,
      dtend,
      `DTSTAMP:${dtstamp}`,
      `UID:${event.id}@dertown.com`,
      `SUMMARY:${(event.title ?? 'Event').replace(/[,;]/g, (c) => `\\${c}`)}`,
      locationStr ? `LOCATION:${locationStr.replace(/[,;]/g, (c) => `\\${c}`)}` : null,
      event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : null,
      'END:VEVENT',
    ].filter(Boolean) as string[];

    return lines.join('\r\n');
  } catch {
    return null;
  }
}

/**
 * Generate an in-memory iCal string for one or more events,
 * write it to the app cache, then open the system share sheet.
 *
 * @param events  One event (single) or many (series).
 * @param calName Display name shown in the Calendar app.
 */
export async function shareEventsAsICS(
  events: ICSEventData[],
  calName: string
): Promise<void> {
  const dtstamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

  const vevents = events
    .map((e) => buildVEvent(e, dtstamp))
    .filter(Boolean) as string[];

  if (vevents.length === 0) throw new Error('No valid events to export');

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Der Town//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    VTIMEZONE,
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n');

  const safeName = calName.replace(/[^a-z0-9]/gi, '_').slice(0, 60);
  const path = `${FileSystem.cacheDirectory}${safeName}.ics`;

  await FileSystem.writeAsStringAsync(path, ical, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(path, {
    mimeType: 'text/calendar',
    UTI: 'com.apple.ical.ics',   // iOS hint so Calendar.app is surfaced first
    dialogTitle: 'Add to Calendar',
  });
}
