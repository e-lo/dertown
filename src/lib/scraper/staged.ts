import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import type { ProcessedEvent, SourceConfig } from './types';

type StagedInsert = Database['public']['Tables']['events_staged']['Insert'];
type EventUpdate = Database['public']['Tables']['events']['Update'];
type StagedUpdate = Database['public']['Tables']['events_staged']['Update'];

interface WriteResult {
  inserted: number;
  updated: number;
  errors: string[];
}

/** Write processed events to the database: insert new staged events, auto-update existing ones. */
export async function writeProcessedEvents(
  db: SupabaseClient<Database>,
  events: ProcessedEvent[],
  source: SourceConfig,
  verbose: boolean
): Promise<WriteResult> {
  const result: WriteResult = { inserted: 0, updated: 0, errors: [] };
  const seriesParentIds = await resolveSeriesParentIds(db, events, source, verbose);

  for (const ev of events) {
    try {
      switch (ev.action) {
        case 'new':
          await insertStagedEvent(db, ev, source, seriesParentIds.get(ev.series_key || ''), verbose);
          result.inserted++;
          break;
        case 'update':
          await autoUpdateEvent(db, ev, verbose);
          result.updated++;
          break;
        case 'skip':
          // Nothing to write
          break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${ev.scraped.title}: ${msg}`);
      if (verbose) console.log(`    DB ERROR "${ev.scraped.title}": ${msg}`);
    }
  }

  return result;
}

/** Insert a new scraped event into events_staged. */
async function insertStagedEvent(
  db: SupabaseClient<Database>,
  ev: ProcessedEvent,
  source: SourceConfig,
  seriesParentId: string | undefined,
  verbose: boolean
): Promise<void> {
  const s = ev.scraped;

  // Build comments with extraction notes
  const notes: string[] = [];
  notes.push(`Source: ${source.name} (${source.url})`);
  if (s.website) notes.push(`Event page: ${s.website}`);
  if (!ev.location_id && ev.location_added)
    notes.push(`Location not matched: "${ev.location_added}"`);
  if (!ev.organization_id && ev.organization_added)
    notes.push(`Organization not matched: "${ev.organization_added}"`);
  if (!ev.primary_tag_id) notes.push('No tag matched — needs manual assignment');

  const row: StagedInsert = {
    title: s.title,
    source_title: s.title,
    description: s.description,
    start_date: s.start_date,
    end_date: s.end_date,
    start_time: s.start_time,
    end_time: s.end_time,
    cost: s.cost,
    website: s.website,
    registration_link: s.registration_url,
    registration: s.registration_required ?? false,
    external_image_url: s.image_url,
    location_id: ev.location_id,
    location_added: ev.location_id ? null : ev.location_added,
    organization_id: ev.organization_id,
    organization_added: ev.organization_id ? null : ev.organization_added,
    primary_tag_id: ev.primary_tag_id,
    parent_event_id: seriesParentId || ev.parent_event_id,
    source_id: ev.source_id,
    status: 'pending',
    submitted_at: new Date().toISOString(),
    comments: notes.join('\n'),
  };

  const { error } = await db.from('events_staged').insert(row);
  if (error) throw new Error(error.message);

  if (verbose) console.log(`    INSERTED staged: "${s.title}" (${s.start_date})`);
}

function minDate(values: string[]): string {
  return [...values].sort((a, b) => a.localeCompare(b))[0];
}

/** For multi-instance scraped events, create or reuse a staged parent row and return parent IDs by series key. */
async function resolveSeriesParentIds(
  db: SupabaseClient<Database>,
  events: ProcessedEvent[],
  source: SourceConfig,
  verbose: boolean
): Promise<Map<string, string>> {
  const parentIds = new Map<string, string>();
  const groups = new Map<string, ProcessedEvent[]>();

  for (const ev of events) {
    if (ev.action !== 'new' || !ev.series_key) continue;
    if (!groups.has(ev.series_key)) groups.set(ev.series_key, []);
    groups.get(ev.series_key)!.push(ev);
  }

  for (const [seriesKey, group] of groups.entries()) {
    // Only auto-create a parent when we have at least 2 instances in this scrape batch.
    if (group.length < 2) continue;

    // Reuse an existing staged series parent if one already exists.
    const { data: existingParent } = await db
      .from('events_staged')
      .select('id')
      .like('comments', `%[SCRAPER_SERIES_KEY:${seriesKey}]%`)
      .limit(1)
      .maybeSingle();

    if (existingParent?.id) {
      parentIds.set(seriesKey, existingParent.id);
      continue;
    }

    const first = group[0];
    const earliestStart = minDate(group.map((e) => e.scraped.start_date));
    const parentTitle = first.series_parent_title || first.scraped.title;
    const parentWebsite = first.series_parent_website || first.scraped.website || null;

    const notes: string[] = [
      `Source: ${source.name} (${source.url})`,
      `Auto-created series parent for ${group.length} scraped instances.`,
      `[SCRAPER_SERIES_KEY:${seriesKey}]`,
    ];
    if (parentWebsite) notes.push(`Series page: ${parentWebsite}`);

    const parentInsert: StagedInsert = {
      title: parentTitle,
      source_title: parentTitle,
      description: first.scraped.description,
      start_date: earliestStart,
      end_date: null,
      start_time: null,
      end_time: null,
      cost: null,
      website: parentWebsite,
      registration_link: parentWebsite,
      registration: !!parentWebsite,
      external_image_url: first.scraped.image_url,
      location_id: first.location_id,
      location_added: first.location_id ? null : first.location_added,
      organization_id: first.organization_id,
      organization_added: first.organization_id ? null : first.organization_added,
      primary_tag_id: first.primary_tag_id,
      secondary_tag_id: null,
      parent_event_id: null,
      source_id: first.source_id,
      status: 'pending',
      submitted_at: new Date().toISOString(),
      comments: notes.join('\n'),
    };

    const { data: createdParent, error: parentError } = await db
      .from('events_staged')
      .insert(parentInsert)
      .select('id')
      .single();

    if (parentError || !createdParent?.id) {
      if (verbose) {
        const msg = parentError?.message || 'unknown error';
        console.log(`    WARN: failed to create series parent for ${seriesKey}: ${msg}`);
      }
      continue;
    }

    parentIds.set(seriesKey, createdParent.id);
    if (verbose) {
      console.log(`    INSERTED staged series parent: "${parentTitle}" (${seriesKey})`);
    }
  }

  return parentIds;
}

/** Auto-update an existing event with minor changes (time, cost, description, registration). */
async function autoUpdateEvent(
  db: SupabaseClient<Database>,
  ev: ProcessedEvent,
  verbose: boolean
): Promise<void> {
  if (!ev.existing_event_id) {
    throw new Error('Cannot update: no existing_event_id');
  }

  const s = ev.scraped;

  // Build the update payload — only include fields that have values
  // Never overwrite `title` (admin may have customized it)
  const update: EventUpdate = {};

  if (s.start_time) update.start_time = s.start_time;
  if (s.end_time) update.end_time = s.end_time;
  if (s.cost) update.cost = s.cost;
  if (s.description) update.description = s.description;
  if (s.registration_url) update.registration_link = s.registration_url;
  if (s.image_url) update.external_image_url = s.image_url;

  // Only write if there's something to update
  if (Object.keys(update).length === 0) return;

  update.updated_at = new Date().toISOString();

  if (ev.existing_event_table === 'events_staged') {
    const { error } = await db
      .from('events_staged')
      .update(update as StagedUpdate)
      .eq('id', ev.existing_event_id);
    if (error) throw new Error(error.message);
  } else if (ev.existing_event_table === 'events') {
    const { error } = await db.from('events').update(update).eq('id', ev.existing_event_id);
    if (error) throw new Error(error.message);
  } else {
    // Backward-compatible fallback when table info isn't available.
    const { error: evtError } = await db
      .from('events')
      .update(update)
      .eq('id', ev.existing_event_id);
    if (evtError) {
      const { error: stagedError } = await db
        .from('events_staged')
        .update(update as StagedUpdate)
        .eq('id', ev.existing_event_id);
      if (stagedError) throw new Error(stagedError.message);
    }
  }

  if (verbose) {
    console.log(`    UPDATED "${s.title}": ${ev.update_reason}`);
  }
}
