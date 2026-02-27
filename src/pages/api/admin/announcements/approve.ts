import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withAdminAuth(async ({ request }) => {
  const { announcementId } = await request.json();

  if (!announcementId) {
    return jsonError('Announcement ID is required', 400);
  }

  // Update announcement status to published using admin client
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .update({ status: 'published' })
    .eq('id', announcementId)
    .select()
    .single();

  if (error) {
    console.error('Error approving announcement:', error);
    return jsonError('Failed to approve announcement');
  }

  return jsonResponse({ announcement: data });
});
