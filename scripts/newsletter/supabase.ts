/**
 * Read-only Supabase access for the newsletter scripts. Events come from the
 * public views with the anon key; series parents need SUPABASE_SERVICE_ROLE_KEY
 * (see withParentFields).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  INHERITABLE_COLUMNS,
  inheritParentFields,
  type InheritableFields,
} from '../../src/lib/newsletter/inherit-parent';
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

/**
 * Reads series parents. They're usually excluded from the calendar, which RLS
 * hides from the anon key, so this uses the service-role key when it's set.
 */
function parentReader(fallback: SupabaseClient): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return fallback;
  return createClient(requireEnv('PUBLIC_SUPABASE_URL'), serviceKey, {
    auth: { persistSession: false },
  });
}

/**
 * Fill blank child fields from their series parent, like the event page does.
 * Parents come from the base `events` table, since they're usually not in
 * public_events.
 */
async function withParentFields(db: SupabaseClient, rows: EventRow[]): Promise<EventRow[]> {
  const parentIds = [
    ...new Set(rows.map((r) => r.parent_event_id).filter((id): id is string => !!id)),
  ];
  if (!parentIds.length) return rows;
  const { data, error } = await parentReader(db)
    .from('events')
    .select(INHERITABLE_COLUMNS)
    .in('id', parentIds);
  if (error) throw new CliError(`Loading series parents failed: ${error.message}`);
  const unread = parentIds.length - (data ?? []).length;
  if (unread > 0) {
    console.warn(
      `⚠️  ${unread} of ${parentIds.length} series parents couldn't be read, so their children` +
        ` may be missing a description, image or location. Set SUPABASE_SERVICE_ROLE_KEY in .env.local.`
    );
  }
  const parents = new Map<string, InheritableFields>(
    ((data ?? []) as (InheritableFields & { id: string })[]).map(({ id, ...fields }) => [
      id,
      fields,
    ])
  );
  return inheritParentFields(rows, parents);
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
  return withLocationNames(db, await withParentFields(db, (data ?? []) as EventRow[]));
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
