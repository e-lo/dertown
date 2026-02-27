import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async () => {
  // Get approved events that can be used as parent events
  // Also include staged events that don't have a parent (so they can be parents)
  // Exclude events that are already children (have a parent_event_id)
  // Order by start_date descending to show most recent first

  // Get approved events
  const { data: approvedEvents, error: approvedError } = await supabaseAdmin
    .from('events')
    .select('id, title, start_date, start_time')
    .eq('status', 'approved')
    .is('parent_event_id', null) // Only top-level events can be parents
    .order('start_date', { ascending: false })
    .limit(400);

  // Get staged events that don't have a parent
  const { data: stagedEvents, error: stagedError } = await supabaseAdmin
    .from('events_staged')
    .select('id, title, start_date, start_time')
    .is('parent_event_id', null)
    .order('start_date', { ascending: false })
    .limit(100);

  if (approvedError || stagedError) {
    console.error('Error fetching parent events:', approvedError || stagedError);
    return jsonError('Failed to fetch parent events');
  }

  // Combine and deduplicate by ID
  const allEvents = [...(approvedEvents || []), ...(stagedEvents || [])];
  const uniqueEvents = Array.from(new Map(allEvents.map((event) => [event.id, event])).values());

  return jsonResponse(uniqueEvents);
});
