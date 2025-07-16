import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = url.searchParams;
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';

    // Build the search query (using public view that excludes private fields)
    const searchQuery = db.events.getCurrentAndFuture();

    // Add filters based on search parameters
    if (query) {
      // This would need to be implemented with full-text search in Supabase
      // For now, we'll just return all events and filter client-side
    }

    const { data: events, error } = await searchQuery;

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to search events' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Filter events based on search parameters (client-side filtering for now)
    let filteredEvents = events || [];

    if (query) {
      filteredEvents = filteredEvents.filter(
        (event) =>
          event.title.toLowerCase().includes(query.toLowerCase()) ||
          (event.description && event.description.toLowerCase().includes(query.toLowerCase()))
      );
    }

    if (category) {
      filteredEvents = filteredEvents.filter(
        (event) => event.primary_tag?.name === category || event.secondary_tag?.name === category
      );
    }

    return new Response(JSON.stringify({ events: filteredEvents }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in events search API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
