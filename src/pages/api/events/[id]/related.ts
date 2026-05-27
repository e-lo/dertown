/**
 * GET /api/events/:id/related
 *
 * Returns series siblings (or children) and org/location-related events for a
 * given event — same logic as the server-rendered events/[id].astro page,
 * exposed as JSON so both the mobile app and future web clients can consume it.
 *
 * Query params (all optional):
 *   seriesLimit  – max series events to return (0 = all, default all)
 *   relatedLimit – max related events to return (0 = all, default all)
 */
import type { APIRoute } from 'astro';
import { supabase, db } from '@/lib/supabase';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

/** 14-day lookback matches [id].astro series filter */
function cutoffDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return d.toISOString().split('T')[0];
}

export const GET: APIRoute = async ({ params, url }) => {
  const { id } = params;
  if (!id) return jsonError('Missing event id', 400);

  const seriesLimit  = parseInt(url.searchParams.get('seriesLimit')  ?? '0', 10);
  const relatedLimit = parseInt(url.searchParams.get('relatedLimit') ?? '0', 10);

  // ── 1. Fetch current event ─────────────────────────────────────────────────
  const { data: event, error } = await db.events.getById(id);
  if (error || !event) return jsonError('Event not found', 404);

  const parentEventId: string | null = (event as any).parent_event_id ?? null;

  // ── 2. Series events (mirrors [id].astro logic exactly) ───────────────────
  const cutoff = cutoffDate();

  function filterAndSort(events: any[]): any[] {
    return events
      .filter((e) => e.id !== id)
      .filter((e) => e.start_date >= cutoff || (e.end_date && e.end_date >= cutoff))
      .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
  }

  let seriesMeta: {
    parent_id: string;
    parent_title: string;
    is_parent: boolean;
  } | null = null;
  let seriesEvents: any[] = [];

  if (parentEventId) {
    // Child event — fetch parent title + siblings concurrently
    const [parentRes, siblingsRes] = await Promise.all([
      supabase.from('public_events').select('id, title').eq('id', parentEventId).single(),
      db.events.getByParentEventId(parentEventId),
    ]);

    seriesEvents = filterAndSort(siblingsRes.data ?? []);

    if (parentRes.data) {
      seriesMeta = {
        parent_id:    parentEventId,
        parent_title: parentRes.data.title as string,
        is_parent:    false,
      };
    }
  } else {
    // Might be the parent itself — fetch children
    const { data: children } = await db.events.getByParentEventId(id);
    seriesEvents = filterAndSort(children ?? []);

    if (seriesEvents.length > 0) {
      seriesMeta = {
        parent_id:    id,
        parent_title: (event as any).title as string,
        is_parent:    true,
      };
    }
  }

  if (seriesLimit > 0) seriesEvents = seriesEvents.slice(0, seriesLimit);

  // ── 3. Related events (same org or location, minus series) ────────────────
  const { data: relatedData } = await db.events.getRelated(
    id,
    (event as any).organization_id ?? null,
    (event as any).location_id     ?? null
  );

  const seriesIds = new Set(seriesEvents.map((e) => e.id));
  let relatedEvents = (relatedData ?? []).filter((e) => !seriesIds.has(e.id));
  if (relatedLimit > 0) relatedEvents = relatedEvents.slice(0, relatedLimit);

  return jsonResponse({
    series: seriesMeta
      ? { ...seriesMeta, events: seriesEvents }
      : null,
    related: relatedEvents,
  });
};
