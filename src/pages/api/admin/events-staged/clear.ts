import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withAdminAuth(async () => {
  const { data: pendingRows, error: fetchError } = await supabaseAdmin
    .from('events_staged')
    .select('id')
    .eq('status', 'pending');

  if (fetchError) {
    console.error('Error fetching pending staged events:', fetchError);
    return jsonError('Failed to fetch pending events');
  }

  const ids = (pendingRows || []).map((row) => row.id);
  if (ids.length === 0) {
    return jsonResponse({ success: true, deleted: 0 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from('events_staged')
    .delete()
    .in('id', ids);

  if (deleteError) {
    console.error('Error clearing pending staged events:', deleteError);
    return jsonError('Failed to clear pending events');
  }

  return jsonResponse({ success: true, deleted: ids.length });
});
