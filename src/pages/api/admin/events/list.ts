import { supabaseAdmin, getTodayLocale } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

/**
 * GET /api/admin/events/list?days=14
 * Returns approved, pending, and cancelled events within the next N days (default 14).
 * Used by the admin events list page to avoid loading too many events.
 */
export const GET = withAdminAuth(async ({ url, auth }) => {
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '14', 10) || 14));
  const today = getTodayLocale();

  // Add days from the locale "today" value to avoid UTC date boundary drift.
  const endDate = new Date(`${today}T12:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + days);
  const endDateStr = endDate.toISOString().split('T')[0];

  // Org editors only see events for their assigned organizations.
  if (!auth.isSuperAdmin && auth.organizationIds.length === 0) {
    return jsonResponse({ events: [] });
  }

  let query = supabaseAdmin
    .from('events')
    .select(
      `
      *,
      primary_tag:tags!events_primary_tag_id_fkey(name),
      secondary_tag:tags!events_secondary_tag_id_fkey(name),
      location:locations!events_location_id_fkey(name, address),
      organization:organizations!events_organization_id_fkey(name)
    `
    )
    .in('status', ['approved', 'pending', 'cancelled'])
    .gte('start_date', today)
    .lte('start_date', endDateStr)
    .order('start_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false });

  if (!auth.isSuperAdmin) {
    query = query.in('organization_id', auth.organizationIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching events list:', error);
    return jsonError('Failed to fetch events');
  }

  return jsonResponse({ events: data || [] });
});
