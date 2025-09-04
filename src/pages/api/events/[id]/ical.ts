import type { APIRoute } from 'astro';
import { db } from '../../../../lib/supabase.ts';
import { parseEventTimesUTC, formatDateForICalUTC } from '../../../../lib/calendar-utils.ts';

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

    // Parse event times with UTC timezone handling (recommended approach)
    const { startDate, endDate } = parseEventTimesUTC(event);

    // If no end time specified, default to 1 hour after start
    const eventEndDate = endDate || new Date(startDate.getTime() + 60 * 60 * 1000);

    // Generate iCal content with UTC timezone
    const icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Der Town//Event Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${event.id}@dertown.org`,
      `DTSTAMP:${formatDateForICalUTC(new Date())}`,
      `DTSTART:${formatDateForICalUTC(startDate)}`,
      `DTEND:${formatDateForICalUTC(eventEndDate)}`,
      `SUMMARY:${(event.title || 'Untitled Event').replace(/\n/g, '\\n')}`,
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
