import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withAdminAuth(async ({ request }) => {
  const { eventId, reason } = await request.json();

  if (!eventId) {
    return jsonError('Event ID is required', 400);
  }

  // Update event status to archived using admin client
  // Note: "rejected" is not a valid status, so we use "archived" instead
  const { data, error } = await supabaseAdmin
    .from('events')
    .update({
      status: 'archived' as const,
      comments: reason ? `Rejected: ${reason}` : 'Rejected by admin',
    })
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    console.error('Error rejecting event:', error);
    return jsonError('Failed to reject event');
  }

  return jsonResponse({ event: data });
});
