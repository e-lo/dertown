import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

/**
 * GET /api/admin/events/search?q=...
 * Returns events whose title matches the query (for autocomplete).
 * Limit 20 results.
 */
export const GET = withAdminAuth(async ({ url }) => {
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) {
    return jsonResponse([]);
  }

  const { data, error } = await supabaseAdmin
    .from('events')
    .select('id, title, start_date, start_time, status')
    .ilike('title', `%${q}%`)
    .neq('status', 'cancelled')
    .order('start_date', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error searching events:', error);
    return jsonError('Failed to search events');
  }

  return jsonResponse(data || []);
});
