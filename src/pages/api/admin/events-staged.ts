import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async () => {
  const { data, error } = await supabaseAdmin.from('events_staged').select(`
      *,
      primary_tag:tags!events_staged_primary_tag_id_fkey(name),
      secondary_tag:tags!events_staged_secondary_tag_id_fkey(name),
      location:locations!events_staged_location_id_fkey(name, address),
      organization:organizations!events_staged_organization_id_fkey(name)
    `);

  if (error) {
    console.error('Database error:', error);
    return jsonError('Failed to fetch staged events');
  }

  return jsonResponse({ events: data || [] });
});
