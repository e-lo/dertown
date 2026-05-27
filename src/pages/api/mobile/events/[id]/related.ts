import type { APIRoute } from 'astro';
import { supabase } from '@/lib/supabase';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

/** Default caps — override with ?seriesLimit=N&orgLimit=N */
const DEFAULT_SERIES_LIMIT = 3;
const DEFAULT_ORG_LIMIT    = 3;

const EVENT_SELECT = `
  id, title, start_date, start_time, end_time,
  registration, organization_id,
  primary_tag:tags!events_primary_tag_id_fkey(name),
  secondary_tag:tags!events_secondary_tag_id_fkey(name),
  location:locations!events_location_id_fkey(name, address)
`;

export const GET: APIRoute = async ({ params, url }) => {
  const { id } = params;
  if (!id) return jsonError('Missing event id', 400);

  const seriesLimit = Math.min(
    parseInt(url.searchParams.get('seriesLimit') ?? String(DEFAULT_SERIES_LIMIT), 10),
    10
  );
  const orgLimit = Math.min(
    parseInt(url.searchParams.get('orgLimit') ?? String(DEFAULT_ORG_LIMIT), 10),
    10
  );

  const today = new Date().toISOString().split('T')[0];

  // ── 1. Fetch the current event's metadata ─────────────────────────────────
  const { data: cur, error: curErr } = await supabase
    .from('public_events')
    .select('id, title, parent_event_id, organization_id')
    .eq('id', id)
    .single();

  if (curErr || !cur) {
    return jsonError('Event not found', 404);
  }

  // ── 2. Series events ──────────────────────────────────────────────────────
  let series: {
    parent_id: string;
    parent_title: string;
    upcoming: unknown[];
  } | null = null;

  if (cur.parent_event_id) {
    // This event is a child — fetch parent title + upcoming siblings
    const [parentRes, siblingsRes] = await Promise.all([
      supabase
        .from('public_events')
        .select('id, title')
        .eq('id', cur.parent_event_id)
        .single(),
      supabase
        .from('public_events')
        .select(EVENT_SELECT)
        .eq('parent_event_id', cur.parent_event_id)
        .neq('id', id)
        .gte('start_date', today)
        .order('start_date', { ascending: true })
        .limit(seriesLimit),
    ]);

    if (parentRes.data) {
      series = {
        parent_id: parentRes.data.id,
        parent_title: parentRes.data.title,
        upcoming: siblingsRes.data ?? [],
      };
    }
  } else {
    // This event might be the series parent — fetch upcoming children
    const { data: children } = await supabase
      .from('public_events')
      .select(EVENT_SELECT)
      .eq('parent_event_id', id)
      .neq('id', id)
      .gte('start_date', today)
      .order('start_date', { ascending: true })
      .limit(seriesLimit);

    if (children && children.length > 0) {
      series = {
        parent_id: id,
        parent_title: cur.title,
        upcoming: children,
      };
    }
  }

  // ── 3. Org events (excluding series siblings) ─────────────────────────────
  const seriesIds = new Set((series?.upcoming as { id: string }[])?.map((e) => e.id) ?? []);

  let orgEvents: unknown[] = [];
  if (cur.organization_id) {
    // Fetch a few extra so we have room to filter out series events in JS
    let query = supabase
      .from('public_events')
      .select(EVENT_SELECT)
      .eq('organization_id', cur.organization_id)
      .neq('id', id)
      .gte('start_date', today)
      .order('start_date', { ascending: true })
      .limit(orgLimit + seriesIds.size + 2);

    // Exclude events from the same series (they appear in the series section)
    if (cur.parent_event_id) {
      query = query.or(
        `parent_event_id.is.null,parent_event_id.neq.${cur.parent_event_id}`
      );
    }

    const { data } = await query;
    orgEvents = (data ?? [])
      .filter((e: { id: string }) => !seriesIds.has(e.id))
      .slice(0, orgLimit);
  }

  return jsonResponse({ series, org_events: orgEvents });
};
