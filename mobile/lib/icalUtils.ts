/**
 * Calendar integration utilities.
 *
 * addEventsToCalendar  — iOS: adds events directly via expo-calendar (silent, no share sheet).
 *                        Android: opens the native Google Calendar "Add Event" screen via
 *                        ACTION_INSERT intent so the user sees the normal calendar picker.
 *
 * shareEventsAsICS     — writes a .ics file and opens the share sheet.
 *                        Still useful for bulk series exports where the user
 *                        may want to save the file or share it elsewhere.
 */
import { Alert, Linking, Platform } from 'react-native';
import * as Calendar from 'expo-calendar';
import { APP_CONFIG } from './app-config';
import * as IntentLauncher from 'expo-intent-launcher';
// expo-file-system v19 moved the legacy API to a sub-path
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/** Minimal shape needed to build a calendar event. */
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

// ── Date helpers ──────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Build a Date from YYYY-MM-DD + optional HH:MM:SS in America/Los_Angeles.
 * We construct the wall-clock time as if it were UTC so that when the OS
 * stores it with America/Los_Angeles timezone, the displayed time is correct.
 */
function toDate(dateStr: string, timeStr: string | null): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!timeStr) {
    // All-day: midnight local
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  }
  const [h, min, s] = timeStr.split(':').map(Number);
  // Pacific offset: standard -8h, daylight -7h
  // We let the Calendar API handle the timezone with timeZone: 'America/Los_Angeles'
  // so pass the local wall time as a plain ISO string that we convert to a Date.
  // JavaScript Date is UTC-based; we produce a UTC Date that represents the
  // correct instant by adding the Pacific offset.
  const pacificOffset = getPacificOffsetMinutes(y, m - 1, d);
  return new Date(Date.UTC(y, m - 1, d, h, (min ?? 0) + pacificOffset, s ?? 0));
}

/** Returns the UTC offset (in minutes to ADD to get UTC) for America/Los_Angeles on a given date. */
function getPacificOffsetMinutes(year: number, month: number, day: number): number {
  // DST in the US: second Sunday of March → first Sunday of November
  const dstStart = nthSundayOfMonth(year, 2, 2);  // March (month=2), 2nd Sunday
  const dstEnd   = nthSundayOfMonth(year, 10, 1); // November (month=10), 1st Sunday
  const dateNum = year * 10000 + (month + 1) * 100 + day;
  const startNum = dstStart.y * 10000 + (dstStart.m + 1) * 100 + dstStart.d;
  const endNum   = dstEnd.y   * 10000 + (dstEnd.m   + 1) * 100 + dstEnd.d;
  const isDST = dateNum >= startNum && dateNum < endNum;
  return isDST ? 7 * 60 : 8 * 60; // PDT = UTC-7, PST = UTC-8
}

function nthSundayOfMonth(year: number, month: number, n: number): { y: number; m: number; d: number } {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const dt = new Date(year, month, day);
    if (dt.getMonth() !== month) break;
    if (dt.getDay() === 0) { // Sunday
      count++;
      if (count === n) return { y: year, m: month, d: day };
    }
  }
  return { y: year, m: month, d: 1 };
}

function buildEndDate(event: ICSEventData): Date {
  const endDate = event.end_date ?? event.start_date;
  if (!event.start_time) {
    // All-day: end is exclusive next day
    const [y, m, d] = endDate.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
  }
  if (event.end_time) {
    return toDate(endDate, event.end_time);
  }
  // Default: 1 hour after start
  const start = toDate(event.start_date, event.start_time);
  return new Date(start.getTime() + 60 * 60 * 1000);
}

// ── Calendar permission + default calendar ────────────────────────────────────

async function requestCalendarAccess(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status === 'granted') return true;

  Alert.alert(
    'Calendar Access Required',
    'Please allow Dertown to access your Calendar in Settings.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
    ]
  );
  return false;
}

/** Returns the best writable iOS calendar ID without user interaction. */
async function getWritableCalendarId(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.filter((c) => c.allowsModifications);
  if (writable.length === 0) return null;

  // Prefer the primary/default calendar; fall back to the first writable one.
  const preferred =
    writable.find((c) => (c as any).isPrimary) ??
    writable.find((c) => c.source?.name === 'Default') ??
    writable[0];
  return preferred.id;
}

/**
 * Android: open Google Calendar's native "New Event" screen via ACTION_INSERT.
 * The user sees their normal calendar list, picks one, and saves — all within
 * their calendar app. No permissions required from our side.
 */
