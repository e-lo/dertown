import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase.ts';

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

    // Transform events for FullCalendar
    const calendarEvents = (events || []).map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start_date + (event.start_time ? `T${event.start_time}` : ''),
      end: event.end_date + (event.end_time ? `T${event.end_time}` : ''),
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
    }));

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
