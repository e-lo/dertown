import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withAdminAuth(async ({ request }) => {
  const { announcementId, reason } = await request.json();

  if (!announcementId) {
    return jsonError('Announcement ID is required', 400);
  }

  // Update announcement status to archived using admin client (bypasses RLS)
  // Note: "rejected" is not a valid status, so we use "archived" instead
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .update({
      status: 'archived' as const,
      comments: reason ? `Rejected: ${reason}` : 'Rejected by admin',
    })
    .eq('id', announcementId)
    .select()
    .single();

  if (error) {
    console.error('Error rejecting announcement:', error);
    return jsonError('Failed to reject announcement');
  }

  return jsonResponse({ announcement: data });
});
