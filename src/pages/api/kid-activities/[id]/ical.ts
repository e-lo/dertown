/**
 * GET /api/kid-activities/:id/ical
 *
 * Live iCal subscription feed for a single kid-activities PROGRAM.
 * Includes registration open/close reminders, session dates, and individual
 * occurrence times. Clients subscribe via webcal:// (iOS) or Google Calendar
 * URL (Android) and receive automatic updates as the program changes.
 */
import type { APIRoute } from 'astro';
import { supabase } from '@/lib/supabase';
import { formatDateForICal, formatDateForICalUTC } from '@/lib/calendar-utils';

export const prerender = false;

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:America/Los_Angeles',
  'X-LIC-LOCATION:America/Los_Angeles',
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

/** Escape iCal text values (commas, semicolons). */
function escapeText(value: string): string {
  return value.replace(/[;,]/g, (c) => `\\${c}`);
}

/**
 * Format a date string as a calendar-date-only value (YYYYMMDD) for ALL-DAY
 * events. We parse the date portion and format the calendar date components.
 */
function formatDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** Add `days` calendar days to a Date (UTC), returning a new Date. */
function addDays(d: Date, days: number): Date {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

/** All-day VEVENT spanning [startDate, endDate) — end defaults to start+1 day. */
function buildAllDayVEvent(opts: {
  uid: string;
  summary: string;
  start: Date;
  end?: Date | null;
  dtstamp: string;
  url?: string | null;
  alarm?: { description: string; trigger: string } | null;
}): string {
  const dtStart = formatDateOnly(opts.start);
  // DTEND is exclusive for VALUE=DATE; default to start + 1 day.
  const endExclusive = opts.end ? addDays(opts.end, 1) : addDays(opts.start, 1);
  const dtEnd = formatDateOnly(endExclusive);

  const lines = [
    'BEGIN:VEVENT',
    `SUMMARY:${escapeText(opts.summary)}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `DTSTAMP:${opts.dtstamp}`,
    `UID:${opts.uid}`,
    opts.url ? `URL:${opts.url}` : null,
  ].filter(Boolean) as string[];

  if (opts.alarm) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${opts.alarm.description}`,
      `TRIGGER:${opts.alarm.trigger}`,
      'END:VALARM'
    );
  }

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

/** Timed VEVENT using America/Los_Angeles TZID. End defaults to start + 1h. */
function buildTimedVEvent(opts: {
  uid: string;
  summary: string;
  start: Date;
  end?: Date | null;
  dtstamp: string;
  url?: string | null;
}): string {
  const end = opts.end ?? new Date(opts.start.getTime() + 60 * 60 * 1000);
  return [
    'BEGIN:VEVENT',
    `SUMMARY:${escapeText(opts.summary)}`,
    `DTSTART;TZID=America/Los_Angeles:${formatDateForICal(opts.start)}`,
    `DTEND;TZID=America/Los_Angeles:${formatDateForICal(end)}`,
    `DTSTAMP:${opts.dtstamp}`,
    `UID:${opts.uid}`,
    opts.url ? `URL:${opts.url}` : null,
    'END:VEVENT',
  ]
    .filter(Boolean)
    .join('\r\n');
}

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) return new Response('Program ID required', { status: 400 });

  const siteUrl = import.meta.env.SITE || 'https://dertown.com';

  // 1. Fetch the program
  const { data: program, error: programError } = await (supabase as any)
    .from('public_activities')
    .select('id, name, registration_opens, registration_closes, registration_link, website')
    .eq('id', id)
    .single();

  if (programError || !program) {
    return new Response('Program not found', { status: 404 });
  }

  const programName: string = program.name ?? 'Program';

  // 2. Fetch descendants (direct children + children of CLASS_TYPE children)
  const { data: childData } = await (supabase as any)
    .from('activities')
    .select('id, name, activity_hierarchy_type, start_datetime, end_datetime')
    .eq('parent_activity_id', id);
  const children = (childData ?? []) as Array<{
    id: string;
    name: string | null;
    activity_hierarchy_type: string | null;
    start_datetime: string | null;
    end_datetime: string | null;
  }>;

  let grandchildren: typeof children = [];
  const childIds = children.map((c) => c.id).filter(Boolean);
  if (childIds.length > 0) {
    const { data: grandData } = await (supabase as any)
      .from('activities')
      .select('id, name, activity_hierarchy_type, start_datetime, end_datetime')
      .in('parent_activity_id', childIds);
    grandchildren = (grandData ?? []) as typeof children;
  }

  const descendants = [...children, ...grandchildren];

  // 3. Fetch occurrences for the program + every descendant
  const allActivityIds = [id, ...descendants.map((d) => d.id)].filter(Boolean);
  let occurrences: Array<{
    event_id: string;
    activity_id: string;
    name: string | null;
    start_datetime: string | null;
    end_datetime: string | null;
  }> = [];
  if (allActivityIds.length > 0) {
    const { data: occData } = await (supabase as any)
      .from('activity_events')
      .select('event_id, activity_id, name, start_datetime, end_datetime')
      .in('activity_id', allActivityIds);
    occurrences = (occData ?? []) as typeof occurrences;
  }

  const dtstamp = formatDateForICalUTC(new Date());
  const programUrl = program.registration_link || `${siteUrl}/families/programs/${id}`;
  const vevents: string[] = [];

  // Registration opens
  if (program.registration_opens) {
    try {
      const start = new Date(`${program.registration_opens}T00:00:00`);
      vevents.push(
        buildAllDayVEvent({
          uid: `reg-open-${id}@dertown.com`,
          summary: `Registration opens — ${programName}`,
          start,
          dtstamp,
          url: programUrl,
          alarm: { description: 'Registration opens', trigger: '-P1D' },
        })
      );
    } catch {
      /* skip malformed date */
    }
  }

  // Registration closes
  if (program.registration_closes) {
    try {
      const start = new Date(`${program.registration_closes}T00:00:00`);
      vevents.push(
        buildAllDayVEvent({
          uid: `reg-close-${id}@dertown.com`,
          summary: `Registration closes — ${programName}`,
          start,
          dtstamp,
          url: programUrl,
          alarm: { description: 'Registration closing soon', trigger: '-P2D' },
        })
      );
    } catch {
      /* skip malformed date */
    }
  }

  // SESSION children that have a start_datetime → all-day (or multi-day) events
  for (const child of descendants) {
    if (child.activity_hierarchy_type !== 'SESSION' || !child.start_datetime) continue;
    try {
      const start = new Date(child.start_datetime);
      if (isNaN(start.getTime())) continue;
      const end = child.end_datetime ? new Date(child.end_datetime) : null;
      vevents.push(
        buildAllDayVEvent({
          uid: `session-${child.id}@dertown.com`,
          summary: `${programName} — ${child.name ?? 'Session'}`,
          start,
          end: end && !isNaN(end.getTime()) ? end : null,
          dtstamp,
          url: programUrl,
        })
      );
    } catch {
      /* skip malformed session */
    }
  }

  // Occurrences → timed events
  for (const occ of occurrences) {
    if (!occ.start_datetime) continue;
    try {
      const start = new Date(occ.start_datetime);
      if (isNaN(start.getTime())) continue;
      const end = occ.end_datetime ? new Date(occ.end_datetime) : null;
      vevents.push(
        buildTimedVEvent({
          uid: `evt-${occ.event_id}@dertown.com`,
          summary: occ.name || programName,
          start,
          end: end && !isNaN(end.getTime()) ? end : null,
          dtstamp,
          url: programUrl,
        })
      );
    } catch {
      /* skip malformed occurrence */
    }
  }

  const calName = `${programName} — Activities`;
  const safeName = (programName ?? 'program').replace(/[^a-z0-9]/gi, '_').slice(0, 60);

  const icalContent =
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Der Town//Kid Activities//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeText(calName)}`,
      VTIMEZONE,
      ...vevents,
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n';

  return new Response(icalContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}.ics"`,
      'Cache-Control': 'no-cache',
    },
  });
};
