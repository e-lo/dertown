import type { APIRoute } from 'astro';
import { db } from '../../../../lib/supabase.ts';
import { parseEventTimesPacific, formatDateForOutlook } from '../../../../lib/calendar-utils.ts';

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

    // Build Outlook Calendar URL
    const outlookCalendarUrl = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
    outlookCalendarUrl.searchParams.set('subject', event.title || 'Untitled Event');
    outlookCalendarUrl.searchParams.set('startdt', formatDateForOutlook(new Date(startDate)));
    outlookCalendarUrl.searchParams.set('enddt', formatDateForOutlook(new Date(eventEndDate)));

    if (event.description) {
      outlookCalendarUrl.searchParams.set('body', event.description);
    }

    if (event.location?.name) {
      outlookCalendarUrl.searchParams.set('location', event.location.name);
    }

    // Redirect to Outlook Calendar
    return new Response(null, {
      status: 302,
      headers: {
        Location: outlookCalendarUrl.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating Outlook Calendar link:', error);
    return new Response('Internal server error', { status: 500 });
  }
};
