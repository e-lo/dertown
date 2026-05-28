/**
 * GET /api/locations/:id/ical
 *
 * Live iCal subscription feed for all upcoming events at a specific location.
 */
import type { APIRoute } from 'astro';
import { supabase, filterCurrentAndFutureEvents } from '@/lib/supabase';
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

function buildVEvent(event: any, dtstamp: string, siteUrl: string): string {
  const { startDate, endDate } = parseEventTimesUTC(event);
  const eventEnd = endDate ?? new Date(startDate.getTime() + 60 * 60 * 1000);
  const title = (event.title ?? 'Untitled Event').replace(/[;,]/g, (c: string) => `\\${c}`);
  const location = event.location?.name
    ? event.location.name.replace(/[;,]/g, (c: string) => `\\${c}`)
    : null;

  return [
    'BEGIN:VEVENT',
    `SUMMARY:${title}`,
    `DTSTART;TZID=America/Los_Angeles:${formatDateForICal(startDate)}`,
    `DTEND;TZID=America/Los_Angeles:${formatDateForICal(eventEnd)}`,
    `DTSTAMP:${dtstamp}`,
    `UID:${event.id}@dertown.com`,
    `URL:${siteUrl}/events/${event.id}`,
    location ? `LOCATION:${location}` : null,
    event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : null,
    'END:VEVENT',
  ].filter(Boolean).join('\r\n');
}

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) return new Response('Location ID required', { status: 400 });

  const siteUrl = import.meta.env.SITE || 'https://dertown.com';

  // Fetch location name for the calendar title
  const { data: location, error: locError } = await supabase
    .from('locations')
    .select('id, name')
    .eq('id', id)
    .single();

  if (locError || !location) {
    return new Response('Location not found', { status: 404 });
  }

  // Fetch all events at this location
  const { data: eventsData } = await supabase
    .from('public_events')
    .select(`
      *,
      location:locations!events_location_id_fkey(name, address)
    `)
    .eq('location_id', id)
    .order('start_date', { ascending: true });

  const events = filterCurrentAndFutureEvents(eventsData ?? []);

  const dtstamp = formatDateForICalUTC(new Date());
  const calName = `Events at ${location.name}`;
  const safeName = (location.name ?? 'location').replace(/[^a-z0-9]/gi, '_').slice(0, 60);

  const vevents = events
    .map((e) => {
      try { return buildVEvent(e, dtstamp, siteUrl); }
      catch { return null; }
    })
    .filter(Boolean);

  const icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Der Town//Location Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
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
