import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withAdminAuth(async () => {
  // Fast path: delete all pending rows directly (avoids large IN(...) payloads).
  const firstDelete = await supabaseAdmin
    .from('events_staged')
    .delete()
    .eq('status', 'pending')
    .select('id');

  if (!firstDelete.error) {
    return jsonResponse({ success: true, deleted: (firstDelete.data || []).length });
  }

  // Foreign key fallback: non-pending rows may still point to pending parents.
  if (firstDelete.error.code !== '23503') {
    console.error('Error clearing pending staged events:', firstDelete.error);
    return jsonError('Failed to clear pending events');
  }

  const { data: pendingRows, error: pendingFetchError } = await supabaseAdmin
    .from('events_staged')
    .select('id')
    .eq('status', 'pending');

  if (pendingFetchError) {
    console.error('Error fetching pending staged events after FK failure:', pendingFetchError);
    return jsonError('Failed to fetch pending events');
  }

  const pendingIds = (pendingRows || []).map((row) => row.id);
  if (pendingIds.length === 0) {
    return jsonResponse({ success: true, deleted: 0 });
  }

  const { error: unlinkError } = await supabaseAdmin
    .from('events_staged')
    .update({ parent_event_id: null })
    .in('parent_event_id', pendingIds)
    .neq('status', 'pending');

  if (unlinkError) {
    console.error('Error unlinking non-pending staged children before clear:', unlinkError);
    return jsonError('Failed to clear pending events');
  }

  const retryDelete = await supabaseAdmin
    .from('events_staged')
    .delete()
    .eq('status', 'pending')
    .select('id');

  if (retryDelete.error) {
    console.error('Error clearing pending staged events after unlink:', retryDelete.error);
    return jsonError('Failed to clear pending events');
  }

  return jsonResponse({ success: true, deleted: (retryDelete.data || []).length });
});
