/**
 * GET /api/mobile/organizations/:id
 *
 * Returns public organization details and their upcoming events.
 * Uses the anon Supabase client — no auth required.
 */
import type { APIRoute } from 'astro';
import { supabase, filterCurrentAndFutureEvents } from '@/lib/supabase';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) return jsonError('Missing organization id', 400);

  try {
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        description,
        website,
        phone,
        email,
        location:locations(id, name, address, latitude, longitude)
      `)
      .eq('id', id)
      .single();

    if (orgError || !org) {
      return jsonError('Organization not found', 404);
    }

    const { data: eventsData } = await supabase
      .from('public_events')
      .select(`
        *,
        primary_tag:tags!events_primary_tag_id_fkey(name),
        secondary_tag:tags!events_secondary_tag_id_fkey(name),
        location:locations!events_location_id_fkey(id, name, address, latitude, longitude),
        organization:organizations!events_organization_id_fkey(name)
      `)
      .eq('organization_id', id)
      .order('start_date', { ascending: true });

    const events = filterCurrentAndFutureEvents(eventsData ?? []);

    return jsonResponse({ organization: org, events });
  } catch (err) {
    console.error('Error fetching organization:', err);
    return jsonError('Internal server error', 500);
  }
};
