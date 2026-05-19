import { supabaseAdmin } from '@/lib/supabase';
import { withSuperAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

// Staged announcements use a text 'organization' column (not a UUID FK), so we cannot
// filter by org_id. The review queue is super-admin-only: org editors submit via
// announcements-staged/create.ts and super admins approve/reject.
export const GET = withSuperAdminAuth(async () => {
  const { data, error } = await supabaseAdmin.from('announcements_staged').select('*');

  if (error) {
    console.error('Database error:', error);
    return jsonError('Failed to fetch staged announcements');
  }

  return jsonResponse({ announcements: data });
});
