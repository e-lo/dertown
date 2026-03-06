import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import { findEventDuplicateHint } from '@/lib/event-duplicate';

export const prerender = false;

export const GET = withAdminAuth(async () => {
  const { data, error } = await supabaseAdmin.from('events_staged').select(`
      *,
      primary_tag:tags!events_staged_primary_tag_id_fkey(name),
      secondary_tag:tags!events_staged_secondary_tag_id_fkey(name),
      location:locations!events_staged_location_id_fkey(name, address),
      organization:organizations!events_staged_organization_id_fkey(name)
    `)
    .eq('status', 'pending');

  if (error) {
    console.error('Database error:', error);
    return jsonError('Failed to fetch staged events');
  }

  const { data: approvedEvents, error: approvedError } = await supabaseAdmin
    .from('events')
    .select('id, title, start_date, start_time, location_id, organization_id')
    .eq('status', 'approved');

  if (approvedError) {
    console.error('Error fetching approved events for duplicate hints:', approvedError);
    return jsonResponse({ events: data || [] });
  }

  const eventsWithDuplicateHints = (data || []).map((event) => ({
    ...event,
    likely_duplicate: findEventDuplicateHint(event, approvedEvents || []),
  }));

  return jsonResponse({ events: eventsWithDuplicateHints });
});
