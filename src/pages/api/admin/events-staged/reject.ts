import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withAdminAuth(async ({ request }) => {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const eventId =
    typeof (body as { eventId?: unknown })?.eventId === 'string'
      ? (body as { eventId: string }).eventId
      : '';
  const reasonValue = (body as { reason?: unknown })?.reason;
  const reason = typeof reasonValue === 'string' ? reasonValue : null;

  if (!eventId) {
    return jsonError('Event ID is required', 400);
  }

  // Verify the staged event exists before attempting update.
  const { data: stagedEvent, error: stagedFetchError } = await supabaseAdmin
    .from('events_staged')
    .select('id, status')
    .eq('id', eventId)
    .maybeSingle();

  if (stagedFetchError) {
    console.error('Error loading staged event for reject:', stagedFetchError);
    return jsonError(stagedFetchError.message || 'Failed to load staged event');
  }
  if (!stagedEvent) {
    return jsonError('Staged event not found', 404);
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
