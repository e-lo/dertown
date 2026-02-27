import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

/**
 * GET /api/admin/events/list?days=14
 * Returns approved, pending, and cancelled events within the next N days (default 14).
 * Used by the admin events list page to avoid loading too many events.
 */
export const GET = withAdminAuth(async ({ url }) => {
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '14', 10) || 14));
  const today = new Date().toISOString().split('T')[0];
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  const endDateStr = endDate.toISOString().split('T')[0];

  const { data, error } = await supabaseAdmin
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

  if (error) {
    console.error('Error fetching events list:', error);
    return jsonError('Failed to fetch events');
  }

  return jsonResponse({ events: data || [] });
});
