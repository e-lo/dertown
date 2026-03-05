import type { APIRoute } from 'astro';
import { jsonError, jsonResponse } from '@/lib/api-utils';
import { db } from '@/lib/supabase';
import { buildEventMapState } from '@/lib/event-map';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const result = await db.events.getAllForMap();
    if (result.error) {
      console.error('Error loading event map data:', result.error);
      return jsonError('Failed to load event map data');
    }

    const state = buildEventMapState(result.data || [], url.searchParams);

    return jsonResponse({
      filters: state.filters,
      tags: state.tags,
      organizations: state.organizations,
      groups: state.groups,
      events: state.events,
      totalEvents: state.events.length,
      totalLocations: state.groups.length,
    });
  } catch (error) {
    console.error('Error in /api/events/map:', error);
    return jsonError('Internal server error');
  }
};