async function addEventViaAndroidIntent(event: ICSEventData): Promise<void> {
  const startMs = toDate(event.start_date, event.start_time).getTime();
  const endMs = buildEndDate(event).getTime();

  await IntentLauncher.startActivityAsync('android.intent.action.INSERT', {
    data: 'content://com.android.calendar/events',
    extra: {
      title: event.title,
      description: event.description ?? '',
      eventLocation: event.location?.address ?? event.location?.name ?? '',
      beginTime: startMs,
      endTime: endMs,
      allDay: !event.start_time,
    },
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Add one or more events to the device calendar.
 *
 * Android: opens Google Calendar's native "New Event" screen via an ACTION_INSERT
 *   intent. The user picks their calendar and saves inside their calendar app.
 *   Returns null (no event ID available from the intent).
 *
 * iOS: silently adds events via expo-calendar and returns the first created
 *   event ID so the caller can offer a "View in Calendar" link.
 */
export async function addEventsToCalendar(
  events: ICSEventData[],
  calName: string
): Promise<string | null> {
  // Android: delegate to the native calendar app via intent (no permission needed,
  // shows the normal Google Calendar picker the user expects).
  if (Platform.OS === 'android') {
    // For multiple events on Android fall through to the expo-calendar path below,
    // since the intent approach only supports one event at a time.
    if (events.length === 1) {
      await addEventViaAndroidIntent(events[0]);
      return null; // outcome is handled inside Google Calendar, no ID to return
    }
  }

  // iOS (and Android multi-event fallback): write directly via expo-calendar.
  const granted = await requestCalendarAccess();
  if (!granted) return null;

  const calendarId = await getWritableCalendarId();
  if (!calendarId) {
    Alert.alert('No Calendar Found', 'Could not find a writable calendar on this device.');
    return null;
  }

  let firstEventId: string | null = null;
  for (const event of events) {
    const eventId = await Calendar.createEventAsync(calendarId, {
      title: event.title,
      startDate: toDate(event.start_date, event.start_time),
      endDate: buildEndDate(event),
      allDay: !event.start_time,
      location: event.location?.address ?? event.location?.name ?? undefined,
      notes: event.description ?? undefined,
      timeZone: APP_CONFIG.timezone,
    });
    if (firstEventId === null) firstEventId = eventId;
  }

  const label = events.length === 1 ? `"${events[0].title}"` : `${events.length} events`;
  Alert.alert(
    'Added to Calendar',
    `${label} ${events.length === 1 ? 'has' : 'have'} been added to your calendar.`
  );

  return firstEventId;
}

// ── iCal file sharing (kept for series bulk export) ───────────────────────────

function icalLocalDT(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-');
  const [h, min, s] = timeStr.split(':');
  return `${y}${m}${d}T${pad(Number(h))}${pad(Number(min))}${pad(Number(s ?? 0))}`;
}

function addOneHour(timeStr: string): string {
  const [h, m, s] = timeStr.split(':').map(Number);
  return `${pad((h + 1) % 24)}${pad(m)}${pad(s ?? 0)}`;
}

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${APP_CONFIG.timezone}`,
  `X-LIC-LOCATION:${APP_CONFIG.timezone}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0800',
  'TZOFFSETTO:-0700',
  'TZNAME:PDT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0700',
  'TZOFFSETTO:-0800',
  'TZNAME:PST',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
].join('\r\n');

function buildVEvent(event: ICSEventData, dtstamp: string): string | null {
  try {
    const endDate = event.end_date ?? event.start_date;
    const isAllDay = !event.start_time;

    let dtstart: string;
    let dtend: string;

    if (isAllDay) {
      const [y, m, d] = endDate.split('-').map(Number);
      const next = new Date(y, m - 1, d + 1);
      const nextStr = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
      dtstart = `DTSTART;VALUE=DATE:${event.start_date.replace(/-/g, '')}`;
      dtend   = `DTEND;VALUE=DATE:${nextStr}`;
    } else {
      dtstart = `DTSTART;TZID=${APP_CONFIG.timezone}:${icalLocalDT(event.start_date, event.start_time!)}`;
      const endTimeStr = event.end_time
        ? icalLocalDT(endDate, event.end_time)
        : icalLocalDT(event.start_date, addOneHour(event.start_time!));
      dtend = `DTEND;TZID=${APP_CONFIG.timezone}:${endTimeStr}`;
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
 * Write a .ics file and open the system share sheet.
 * Use this for bulk series export where the user might want to save or share
 * the file. For simple "Add to Calendar", prefer addEventsToCalendar instead.
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
  ].join('\r\n') + '\r\n';

  const safeName = calName.replace(/[^a-z0-9]/gi, '_').slice(0, 60);
  const path = `${FileSystem.cacheDirectory}${safeName}.ics`;

  await FileSystem.writeAsStringAsync(path, ical, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(path, {
    mimeType: 'text/calendar',
    UTI: 'com.apple.ical.ics',
    dialogTitle: calName,
  });
}
