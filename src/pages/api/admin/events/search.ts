import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

/**
 * GET /api/admin/events/search?q=...
 * Returns events whose title matches the query (for autocomplete).
 * Limit 20 results.
 */
export const GET = withAdminAuth(async ({ url, auth }) => {
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) {
    return jsonResponse([]);
  }

  // Org editors only search within their assigned organizations.
  if (!auth.isSuperAdmin && auth.organizationIds.length === 0) {
    return jsonResponse([]);
  }

  let query = supabaseAdmin
    .from('events')
    .select('id, title, start_date, start_time, status')
    .ilike('title', `%${q}%`)
    .neq('status', 'cancelled')
    .order('start_date', { ascending: false })
    .limit(20);

  if (!auth.isSuperAdmin) {
    query = query.in('organization_id', auth.organizationIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error searching events:', error);
    return jsonError('Failed to search events');
  }

  return jsonResponse(data || []);
});
