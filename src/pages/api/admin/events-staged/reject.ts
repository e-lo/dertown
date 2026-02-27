import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withAdminAuth(async ({ request }) => {
  const { eventId } = await request.json();

  if (!eventId) {
    return jsonError('Event ID is required', 400);
  }

  // Update the staged event status to rejected using admin client (bypasses RLS)
  const { error: updateError } = await supabaseAdmin
    .from('events_staged')
    .update({ status: 'rejected' })
    .eq('id', eventId);

  if (updateError) {
    console.error('Error rejecting staged event:', updateError);
    return jsonError('Failed to reject event');
  }

  return jsonResponse({ success: true });
});
