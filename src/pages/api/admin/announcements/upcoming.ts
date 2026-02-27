import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async () => {
  // Get published announcements that are scheduled to show in the future
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select('*')
    .eq('status', 'published')
    .gte('show_at', now) // show_at is in the future
    .order('show_at', { ascending: true });

  if (error) {
    console.error('Error fetching upcoming announcements:', error);
    return jsonError('Failed to fetch upcoming announcements');
  }

  return jsonResponse({ announcements: data || [] });
});
