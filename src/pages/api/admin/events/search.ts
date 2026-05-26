import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

/**
 * GET /api/admin/events/search?q=...
 * Returns events whose title matches the query (for autocomplete).
 * Searches both `events` and `events_staged`, deduplicated by ID, sorted by
 * start_date desc, limited to 10 combined results.
 * Each result includes a `table` field ('events' | 'events_staged').
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

  let eventsQuery = supabaseAdmin
    .from('events')
    .select('id, title, start_date, start_time, status')
    .ilike('title', `%${q}%`)
    .neq('status', 'cancelled')
    .order('start_date', { ascending: false })
    .limit(10);

  if (!auth.isSuperAdmin) {
    eventsQuery = eventsQuery.in('organization_id', auth.organizationIds);
  }

  let stagedQuery = supabaseAdmin
    .from('events_staged')
    .select('id, title, start_date, start_time, status')
    .ilike('title', `%${q}%`)
    .order('start_date', { ascending: false })
    .limit(10);

  if (!auth.isSuperAdmin) {
    stagedQuery = stagedQuery.in('organization_id', auth.organizationIds);
  }

  const [eventsResult, stagedResult] = await Promise.all([eventsQuery, stagedQuery]);

  if (eventsResult.error) {
    console.error('Error searching events:', eventsResult.error);
    return jsonError('Failed to search events');
  }

  if (stagedResult.error) {
    console.error('Error searching events_staged:', stagedResult.error);
    return jsonError('Failed to search events');
  }

  const eventsRows = (eventsResult.data || []).map(row => ({ ...row, table: 'events' as const }));
  const stagedRows = (stagedResult.data || []).map(row => ({ ...row, table: 'events_staged' as const }));

  // Merge and sort by start_date descending, then take top 10.
  // UUIDs are unique across tables so no true ID collision is possible,
  // but deduplicate by ID just in case.
  const seen = new Set<string>();
  const merged = [...eventsRows, ...stagedRows]
    .filter(row => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .sort((a, b) => {
      const da = a.start_date ?? '';
      const db = b.start_date ?? '';
      if (da > db) return -1;
      if (da < db) return 1;
      return 0;
    })
    .slice(0, 10);

  return jsonResponse(merged);
});
