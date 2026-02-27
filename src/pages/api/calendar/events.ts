import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase.ts';
import { transformEventForCalendar, getCategoryBadgeVariant } from '../../../lib/event-utils.ts';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    // Calendar API returns all events (including past events)
    const { data: events, error } = await db.events.getAll();

    if (error) {
      return jsonError('Failed to fetch events');
    }

    // Transform events for FullCalendar using the same function as Calendar.astro
    // This ensures consistency and uses timezone-aware ISO strings
    const calendarEvents = (events || [])
      .filter(
        (event): event is typeof event & { id: string } =>
          event.id !== null && event.id !== undefined
      ) // Filter out events with null IDs
      .map((event) => {
        try {
          const transformed = transformEventForCalendar(event);
          if (!transformed) return null;

          return {
            ...transformed,
            extendedProps: {
              description: event.description,
              locationName: event.location?.name || '',
              organizationName: '',
              primaryTag: event.primary_tag?.name || '',
              secondaryTag: event.secondary_tag?.name || '',
              organizationId: event.organization_id,
              locationId: event.location_id,
              bgClass: `bg-event-${getCategoryBadgeVariant(event.primary_tag?.name || '')}`,
            },
          };
        } catch (error) {
          console.warn(`Error processing event ${event.id}:`, error);
          return null;
        }
      })
      .filter(Boolean); // Remove any null events

    return jsonResponse({ events: calendarEvents });
  } catch (error) {
    console.error('Error in calendar events API:', error);
    return jsonError('Internal server error');
  }
};
