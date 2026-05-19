import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ auth }) => {
  // Get published announcements that are scheduled to show in the future
  const now = new Date().toISOString();
  let query = supabaseAdmin
    .from('announcements')
    .select('*')
    .eq('status', 'published')
    .gte('show_at', now) // show_at is in the future
    .order('show_at', { ascending: true });

  // Org editors only see announcements for their assigned organizations.
  if (!auth.isSuperAdmin && auth.organizationIds.length > 0) {
    query = query.in('organization_id', auth.organizationIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching upcoming announcements:', error);
    return jsonError('Failed to fetch upcoming announcements');
  }

  return jsonResponse({ announcements: data || [] });
});
