import type { APIRoute } from 'astro';
import { db } from '../../../../lib/supabase';

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

    // Format dates for iCal
    const startDate = new Date(event.start_date + (event.start_time ? 'T' + event.start_time : ''));
    const endDate = event.end_date
      ? new Date(event.end_date + (event.end_time ? 'T' + event.end_time : ''))
      : new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour if no end time

    const formatDate = (date: Date) => {
      return date
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
    };

    // Generate iCal content
    const icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Der Town//Event Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${event.id}@dertown.org`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(startDate)}`,
      `DTEND:${formatDate(endDate)}`,
      `SUMMARY:${event.title.replace(/\n/g, '\\n')}`,
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
        'Content-Disposition': `attachment; filename="${event.title.replace(/[^a-z0-9]/gi, '_')}.ics"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error generating iCal file:', error);
    return new Response('Internal server error', { status: 500 });
  }
};
