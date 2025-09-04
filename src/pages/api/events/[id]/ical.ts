import type { APIRoute } from 'astro';
import { db } from '../../../../lib/supabase.ts';
import { parseEventTimesPacific, formatDateForICal } from '../../../../lib/calendar-utils.ts';

export const GET: APIRoute = async ({ params }) => {
  try {
    const eventId = params.id;

    if (!eventId) {
      return new Response('Event ID is required', { status: 400 });
    }

    // Get the specific event
    const { data: events, error } = await db.events.getCurrentAndFuture();

    if (error) {
      return new Response('Error fetching event', { status: 500 });
    }

    const event = events.find((e) => e.id === eventId);

    if (!event) {
      return new Response('Event not found', { status: 404 });
    }

    // Parse event times as Pacific date-time strings
    const { startDate, endDate } = parseEventTimesPacific(event);

    // If no end time specified, default to 1 hour after start
    const eventEndDate =
      endDate ||
      new Date(new Date(startDate).getTime() + 60 * 60 * 1000)
        .toISOString()
        .replace(/\\.\\d+Z$/, 'Z');

    // Generate iCal content with UTC timezone
    const icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Der Town//Event Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
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
      'BEGIN:VEVENT',
      `UID:${event.id}@dertown.com`,
      `DTSTAMP:${formatDateForICal(new Date())}`,
      `DTSTART;TZID=America/Los_Angeles:${formatDateForICal(new Date(startDate))}`,
      `DTEND;TZID=America/Los_Angeles:${formatDateForICal(new Date(eventEndDate))}`,
      `SUMMARY:${event.title || 'Untitled Event'}`,
      event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : '',
      event.location?.name ? `LOCATION:${event.location.name}` : '',
      event.website ? `URL:${event.website}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter((line) => line !== '')
      .join('\r\n');

    // Return iCal file
    return new Response(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${(event.title || 'event').replace(/[^a-z0-9]/gi, '_')}.ics"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error generating iCal file:', error);
    return new Response('Internal server error', { status: 500 });
  }
};
