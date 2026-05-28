/**
 * GET /api/organizations/:id/ical
 *
 * Live iCal subscription feed for all upcoming events from a specific organization.
 * Clients subscribe via webcal:// (iOS) or Google Calendar URL (Android) and
 * receive automatic updates as new events are published.
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

export const GET: APIRoute = async ({ params, url: reqUrl }) => {
  const { id } = params;
  if (!id) return new Response('Organization ID required', { status: 400 });

  const siteUrl = import.meta.env.SITE || 'https://dertown.com';

  // Fetch org name for the calendar title
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', id)
    .single();

  if (orgError || !org) {
    return new Response('Organization not found', { status: 404 });
  }

  // Fetch all events for this org
  const { data: eventsData } = await supabase
    .from('public_events')
    .select(`
      *,
      location:locations!events_location_id_fkey(name, address)
    `)
    .eq('organization_id', id)
    .order('start_date', { ascending: true });

  const events = filterCurrentAndFutureEvents(eventsData ?? []);

  const dtstamp = formatDateForICalUTC(new Date());
  const calName = `${org.name} Events`;
  const safeName = (org.name ?? 'org').replace(/[^a-z0-9]/gi, '_').slice(0, 60);

  const vevents = events
    .map((e) => {
      try { return buildVEvent(e, dtstamp, siteUrl); }
      catch { return null; }
    })
    .filter(Boolean);

  const icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Der Town//Organization Events//EN',
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
