import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withAdminAuth(async ({ request, auth }) => {
  const { eventId, reason } = await request.json();

  if (!eventId) {
    return jsonError('Event ID is required', 400);
  }

  // Org editors can only reject events belonging to their organizations
  if (!auth.isSuperAdmin) {
    const { data: event, error: fetchError } = await supabaseAdmin
      .from('events')
      .select('organization_id')
      .eq('id', eventId)
      .single();

    if (fetchError || !event) {
      return jsonError('Event not found', 404);
    }

    if (!event.organization_id || !auth.organizationIds.includes(event.organization_id)) {
      return jsonError('Forbidden: event does not belong to your organization', 403);
    }
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
