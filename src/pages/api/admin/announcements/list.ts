import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

/**
 * GET /api/admin/announcements/list?days=30
 * Returns pending announcements plus published announcements that are currently
 * active, upcoming, or expired within the last `days` days.
 *
 * Previously filtered by show_at window, which incorrectly excluded announcements
 * where show_at IS NULL (meaning "publish immediately"). Now filters by expires_at
 * so every announcement visible to the public is guaranteed to appear here.
 */
export const GET = withAdminAuth(async ({ url, auth }) => {
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '30', 10) || 30));
  const lookback = new Date();
  lookback.setDate(lookback.getDate() - days);
  const lookbackStr = lookback.toISOString();

  // Org editors only see announcements for their assigned organizations.
  // Super admins see all.
  const applyOrgFilter = <T extends { in: (col: string, vals: string[]) => T }>(query: T): T => {
    if (auth.isSuperAdmin || auth.organizationIds.length === 0) return query;
    return query.in('organization_id', auth.organizationIds);
  };

  const [pendingRes, publishedRes] = await Promise.all([
    applyOrgFilter(
      supabaseAdmin
        .from('announcements')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
    ),
    applyOrgFilter(
      supabaseAdmin
        .from('announcements')
        .select('*')
        .eq('status', 'published')
        // Include: no expiry (permanent) OR expires in the future OR expired within `days` days.
        // This guarantees every announcement visible to the public is included here.
        // (Filtering by show_at would incorrectly exclude show_at IS NULL rows.)
        .or(`expires_at.is.null,expires_at.gte.${lookbackStr}`)
        .order('created_at', { ascending: false })
        .limit(200)
    ),
  ]);

  if (pendingRes.error || publishedRes.error) {
    console.error('Error fetching announcements list:', pendingRes.error || publishedRes.error);
    return jsonError('Failed to fetch announcements');
  }

  const pending = pendingRes.data || [];
  const published = publishedRes.data || [];
  const byId = new Map((pending as { id: string }[]).map((a) => [a.id, a]));
  published.forEach((a) => {
    if (!byId.has(a.id)) byId.set(a.id, a);
  });
  const combined = Array.from(byId.values()).sort(
    (
      a: { show_at?: string; created_at?: string },
      b: { show_at?: string; created_at?: string }
    ) => {
      const da = a.show_at || a.created_at || '';
      const db = b.show_at || b.created_at || '';
      return db.localeCompare(da);
    }
  );

  return jsonResponse({ announcements: combined });
});
