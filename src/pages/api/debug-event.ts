import type { APIRoute } from 'astro';
import { db } from '../../lib/supabase.ts';
import { parseEventTimesUTC, formatDateForGoogleUTC } from '../../lib/calendar-utils.ts';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const eventId = url.searchParams.get('id');

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

    // Debug the event data
    const debugInfo = {
      eventId: event.id,
      title: event.title,
      startDate: event.start_date,
      startTime: event.start_time,
      endDate: event.end_date,
      endTime: event.end_time,
      rawData: event,
    };

    // Parse event times with UTC timezone handling
    const { startDate, endDate } = parseEventTimesUTC(event);

    // Add parsed date information
    debugInfo.parsedDates = {
      startDate: {
        toString: startDate.toString(),
        toISOString: startDate.toISOString(),
        localHours: startDate.getHours(),
        localMinutes: startDate.getMinutes(),
        utcHours: startDate.getUTCHours(),
        utcMinutes: startDate.getUTCMinutes(),
        timezoneOffset: startDate.getTimezoneOffset(),
      },
      endDate: endDate
        ? {
            toString: endDate.toString(),
            toISOString: endDate.toISOString(),
            localHours: endDate.getHours(),
            localMinutes: endDate.getMinutes(),
            utcHours: endDate.getUTCHours(),
            utcMinutes: endDate.getUTCMinutes(),
            timezoneOffset: endDate.getTimezoneOffset(),
          }
        : null,
    };

    // Add formatted export information
    debugInfo.exports = {
      googleCalendar: {
        start: formatDateForGoogleUTC(startDate),
        end: endDate
          ? formatDateForGoogleUTC(endDate)
          : formatDateForGoogleUTC(new Date(startDate.getTime() + 60 * 60 * 1000)),
      },
    };

    // Add Google Calendar URL
    const eventEndDate = endDate || new Date(startDate.getTime() + 60 * 60 * 1000);
    const googleCalendarUrl = new URL('https://calendar.google.com/calendar/render');
    googleCalendarUrl.searchParams.set('action', 'TEMPLATE');
    googleCalendarUrl.searchParams.set('text', event.title || 'Untitled Event');
    googleCalendarUrl.searchParams.set(
      'dates',
      `${formatDateForGoogleUTC(startDate)}/${formatDateForGoogleUTC(eventEndDate)}`
    );

    debugInfo.googleCalendarUrl = googleCalendarUrl.toString();

    return new Response(JSON.stringify(debugInfo, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
