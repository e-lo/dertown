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
    .select('id, title, start_date, start_time, location_id, organization_id, parent_event_id')
    .eq('status', 'approved');

  if (approvedError) {
    console.error('Error fetching approved events for duplicate hints:', approvedError);
    return jsonResponse({ events: data || [] });
  }

  // Identify series parents: staged events that other staged events reference as parent_event_id
  const stagedIds = new Set((data || []).map((e) => e.id));
  const referencedParentIds = new Set(
    (data || [])
      .filter((e) => e.parent_event_id && stagedIds.has(e.parent_event_id))
      .map((e) => e.parent_event_id)
  );

  const eventsWithDuplicateHints = (data || []).map((event) => ({
    ...event,
    likely_duplicate: findEventDuplicateHint(event, approvedEvents || []),
    is_series_parent: referencedParentIds.has(event.id),
    child_count: referencedParentIds.has(event.id)
      ? (data || []).filter((e) => e.parent_event_id === event.id).length
      : 0,
  }));

  return jsonResponse({ events: eventsWithDuplicateHints });
});
