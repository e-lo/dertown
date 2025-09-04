import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase.ts';
import { parseEventTimesUTC } from '../../../lib/calendar-utils.ts';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const { data: events, error } = await db.events.getCurrentAndFuture();

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch events' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Transform events for FullCalendar with UTC timezone handling
    const calendarEvents = (events || [])
      .map((event) => {
        try {
          // Parse event times with UTC timezone handling (recommended approach)
          const { startDate, endDate } = parseEventTimesUTC(event);

          return {
            id: event.id,
            title: event.title || 'Untitled Event',
            start: startDate.toISOString(),
            end: endDate ? endDate.toISOString() : null,
            url: `/events/${event.id}`,
            allDay: !event.start_time,
            extendedProps: {
              description: event.description,
              locationName: '',
              organizationName: '',
              primaryTag: event.primary_tag?.name || '',
              secondaryTag: event.secondary_tag?.name || '',
              organizationId: event.organization_id,
              locationId: event.location_id,
              bgClass: getCategoryBgClass(event.primary_tag?.name || ''),
            },
          };
        } catch (error) {
          console.warn(`Error processing event ${event.id}:`, error);
          return null;
        }
      })
      .filter(Boolean); // Remove any null events

    return new Response(JSON.stringify({ events: calendarEvents }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in calendar events API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function getCategoryBgClass(category: string): string {
  const categoryMap: { [key: string]: string } = {
    Family: 'bg-blue-500',
    'Arts+Culture': 'bg-purple-500',
    Nature: 'bg-green-500',
    Town: 'bg-yellow-500',
    School: 'bg-red-500',
  };
  return categoryMap[category] || 'bg-gray-500';
}
