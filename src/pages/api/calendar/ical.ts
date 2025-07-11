import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase';
import type { Database } from '../../../types/database';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    // Fetch all approved events
    const { data: events, error } = await db.events.getCurrentAndFuture();

    if (error) {
      return new Response('Error fetching events', { status: 500 });
    }

    // Generate iCal content
    const icalContent = generateICalContent(events || []);

    return new Response(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="der-town-events.ics"',
      },
    });
  } catch (error) {
    console.error('Error generating iCal feed:', error);
    return new Response('Internal server error', { status: 500 });
  }
};

function generateICalContent(events: Database['public']['Tables']['events']['Row'][]): string {
  const now = new Date();
  const calendarId = `der-town-events-${now.getTime()}`;

  let ical =
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Der Town//Community Events//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Der Town Community Events',
      'X-WR-CALDESC:Community events and activities in Der Town',
      'X-WR-TIMEZONE:America/New_York',
    ].join('\r\n') + '\r\n';

  events.forEach((event, index) => {
    const eventId = `${calendarId}-${index}`;

    // Create proper date objects by combining date and time
    const startDate = new Date(`${event.start_date}T${event.start_time || '00:00:00'}`);
    const endDate =
      event.end_date && event.end_time
        ? new Date(`${event.end_date}T${event.end_time}`)
        : new Date(`${event.start_date}T${event.end_time || '23:59:59'}`);

    // Format dates for iCal (YYYYMMDDTHHMMSSZ)
    const formatDate = (date: Date) => {
      return date
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
    };

    const description = (event.description ?? '').replace(/\n/g, '\\n');
    const location =
      typeof event === 'object' &&
      'location' in event &&
      typeof (event as { location?: string | null }).location === 'string'
        ? ((event as { location?: string | null }).location ?? '')
        : '';

    ical +=
      [
        'BEGIN:VEVENT',
        `UID:${eventId}`,
        `DTSTAMP:${formatDate(now)}`,
        `DTSTART:${formatDate(startDate)}`,
        `DTEND:${formatDate(endDate)}`,
        `SUMMARY:${event.title}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${location}`,
        `URL:${event.website ?? ''}`,
        'END:VEVENT',
      ].join('\r\n') + '\r\n';
  });

  ical += 'END:VCALENDAR\r\n';

  return ical;
}
