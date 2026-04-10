import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import { findEventDuplicateHint } from '@/lib/event-duplicate';

export const prerender = false;

const SCRAPER_APPROVED_PARENT_ID_REGEX = /\[SCRAPER_APPROVED_PARENT_ID:([0-9a-f-]{36})\]/i;

function extractApprovedParentId(comments: string | null): string | null {
  if (!comments) return null;
  const match = comments.match(SCRAPER_APPROVED_PARENT_ID_REGEX);
  return match?.[1] || null;
}

export const GET = withAdminAuth(async () => {
  // Review queue: only pending. Rejected rows use duplicate/archived/cancelled (DB-enforced, not shown here).
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
    .select('id, title, start_date, start_time, location_id, organization_id, parent_event_id, source_id')
    .eq('status', 'approved');

  if (approvedError) {
    console.error('Error fetching approved events for duplicate hints:', approvedError);
    return jsonResponse({ events: data || [] });
  }

  // Build parent title lookup from both staged and approved events
  const parentTitles = new Map<string, string>();
  for (const e of data || []) {
    parentTitles.set(e.id, e.title);
  }
  for (const e of approvedEvents || []) {
    if (!parentTitles.has(e.id)) parentTitles.set(e.id, e.title || '');
  }

  // Identify series parents: staged events that other staged events reference as parent_event_id
  const stagedIds = new Set((data || []).map((e) => e.id));
  const referencedParentIds = new Set(
    (data || [])
      .filter((e) => e.parent_event_id && stagedIds.has(e.parent_event_id))
      .map((e) => e.parent_event_id)
  );

  const eventsWithDuplicateHints = (data || []).map((event) => {
    // Resolve effective parent: either direct parent_event_id or from comments marker
    const approvedParentFromComments = extractApprovedParentId(event.comments);
    const effectiveParentId = event.parent_event_id || approvedParentFromComments || null;
    const parentTitle = effectiveParentId ? parentTitles.get(effectiveParentId) || null : null;

    return {
      ...event,
      likely_duplicate: findEventDuplicateHint(event, approvedEvents || []),
      is_series_parent: referencedParentIds.has(event.id),
      child_count: referencedParentIds.has(event.id)
        ? (data || []).filter((e) => e.parent_event_id === event.id).length
        : 0,
      parent_title: parentTitle,
      effective_parent_id: effectiveParentId,
    };
  });

  return jsonResponse({ events: eventsWithDuplicateHints });
});
