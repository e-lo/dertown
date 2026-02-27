import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async () => {
  // Fetch staged announcements using admin client (bypasses RLS)
  const { data, error } = await supabaseAdmin.from('announcements_staged').select('*');

  if (error) {
    console.error('Database error:', error);
    return jsonError('Failed to fetch staged announcements');
  }

  return jsonResponse({ announcements: data });
});
