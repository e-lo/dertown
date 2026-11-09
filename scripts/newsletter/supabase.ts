/** Read-only Supabase access for the newsletter scripts (anon key, public views only). */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NewsletterSourceEvent } from '../../src/lib/newsletter/types';
import { CliError, requireEnv, type OccurrenceSnapshot } from './cli';

export function publicClient(): SupabaseClient {
  return createClient(requireEnv('PUBLIC_SUPABASE_URL'), requireEnv('PUBLIC_SUPABASE_KEY'), {
    auth: { persistSession: false },
  });
}

const EVENT_COLUMNS =
  'id, title, description, start_date, end_date, start_time, end_time, parent_event_id, featured, external_image_url, image_alt_text, primary_tag_name, cost, location_id';

type EventRow = Omit<NewsletterSourceEvent, 'location_name'> & { location_id: string | null };

async function withLocationNames(
  db: SupabaseClient,
  rows: EventRow[]
): Promise<NewsletterSourceEvent[]> {
  const locationIds = [
    ...new Set(rows.map((r) => r.location_id).filter((id): id is string => !!id)),
  ];
  const names = new Map<string, string>();
  if (locationIds.length) {
    const { data, error } = await db.from('locations').select('id, name').in('id', locationIds);
    if (error) throw new CliError(`Loading locations failed: ${error.message}`);
    for (const loc of data ?? []) names.set(loc.id, loc.name);
  }
  return rows.map(({ location_id, ...row }) => ({
    ...row,
    location_name: location_id ? (names.get(location_id) ?? null) : null,
  }));
}

/** Public events overlapping [start, end]. */
export async function fetchEventsBetween(
  db: SupabaseClient,
  start: string,
  end: string
): Promise<NewsletterSourceEvent[]> {
  const { data, error } = await db
    .from('public_events')
    .select(EVENT_COLUMNS)
    .lte('start_date', end)
    .or(`start_date.gte.${start},end_date.gte.${start}`)
    .order('start_date');
  if (error) throw new CliError(`Loading events failed: ${error.message}`);
  return withLocationNames(db, (data ?? []) as EventRow[]);
}

/** Current snapshot of the given event ids; ids no longer public are absent. */
export async function fetchSnapshots(
  db: SupabaseClient,
  ids: string[]
): Promise<Map<string, OccurrenceSnapshot>> {
  const { data, error } = await db
    .from('public_events')
    .select('id, title, start_date, end_date, start_time')
    .in('id', ids);
  if (error) throw new CliError(`Re-checking events failed: ${error.message}`);
  return new Map(
    (data ?? []).map(({ id, ...snapshot }) => [id as string, snapshot as OccurrenceSnapshot])
  );
}

export async function fetchAnnouncements(
  db: SupabaseClient
): Promise<{ title: string; body: string; url?: string }[]> {
  const { data, error } = await db.from('public_announcements').select('title, message, link');
  if (error) throw new CliError(`Loading announcements failed: ${error.message}`);
  return (data ?? [])
    .filter((a) => a.title && a.message)
    .map((a) => ({
      title: a.title as string,
      body: a.message as string,
      ...(a.link ? { url: a.link as string } : {}),
    }));
}
