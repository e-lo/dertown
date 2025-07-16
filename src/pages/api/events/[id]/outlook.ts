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

    // Format dates for Outlook Calendar
    const startDate = new Date(event.start_date + (event.start_time ? 'T' + event.start_time : ''));
    const endDate = event.end_date
      ? new Date(event.end_date + (event.end_time ? 'T' + event.end_time : ''))
      : new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour if no end time

    const formatDate = (date: Date) => {
      return date.toISOString();
    };

    // Build Outlook Calendar URL
    const outlookCalendarUrl = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
    outlookCalendarUrl.searchParams.set('subject', event.title);
    outlookCalendarUrl.searchParams.set('startdt', formatDate(startDate));
    outlookCalendarUrl.searchParams.set('enddt', formatDate(endDate));

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
