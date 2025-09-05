import type { APIRoute } from 'astro';
import { db } from '../../../../lib/supabase.ts';
import { parseEventTimesUTC, formatDateForGoogleUTC } from '../../../../lib/calendar-utils.ts';

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

    // Parse event times with UTC timezone handling
    const { startDate, endDate } = parseEventTimesUTC(event);

    // If no end time specified, default to 1 hour after start
    const eventEndDate = endDate || new Date(startDate.getTime() + 60 * 60 * 1000);

    // Build Google Calendar URL
    const googleCalendarUrl = new URL('https://calendar.google.com/calendar/render');
    googleCalendarUrl.searchParams.set('action', 'TEMPLATE');
    googleCalendarUrl.searchParams.set('text', event.title || 'Untitled Event');
    googleCalendarUrl.searchParams.set(
      'dates',
      `${formatDateForGoogleUTC(startDate)}/${formatDateForGoogleUTC(eventEndDate)}`
    );
    googleCalendarUrl.searchParams.set('ctz', 'America/Los_Angeles');

    if (event.description) {
      googleCalendarUrl.searchParams.set('details', event.description);
    }

    if (event.location?.name) {
      googleCalendarUrl.searchParams.set('location', event.location.name);
    }

    // Redirect to Google Calendar
    return new Response(null, {
      status: 302,
      headers: {
        Location: googleCalendarUrl.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating Google Calendar link:', error);
    return new Response('Internal server error', { status: 500 });
  }
};
