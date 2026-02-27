import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const POST = withAdminAuth(async ({ request }) => {
  const { announcementId } = await request.json();
  if (!announcementId) {
    return jsonError('Announcement ID is required', 400);
  }

  // Delete the staged announcement using admin client (bypasses RLS)
  const { error } = await supabaseAdmin
    .from('announcements_staged')
    .delete()
    .eq('id', announcementId);

  if (error) {
    console.error('Error deleting staged announcement:', error);
    return jsonError('Failed to delete staged announcement');
  }

  return jsonResponse({ success: true });
});
