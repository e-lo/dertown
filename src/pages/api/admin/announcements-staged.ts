import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ auth }) => {
  // Fetch staged announcements using admin client (bypasses RLS)
  // Note: announcements_staged uses 'organization' (text) not 'organization_id' (uuid),
  // so org filtering is not directly possible here. Super admins see all; org editors see all
  // staged (since staged submissions don't yet have an org_id to filter on).
  const { data, error } = await supabaseAdmin.from('announcements_staged').select('*');

  if (error) {
    console.error('Database error:', error);
    return jsonError('Failed to fetch staged announcements');
  }

  return jsonResponse({ announcements: data });
});
