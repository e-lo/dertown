/**
 * GET /api/events/series/:parentId/ical
 *
 * Returns a single .ics file containing all events in the series
 * (the parent event plus every child event), so users can import the
 * whole recurring series into their calendar app at once.
 */
import type { APIRoute } from 'astro';
import { supabase, db } from '@/lib/supabase';
import {
  parseEventTimesUTC,
  formatDateForICal,
  formatDateForICalUTC,
} from '@/lib/calendar-utils';

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

function buildVEvent(event: any, dtstamp: string): string {
  const { startDate, endDate } = parseEventTimesUTC(event);
  const eventEnd = endDate ?? new Date(startDate.getTime() + 60 * 60 * 1000);

  return [
    'BEGIN:VEVENT',
    `SUMMARY:${event.title ?? 'Untitled Event'}`,
    `DTSTART;TZID=America/Los_Angeles:${formatDateForICal(startDate)}`,
    `DTEND;TZID=America/Los_Angeles:${formatDateForICal(eventEnd)}`,
    `DTSTAMP:${dtstamp}`,
    `UID:${event.id}@dertown.com`,
    event.location?.name ? `LOCATION:${event.location.name}` : null,
    event.description   ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : null,
    event.website       ? `URL:${event.website}` : null,
    'END:VEVENT',
  ].filter(Boolean).join('\r\n');
}

export const GET: APIRoute = async ({ params }) => {
  const { parentId } = params;
  if (!parentId) return new Response('Parent event ID is required', { status: 400 });

  // Fetch parent event and all children concurrently
  const [parentRes, childrenRes] = await Promise.all([
    supabase
      .from('public_events')
      .select(`
        *,
        primary_tag:tags!events_primary_tag_id_fkey(name),
        secondary_tag:tags!events_secondary_tag_id_fkey(name),
        location:locations!events_location_id_fkey(name, address)
      `)
      .eq('id', parentId)
      .single(),
    db.events.getByParentEventId(parentId),
  ]);

  if (parentRes.error || !parentRes.data) {
    return new Response('Series not found', { status: 404 });
  }

  const parent   = parentRes.data;
  const children = (childrenRes.data ?? []).sort((a: any, b: any) =>
    (a.start_date ?? '').localeCompare(b.start_date ?? '')
  );

  // All events: parent first, then children in date order
  const allEvents = [parent, ...children];

  const dtstamp = formatDateForICalUTC(new Date());

  const vevents = allEvents.map((e) => {
    try {
      return buildVEvent(e, dtstamp);
    } catch {
      return null; // skip events with missing required dates
    }
  }).filter(Boolean);

  if (vevents.length === 0) {
    return new Response('No events found in series', { status: 404 });
  }

  const icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Der Town//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${parent.title ?? 'Event Series'}`,
    VTIMEZONE,
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n') + '\r\n';

  const safeName = (parent.title ?? 'series').replace(/[^a-z0-9]/gi, '_');

  return new Response(icalContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}.ics"`,
      'Cache-Control': 'no-cache',
    },
  });
};
