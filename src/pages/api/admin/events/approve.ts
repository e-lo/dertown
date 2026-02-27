import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withAdminAuth(async ({ request }) => {
  const { eventId } = await request.json();

  if (!eventId) {
    return jsonError('Event ID is required', 400);
  }

  // First check if event has primary_tag_id
  const { data: event, error: fetchError } = await supabaseAdmin
    .from('events')
    .select('primary_tag_id')
    .eq('id', eventId)
    .single();

  if (fetchError || !event) {
    return jsonError('Event not found', 404);
  }

  if (!event.primary_tag_id) {
    return jsonError('Event must have a primary tag selected before approval', 400);
  }

  // Update event status to approved using admin client
  const { data, error } = await supabaseAdmin
    .from('events')
    .update({ status: 'approved' })
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    console.error('Error approving event:', error);
    return jsonError('Failed to approve event');
  }

  return jsonResponse({ event: data });
});
