import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ auth }) => {
  // Get approved events that can be used as parent events
  // Also include staged events that don't have a parent (so they can be parents)
  // Exclude events that are already children (have a parent_event_id)
  // Order by start_date descending to show most recent first

  // Build base queries and apply org filter for org editors.
  let approvedQuery = supabaseAdmin
    .from('events')
    .select('id, title, start_date, start_time')
    .eq('status', 'approved')
    .is('parent_event_id', null) // Only top-level events can be parents
    .order('start_date', { ascending: false })
    .limit(400);

  let stagedQuery = supabaseAdmin
    .from('events_staged')
    .select('id, title, start_date, start_time')
    .eq('status', 'pending')
    .is('parent_event_id', null)
    .order('start_date', { ascending: false })
    .limit(100);

  if (!auth.isSuperAdmin && auth.organizationIds.length > 0) {
    approvedQuery = approvedQuery.in('organization_id', auth.organizationIds);
    stagedQuery = stagedQuery.in('organization_id', auth.organizationIds);
  }

  // Get approved events
  const { data: approvedEvents, error: approvedError } = await approvedQuery;

  // Get staged events that don't have a parent
  const { data: stagedEvents, error: stagedError } = await stagedQuery;

  if (approvedError || stagedError) {
    console.error('Error fetching parent events:', approvedError || stagedError);
    return jsonError('Failed to fetch parent events');
  }

  // Events that are ALREADY parents (referenced by some child's parent_event_id)
  // often have old start_dates — a series parent is stamped with its first
  // occurrence's date — so they fall outside the recent-events window above and
  // get dropped by the limit. Always include existing parents so any established
  // series is linkable regardless of date or calendar-exclusion.
  const { data: childRows, error: childError } = await supabaseAdmin
    .from('events')
    .select('parent_event_id')
    .not('parent_event_id', 'is', null);

  let existingParents: Array<Record<string, unknown>> = [];
  const parentIds = [...new Set((childRows || []).map((row) => row.parent_event_id))];
  if (!childError && parentIds.length > 0) {
    let existingParentsQuery = supabaseAdmin
      .from('events')
      .select('id, title, start_date, start_time')
      .in('id', parentIds)
      .eq('status', 'approved')
      .is('parent_event_id', null);
    if (!auth.isSuperAdmin && auth.organizationIds.length > 0) {
      existingParentsQuery = existingParentsQuery.in('organization_id', auth.organizationIds);
    }
    const { data } = await existingParentsQuery;
    existingParents = data || [];
  }

  // Combine and deduplicate by ID
  const approvedWithSource = [...(approvedEvents || []), ...existingParents].map((event) => ({
    ...event,
    parent_source: 'events',
  }));
  const stagedWithSource = (stagedEvents || []).map((event) => ({
    ...event,
    parent_source: 'events_staged',
  }));
  const allEvents = [...approvedWithSource, ...stagedWithSource];
  const uniqueEvents = Array.from(new Map(allEvents.map((event) => [event.id, event])).values());

  return jsonResponse(uniqueEvents);
});
