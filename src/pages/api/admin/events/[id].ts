import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ params }) => {
  const { id } = params;

  if (!id) {
    return jsonError('Event ID is required', 400);
  }

  // Get event by ID (any status) using admin client (bypasses RLS)
  const { data, error } = await supabaseAdmin
    .from('events')
    .select(
      `
      *,
      primary_tag:tags!events_primary_tag_id_fkey(name),
      secondary_tag:tags!events_secondary_tag_id_fkey(name),
      location:locations!events_location_id_fkey(name, address),
      organization:organizations!events_organization_id_fkey(name)
    `
    )
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching event:', error);
    return jsonError('Failed to fetch event');
  }

  if (!data) {
    return jsonError('Event not found', 404);
  }

  return jsonResponse({ event: data });
});
