import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase.ts';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = url.searchParams;
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';

    // Build the search query (using public view that excludes private fields)
    // Search returns all events, filtering happens client-side if needed
    const searchQuery = db.events.getAll();

    // Add filters based on search parameters
    if (query) {
      // This would need to be implemented with full-text search in Supabase
      // For now, we'll just return all events and filter client-side
    }

    const { data: events, error } = await searchQuery;

    if (error) {
      return jsonError('Failed to search events');
    }

    // Filter events based on search parameters (client-side filtering for now)
    let filteredEvents = events || [];

    if (query) {
      filteredEvents = filteredEvents.filter((event) => {
        const queryLower = query.toLowerCase();
        const titleMatch = event.title && event.title.toLowerCase().includes(queryLower);
        const descriptionMatch =
          event.description && event.description.toLowerCase().includes(queryLower);
        const locationMatch =
          event.location && event.location.name.toLowerCase().includes(queryLower);
        const tagMatch =
          (event.primary_tag && event.primary_tag.name.toLowerCase().includes(queryLower)) ||
          (event.secondary_tag && event.secondary_tag.name.toLowerCase().includes(queryLower));

        return titleMatch || descriptionMatch || locationMatch || tagMatch;
      });
    }

    if (category) {
      filteredEvents = filteredEvents.filter(
        (event) => event.primary_tag?.name === category || event.secondary_tag?.name === category
      );
    }

    return jsonResponse({ events: filteredEvents });
  } catch (error) {
    console.error('Error in events search API:', error);
    return jsonError('Internal server error');
  }
};
