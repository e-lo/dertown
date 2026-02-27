import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ params }) => {
  const { id } = params;

  if (!id) {
    return jsonError('Announcement ID is required', 400);
  }

  // Get announcement by ID (any status) using admin client (bypasses RLS)
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching announcement:', error);
    return jsonError('Failed to fetch announcement');
  }

  if (!data) {
    return jsonError('Announcement not found', 404);
  }

  return jsonResponse({ announcement: data });
});
