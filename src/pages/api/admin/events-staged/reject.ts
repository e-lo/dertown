import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withAdminAuth(async ({ request }) => {
  const { eventId, reason } = await request.json();

  if (!eventId) {
    return jsonError('Event ID is required', 400);
  }

  const normalizedReason = typeof reason === 'string' ? reason.toLowerCase() : '';
  const isDuplicate = normalizedReason.includes('duplicate');

  // events_staged uses event_status enum (no "rejected" value).
  // Use "duplicate" for duplicate-flow actions, otherwise archive it.
  const { error: updateError } = await supabaseAdmin
    .from('events_staged')
    .update({
      status: isDuplicate ? 'duplicate' : 'archived',
      comments: reason ? `Rejected: ${reason}` : 'Rejected by admin',
    })
    .eq('id', eventId);

  if (updateError) {
    console.error('Error rejecting staged event:', updateError);
    return jsonError(updateError.message || 'Failed to reject event');
  }

  return jsonResponse({ success: true });
});
