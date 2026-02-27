import type { APIRoute } from 'astro';
import { supabase } from '@/lib/supabase';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const { parentId } = params;

    if (!parentId) {
      return jsonError('Parent event ID is required', 400);
    }

    // Query the base events table with the same filters as public_events view
    const today = new Date();
    today.setDate(today.getDate() - 14);
    const cutoffDate = today.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('events')
      .select(
        `
        *,
        primary_tag:tags!events_primary_tag_id_fkey(name),
        secondary_tag:tags!events_secondary_tag_id_fkey(name),
        location:locations!events_location_id_fkey(name, address)
      `
      )
      .eq('parent_event_id', parentId)
      .eq('status', 'approved')
      .eq('exclude_from_calendar', false)
      .or(`start_date.gte.${cutoffDate},end_date.gte.${cutoffDate}`)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error fetching series events:', error);
      return jsonError('Failed to fetch series events');
    }

    return jsonResponse({ events: data || [] });
  } catch (error) {
    console.error('Error in series events API:', error);
    return jsonError('Internal server error');
  }
};
