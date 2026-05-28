/**
 * GET /api/mobile/followed/events
 *
 * Returns upcoming events from a batch of followed organizations and/or series.
 * Designed for the mobile starred/following tab — one round-trip instead of N.
 *
 * Query params (comma-separated IDs):
 *   orgIds    – organization IDs whose upcoming events to include
 *   seriesIds – parent event IDs whose child series events to include
 *
 * Response: { events: MobileEvent[] } sorted by start_date ascending.
 */
import type { APIRoute } from 'astro';
import { supabase, filterCurrentAndFutureEvents } from '@/lib/supabase';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

const EVENT_SELECT = `
  id, title, start_date, end_date, start_time, end_time,
  description, website, registration, cost, featured,
  external_image_url, parent_event_id, location_id, organization_id,
  primary_tag:tags!events_primary_tag_id_fkey(name),
  secondary_tag:tags!events_secondary_tag_id_fkey(name),
  location:locations!events_location_id_fkey(id, name, address, latitude, longitude),
  organization:organizations!events_organization_id_fkey(name)
`;

export const GET: APIRoute = async ({ url }) => {
  const orgIdsParam    = url.searchParams.get('orgIds')    ?? '';
  const seriesIdsParam = url.searchParams.get('seriesIds') ?? '';

  const orgIds    = orgIdsParam    ? orgIdsParam.split(',').filter(Boolean)    : [];
  const seriesIds = seriesIdsParam ? seriesIdsParam.split(',').filter(Boolean) : [];

  if (orgIds.length === 0 && seriesIds.length === 0) {
    return jsonResponse({ events: [] });
  }

  // Fetch org events and series child events in parallel
  const fetches: Promise<any[]>[] = [];

  if (orgIds.length > 0) {
    fetches.push(
      supabase
        .from('public_events')
        .select(EVENT_SELECT)
        .in('organization_id', orgIds)
        .neq('status', 'cancelled')
        .order('start_date', { ascending: true })
        .then(({ data }) => data ?? [])
    );
  }

  if (seriesIds.length > 0) {
    fetches.push(
      supabase
        .from('public_events')
        .select(EVENT_SELECT)
        .in('parent_event_id', seriesIds)
        .neq('status', 'cancelled')
        .order('start_date', { ascending: true })
        .then(({ data }) => data ?? [])
    );
  }

  const results = await Promise.all(fetches);
  const combined = results.flat();

  // Deduplicate by id (an event might be from a followed org AND a followed series)
  const seen = new Set<string>();
  const unique = combined.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  // Filter to today/future and sort by date ascending
  const events = filterCurrentAndFutureEvents(unique).sort(
    (a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? '')
  );

  return jsonResponse({ events });
};
