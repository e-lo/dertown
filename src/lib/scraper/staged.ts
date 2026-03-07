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
  series_rules_matched: number;
  series_rules_linked: number;
  series_rules_unresolved: number;
}

interface SeriesParentTarget {
  id: string;
  table: 'events' | 'events_staged';
  title: string;
}

interface ConfiguredSeriesParentResolution {
  targets: Map<ProcessedEvent, SeriesParentTarget>;
  matchedRuleCount: number;
  resolvedTargetCount: number;
  unresolvedRuleCount: number;
}

const DEBUG_EVENT_ID = 'bc1cf502-396b-46e8-99d1-6e5dce4b6682';
const SCRAPER_APPROVED_PARENT_ID_PREFIX = '[SCRAPER_APPROVED_PARENT_ID:';

function buildApprovedParentMarker(parentId: string): string {
  return `${SCRAPER_APPROVED_PARENT_ID_PREFIX}${parentId}]`;
}

/** Write processed events to the database: insert new staged events, auto-update existing ones. */
export async function writeProcessedEvents(
  db: SupabaseClient<Database>,
  events: ProcessedEvent[],
  source: SourceConfig,
  verbose: boolean
): Promise<WriteResult> {
  const result: WriteResult = {
    inserted: 0,
    updated: 0,
    errors: [],
    series_rules_matched: 0,
    series_rules_linked: 0,
    series_rules_unresolved: 0,
  };
  const configuredSeriesParentResolution = await resolveConfiguredSeriesParentTargets(
    db,
    events,
    source,
    verbose
  );
  const configuredSeriesParentTargets = configuredSeriesParentResolution.targets;
  result.series_rules_matched = configuredSeriesParentResolution.matchedRuleCount;
  result.series_rules_linked = configuredSeriesParentResolution.resolvedTargetCount;
  result.series_rules_unresolved = configuredSeriesParentResolution.unresolvedRuleCount;
  const seriesParentIds = await resolveSeriesParentIds(
    db,
    events,
    source,
    configuredSeriesParentTargets,
    verbose
  );

  for (const ev of events) {
    try {
      const configuredSeriesParent = configuredSeriesParentTargets.get(ev);
      const seriesParentId =
        configuredSeriesParent?.table === 'events_staged'
          ? configuredSeriesParent.id
          : seriesParentIds.get(ev.series_key || '');

      if (verbose && ev.existing_event_id === DEBUG_EVENT_ID) {
        console.log(
          `    DEBUG ${DEBUG_EVENT_ID}: action=${ev.action} table=${ev.existing_event_table || 'n/a'}`
        );
        console.log(
          `    DEBUG ${DEBUG_EVENT_ID}: scraped website=${ev.scraped.website || 'null'} reg=${ev.scraped.registration_url || 'null'} location_name=${ev.scraped.location_name || 'null'} start=${ev.scraped.start_date} ${ev.scraped.start_time || ''}`
        );
        console.log(
          `    DEBUG ${DEBUG_EVENT_ID}: match location_id=${ev.location_id || 'null'} location_added=${ev.location_added || 'null'} series_parent=${seriesParentId || 'null'}`
        );
      }

      switch (ev.action) {
        case 'new':
          await insertStagedEvent(db, ev, source, seriesParentId, configuredSeriesParent, verbose);
          result.inserted++;
          break;
        case 'update':
          await autoUpdateEvent(db, ev, seriesParentId, configuredSeriesParent, verbose);
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
  configuredSeriesParent: SeriesParentTarget | undefined,
  verbose: boolean
): Promise<void> {
  const s = ev.scraped;

  // Build comments with extraction notes
  const notes: string[] = [];
  notes.push(`Source: ${source.name} (${source.url})`);
  if (s.website) notes.push(`Event page: ${s.website}`);
  if (!ev.location_id && ev.location_added) {
    notes.push(`Location not matched: "${ev.location_added}"`);
  }
  if (!ev.organization_id && ev.organization_added) {
    notes.push(`Organization not matched: "${ev.organization_added}"`);
  }
  if (!ev.primary_tag_id) notes.push('No tag matched — needs manual assignment');

  if (configuredSeriesParent?.table === 'events') {
    notes.push(`Series parent (approved): ${configuredSeriesParent.title}`);
    notes.push(buildApprovedParentMarker(configuredSeriesParent.id));
  }

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
    parent_event_id:
      configuredSeriesParent?.table === 'events_staged'
        ? configuredSeriesParent.id
        : seriesParentId || ev.parent_event_id,
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

function maxDate(values: string[]): string {
  return [...values].sort((a, b) => b.localeCompare(a))[0];
}

function normalizeForContains(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function eventMatchesSeriesKeywords(ev: ProcessedEvent, keywords: string[]): boolean {
  const titleHaystack = normalizeForContains(ev.scraped.title);
  if (!titleHaystack) return false;
  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeForContains(keyword);
    return !!normalizedKeyword && titleHaystack.includes(normalizedKeyword);
  });
}

/** Resolve YAML series_parent_rules to existing approved/staged parent targets per event. */
async function resolveConfiguredSeriesParentTargets(
  db: SupabaseClient<Database>,
  events: ProcessedEvent[],
  source: SourceConfig,
  verbose: boolean
): Promise<ConfiguredSeriesParentResolution> {
  const out = new Map<ProcessedEvent, SeriesParentTarget>();
  const rules = source.series_parent_rules || [];
  if (rules.length === 0) {
    return {
      targets: out,
      matchedRuleCount: 0,
      resolvedTargetCount: 0,
      unresolvedRuleCount: 0,
    };
  }

  const matchedRulesByEvent = new Map<ProcessedEvent, string>();

  for (const ev of events) {
    if (ev.action === 'skip') continue;
    for (const rule of rules) {
      if (!rule?.parent_title || !Array.isArray(rule.title_keywords)) continue;
      if (eventMatchesSeriesKeywords(ev, rule.title_keywords)) {
        matchedRulesByEvent.set(ev, rule.parent_title);
        break;
      }
    }
  }

  if (matchedRulesByEvent.size === 0) {
    return {
      targets: out,
      matchedRuleCount: 0,
      resolvedTargetCount: 0,
      unresolvedRuleCount: 0,
    };
  }

  const [approvedRes, stagedRes] = await Promise.all([
    db
      .from('events')
      .select('id, title, start_date')
      .eq('status', 'approved')
      .is('parent_event_id', null)
      .order('start_date', { ascending: false }),
    db
      .from('events_staged')
      .select('id, title, start_date')
      .eq('status', 'pending')
      .is('parent_event_id', null)
      .order('start_date', { ascending: false }),
  ]);

  if (approvedRes.error || stagedRes.error) {
    const msg = approvedRes.error?.message || stagedRes.error?.message || 'unknown error';
    if (verbose) {
      console.log(`    WARN: failed loading parents for series matching: ${msg}`);
    }
    return {
      targets: out,
      matchedRuleCount: matchedRulesByEvent.size,
      resolvedTargetCount: 0,
      unresolvedRuleCount: matchedRulesByEvent.size,
    };
  }

  // Prefer approved parents when titles collide, then fallback to staged.
  const parentByTitle = new Map<string, SeriesParentTarget>();
  for (const parent of approvedRes.data || []) {
    const key = parent.title.trim().toLowerCase();
    if (!parentByTitle.has(key)) {
      parentByTitle.set(key, { id: parent.id, table: 'events', title: parent.title });
    }
  }
  for (const parent of stagedRes.data || []) {
    const key = parent.title.trim().toLowerCase();
    if (!parentByTitle.has(key)) {
      parentByTitle.set(key, { id: parent.id, table: 'events_staged', title: parent.title });
    }
  }

  let unresolvedRuleCount = 0;
  for (const [ev, parentTitle] of matchedRulesByEvent.entries()) {
    const parent = parentByTitle.get(parentTitle.trim().toLowerCase());
    if (parent) {
      out.set(ev, parent);
      if (verbose) {
        console.log(
          `    SERIES MATCH "${ev.scraped.title}" -> ${parent.table}:${parent.title} (${parent.id})`
        );
      }
    } else if (verbose) {
      console.log(
        `    WARN: series_parent_rules matched "${ev.scraped.title}" but no parent titled "${parentTitle}" exists in approved events or pending staged parents`
      );
      unresolvedRuleCount++;
    } else {
      unresolvedRuleCount++;
    }
  }

  return {
    targets: out,
    matchedRuleCount: matchedRulesByEvent.size,
    resolvedTargetCount: out.size,
    unresolvedRuleCount,
  };
}

/** For multi-instance scraped events, create or reuse a staged parent row and return parent IDs by series key. */
async function resolveSeriesParentIds(
  db: SupabaseClient<Database>,
  events: ProcessedEvent[],
  source: SourceConfig,
  configuredSeriesParentTargets: Map<ProcessedEvent, SeriesParentTarget>,
  verbose: boolean
): Promise<Map<string, string>> {
  const parentIds = new Map<string, string>();
  const groups = new Map<string, ProcessedEvent[]>();

  for (const ev of events) {
    if (!ev.series_key || ev.action === 'skip') continue;
    if (!groups.has(ev.series_key)) groups.set(ev.series_key, []);
    groups.get(ev.series_key)!.push(ev);
  }

  for (const [seriesKey, group] of groups.entries()) {
    // If config explicitly mapped this series to an existing parent, do not auto-create.
    const configuredTarget = group
      .map((ev) => configuredSeriesParentTargets.get(ev))
      .find((target): target is SeriesParentTarget => !!target);

    if (configuredTarget) {
      if (configuredTarget.table === 'events_staged') {
        parentIds.set(seriesKey, configuredTarget.id);
      }
      continue;
    }

    // Only auto-create a parent when we have at least 2 instances in this scrape batch.
    if (group.length < 2) continue;

    const earliestStart = minDate(group.map((e) => e.scraped.start_date));
    const latestStart = maxDate(group.map((e) => e.scraped.start_date));
    const first = group[0];
    const parentTitle = first.series_parent_title || first.scraped.title;
    const parentWebsite = first.series_parent_website || first.scraped.website || null;

    // Reuse an existing staged series parent if one already exists.
    const { data: existingParent } = await db
      .from('events_staged')
      .select('id')
      .like('comments', `%[SCRAPER_SERIES_KEY:${seriesKey}]%`)
      .limit(1)
      .maybeSingle();

    if (existingParent?.id) {
      // Keep parent row as series summary: date span only, no time fields.
      await db
        .from('events_staged')
        .update({
          title: parentTitle,
          source_title: parentTitle,
          start_date: earliestStart,
          end_date: latestStart === earliestStart ? null : latestStart,
          start_time: null,
          end_time: null,
          website: parentWebsite,
          registration_link: parentWebsite,
          registration: !!parentWebsite,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingParent.id);
      parentIds.set(seriesKey, existingParent.id);
      continue;
    }

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
      end_date: latestStart === earliestStart ? null : latestStart,
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
  seriesParentId: string | undefined,
  configuredSeriesParent: SeriesParentTarget | undefined,
  verbose: boolean
): Promise<void> {
  if (!ev.existing_event_id) {
    throw new Error('Cannot update: no existing_event_id');
  }

  const s = ev.scraped;

  // Build the update payload — only include fields that have values
  // Never overwrite `title` (admin may have customized it)
  const update: Partial<EventUpdate & StagedUpdate> = {};

  if (s.start_time) update.start_time = s.start_time;
  if (s.end_time) update.end_time = s.end_time;
  if (s.cost) update.cost = s.cost;
  if (s.description) update.description = s.description;
  if (s.website) update.website = s.website;
  if (s.registration_url) update.registration_link = s.registration_url;
  if (s.image_url) update.external_image_url = s.image_url;
  if (ev.location_id) {
    update.location_id = ev.location_id;
    if (ev.existing_event_table === 'events_staged') {
      update.location_added = null;
    }
  } else if (ev.location_added && ev.existing_event_table === 'events_staged') {
    update.location_id = null;
    update.location_added = ev.location_added;
  }

  if (configuredSeriesParent?.table === 'events' && ev.existing_event_table === 'events') {
    update.parent_event_id = configuredSeriesParent.id;
  } else if (seriesParentId && ev.existing_event_table === 'events_staged') {
    update.parent_event_id = seriesParentId;
  }

  if (verbose && ev.existing_event_id === DEBUG_EVENT_ID) {
    console.log(
      `    DEBUG ${DEBUG_EVENT_ID}: update payload=${JSON.stringify(update)} existing_table=${ev.existing_event_table || 'unknown'}`
    );
  }

  // Only write if there's something to update
  if (Object.keys(update).length === 0) return;

  update.updated_at = new Date().toISOString();

  if (ev.existing_event_table === 'events_staged') {
    const { error } = await db
      .from('events_staged')
      .update(update as StagedUpdate)
      .eq('id', ev.existing_event_id);
    if (verbose && ev.existing_event_id === DEBUG_EVENT_ID) {
      console.log(
        `    DEBUG ${DEBUG_EVENT_ID}: events_staged update error=${error?.message || 'none'}`
      );
    }
    if (error) throw new Error(error.message);
  } else if (ev.existing_event_table === 'events') {
    const { error } = await db
      .from('events')
      .update(update as EventUpdate)
      .eq('id', ev.existing_event_id);
    if (verbose && ev.existing_event_id === DEBUG_EVENT_ID) {
      console.log(`    DEBUG ${DEBUG_EVENT_ID}: events update error=${error?.message || 'none'}`);
    }
    if (error) throw new Error(error.message);
  } else {
    // Backward-compatible fallback when table info isn't available.
    const { error: evtError } = await db
      .from('events')
      .update(update as EventUpdate)
      .eq('id', ev.existing_event_id);
    if (evtError) {
      const { error: stagedError } = await db
        .from('events_staged')
        .update(update as StagedUpdate)
        .eq('id', ev.existing_event_id);
      if (verbose && ev.existing_event_id === DEBUG_EVENT_ID) {
        console.log(
          `    DEBUG ${DEBUG_EVENT_ID}: fallback events error=${evtError.message}; fallback staged error=${stagedError?.message || 'none'}`
        );
      }
      if (stagedError) throw new Error(stagedError.message);
    } else if (verbose && ev.existing_event_id === DEBUG_EVENT_ID) {
      console.log(`    DEBUG ${DEBUG_EVENT_ID}: fallback events update success`);
    }
  }

  if (verbose) {
    console.log(`    UPDATED "${s.title}": ${ev.update_reason}`);
  }
}
