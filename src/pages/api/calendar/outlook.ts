import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const eventId = url.searchParams.get('eventId');

  if (!eventId) {
    return new Response('Event ID is required', { status: 400 });
  }

  try {
    const { data: event, error } = await db.events.getById(eventId);

    if (error || !event) {
      return new Response('Event not found', { status: 404 });
    }

    // Generate Outlook calendar URL
    const startDate = new Date(event.start_date);
    const endDate = event.end_date ? new Date(event.end_date) : startDate;

    const outlookUrl = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
    outlookUrl.searchParams.set('subject', event.title);
    outlookUrl.searchParams.set('startdt', startDate.toISOString());
    outlookUrl.searchParams.set('enddt', endDate.toISOString());

    if (event.description) {
      outlookUrl.searchParams.set('body', event.description);
    }

    if (event.location?.name) {
      outlookUrl.searchParams.set('location', event.location.name);
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: outlookUrl.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating Outlook calendar link:', error);
    return new Response('Internal server error', { status: 500 });
  }
};
