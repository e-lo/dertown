import type { APIRoute } from 'astro';
import { db } from '../../../../lib/supabase.ts';

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

    // Format dates for Google Calendar
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

    // Build Google Calendar URL
    const googleCalendarUrl = new URL('https://calendar.google.com/calendar/render');
    googleCalendarUrl.searchParams.set('action', 'TEMPLATE');
    googleCalendarUrl.searchParams.set('text', event.title);
    googleCalendarUrl.searchParams.set('dates', `${formatDate(startDate)}/${formatDate(endDate)}`);

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
