import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import type { ProcessedEvent, SourceConfig } from './types';

type StagedInsert = Database['public']['Tables']['events_staged']['Insert'];
type EventUpdate = Database['public']['Tables']['events']['Update'];

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

  for (const ev of events) {
    try {
      switch (ev.action) {
        case 'new':
          await insertStagedEvent(db, ev, source, verbose);
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
  verbose: boolean
): Promise<void> {
  const s = ev.scraped;

  // Build comments with extraction notes
  const notes: string[] = [];
  notes.push(`Source: ${source.name} (${source.url})`);
  if (s.website) notes.push(`Event page: ${s.website}`);
  if (!ev.location_id && ev.location_added) notes.push(`Location not matched: "${ev.location_added}"`);
  if (!ev.organization_id && ev.organization_added) notes.push(`Organization not matched: "${ev.organization_added}"`);
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
    parent_event_id: ev.parent_event_id,
    source_id: ev.source_id,
    status: 'pending',
    submitted_at: new Date().toISOString(),
    comments: notes.join('\n'),
  };

  const { error } = await db.from('events_staged').insert(row);
  if (error) throw new Error(error.message);

  if (verbose) console.log(`    INSERTED staged: "${s.title}" (${s.start_date})`);
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

  // Try updating in events table first, then events_staged
  const { error: evtError } = await db
    .from('events')
    .update(update)
    .eq('id', ev.existing_event_id);

  if (evtError) {
    // Maybe it's a staged event
    const { error: stagedError } = await db
      .from('events_staged')
      .update(update)
      .eq('id', ev.existing_event_id);

    if (stagedError) throw new Error(stagedError.message);
  }

  if (verbose) {
    console.log(`    UPDATED "${s.title}": ${ev.update_reason}`);
  }
}
