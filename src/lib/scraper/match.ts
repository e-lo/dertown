import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import type { ScrapedEvent, ProcessedEvent, SourceConfig, VenueTagRule } from './types';
import {
  DEFAULT_NAME_MATCH_THRESHOLD,
  findBestNameMatch,
  similarityScore as similarity,
} from '../entity-matching';
const MATCH_THRESHOLD = DEFAULT_NAME_MATCH_THRESHOLD;

function resolveMappedName(
  rawName: string | null,
  mapping: Record<string, string> | null | undefined
): string | null {
  if (!rawName || !mapping) return rawName;

  const normalizedRaw = rawName.trim().toLowerCase();
  const entries = Object.entries(mapping);

  // Exact case-insensitive key match first
  const exact = entries.find(([key]) => key.trim().toLowerCase() === normalizedRaw);
  if (exact) return exact[1];

  // Fallback to contains matching in either direction
  const partial = entries.find(([key]) => {
    const normalizedKey = key.trim().toLowerCase();
    return normalizedRaw.includes(normalizedKey) || normalizedKey.includes(normalizedRaw);
  });
  if (partial) return partial[1];

  return rawName;
}

function normalizeTextForContainment(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Infer location by exact normalized containment of known location names in title/description text. */
function inferLocationNameFromEventText(event: ScrapedEvent, locations: LocationRow[]): string | null {
  const haystack = normalizeTextForContainment(`${event.title} ${event.description || ''}`);
  if (!haystack) return null;

  let best: string | null = null;
  let bestLen = 0;

  for (const loc of locations) {
    const normalizedName = normalizeTextForContainment(loc.name);
    if (!normalizedName || normalizedName.length < 6) continue;
    if (haystack.includes(normalizedName) && normalizedName.length > bestLen) {
      best = loc.name;
      bestLen = normalizedName.length;
    }
  }

  return best;
}

// ── Reference data cache ─────────────────────────────────────────────

interface LocationRow {
  id: string;
  name: string;
  address: string | null;
}

interface OrgRow {
  id: string;
  name: string;
}

interface TagRow {
  id: string;
  name: string;
}

interface ExistingEvent {
  id: string;
  table: 'events' | 'events_staged';
  title: string;
  source_title: string | null;
  source_id: string | null;
  status: string | null;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
  cost: string | null;
  website: string | null;
  registration_link: string | null;
  location_id: string | null;
}

interface SourceSiteRow {
  id: string;
  name: string;
  url: string;
}

export interface ReferenceData {
  locations: LocationRow[];
  organizations: OrgRow[];
  tags: TagRow[];
  sourceSites: SourceSiteRow[];
  existingEvents: ExistingEvent[];
  existingStaged: ExistingEvent[];
}

/** Load reference data from the database for matching. */
export async function loadReferenceData(db: SupabaseClient<Database>): Promise<ReferenceData> {
  const [locRes, orgRes, tagRes, srcRes, evtRes, stagedRes] = await Promise.all([
    db.from('locations').select('id, name, address'),
    db.from('organizations').select('id, name'),
    db.from('tags').select('id, name'),
    db.from('source_sites').select('id, name, url'),
    db
      .from('events')
      .select(
        'id, title, source_title, source_id, status, start_date, start_time, end_time, description, cost, website, registration_link, location_id'
      ),
    db
      .from('events_staged')
      .select(
        'id, title, source_title, source_id, status, start_date, start_time, end_time, description, cost, website, registration_link, location_id'
      ),
  ]);

  return {
    locations: (locRes.data || []) as LocationRow[],
    organizations: (orgRes.data || []) as OrgRow[],
    tags: (tagRes.data || []) as TagRow[],
    sourceSites: (srcRes.data || []) as SourceSiteRow[],
    existingEvents: ((evtRes.data || []) as Omit<ExistingEvent, 'table'>[]).map((e) => ({
      ...e,
      table: 'events',
    })),
    existingStaged: ((stagedRes.data || []) as Omit<ExistingEvent, 'table'>[]).map((e) => ({
      ...e,
      table: 'events_staged',
    })),
  };
}

// ── Matching functions ───────────────────────────────────────────────

/** Find the best matching location by name. Returns the location ID or null. */
export function matchLocation(name: string | null, locations: LocationRow[]): string | null {
  const bestMatch = findBestNameMatch(
    name,
    locations.map((loc) => ({ id: loc.id, name: loc.name, address: loc.address })),
    { includeAddress: true }
  );
  if (!bestMatch) return null;
  return bestMatch.score >= MATCH_THRESHOLD ? bestMatch.id : null;
}

/** Find the best matching organization by name. Returns the org ID or null. */
export function matchOrganization(name: string | null, organizations: OrgRow[]): string | null {
  const bestMatch = findBestNameMatch(
    name,
    organizations.map((org) => ({ id: org.id, name: org.name }))
  );
  if (!bestMatch) return null;
  return bestMatch.score >= MATCH_THRESHOLD ? bestMatch.id : null;
}

/** Normalize a tag name for comparison: lowercase, strip non-alphanumeric. */
function normTag(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Find a tag ID by name (normalized match — "arts-culture" matches "Arts+Culture"). */
export function matchTag(tagName: string | null, tags: TagRow[]): string | null {
  if (!tagName) return null;
  const normalized = normTag(tagName);
  const tag = tags.find((t) => normTag(t.name) === normalized);
  return tag?.id || null;
}

/** Build pre-compiled word-boundary regexes from config tag keywords. */
function buildTagRegexes(tagKeywords: Record<string, string[]>): [string, RegExp][] {
  return Object.entries(tagKeywords).flatMap(([tagName, keywords]) =>
    keywords.map((kw): [string, RegExp] => [tagName, new RegExp(`\\b${kw}\\b`)])
  );
}

/** Build pre-compiled venue tag patterns from config. */
function buildVenuePatterns(venueTags: VenueTagRule[]): [RegExp, string][] {
  return venueTags.map((v) => [new RegExp(v.match, 'i'), v.tag]);
}

/** Infer a tag from event content and venue name, using config-driven keywords. */
export function inferTag(
  event: ScrapedEvent,
  tags: TagRow[],
  tagRegexes: [string, RegExp][],
  venuePatterns: [RegExp, string][],
  locationName?: string | null
): string | null {
  const text = `${event.title} ${event.description || ''}`.toLowerCase();

  // Check keyword matches (word-boundary so "art" doesn't match inside "nature")
  for (const [tagName, re] of tagRegexes) {
    if (re.test(text)) {
      return matchTag(tagName, tags);
    }
  }

  // Check venue-based defaults
  if (locationName) {
    for (const [pattern, tagName] of venuePatterns) {
      if (pattern.test(locationName)) {
        return matchTag(tagName, tags);
      }
    }
  }

  return null;
}

// ── Deduplication ────────────────────────────────────────────────────

interface DedupResult {
  action: 'new' | 'update' | 'skip';
  existing_event_id?: string;
  existing_event_table?: 'events' | 'events_staged';
  update_reason?: string;
}

/** Normalize time strings to HH:MM precision for dedup/update comparisons. */
function normalizeTimeForCompare(time: string | null | undefined): string | null {
  if (!time) return null;
  const trimmed = time.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return trimmed;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/** Canonicalize URL strings for duplicate comparison. */
function normalizeUrlForCompare(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    const path = u.pathname.replace(/\/+$/, '');
    const port = u.port ? `:${u.port}` : '';
    return `${u.protocol}//${u.hostname.toLowerCase()}${port}${path}${u.search}${u.hash}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

function urlsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const an = normalizeUrlForCompare(a);
  const bn = normalizeUrlForCompare(b);
  return !!an && !!bn && an === bn;
}

/** Normalize a title for dedup comparison. */
function normTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Significant words from a title (lowercase, stripped of noise). */
function titleWords(title: string): Set<string> {
  const stop = new Set(['the', 'a', 'an', 'and', 'at', 'in', 'of', 'for', 'to', 'by', '-', '&']);
  return new Set(
    normTitle(title)
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stop.has(w))
  );
}

/** Try to match a scraped event title against an existing event.
 *  Returns true if titles are similar enough to be considered the same event.
 */
function titlesMatch(scrapedTitle: string, existingTitle: string): boolean {
  const scrapedNorm = normTitle(scrapedTitle);
  const existingNorm = normTitle(existingTitle);
  if (scrapedNorm === existingNorm) return true;

  // Fuzzy similarity (handles typos, minor differences)
  if (similarity(scrapedTitle, existingTitle) >= 0.75) return true;

  // Substring containment (handles "Ecstatic Dance: March" matching "Ecstatic Dance")
  if (scrapedNorm.length > 8 && existingNorm.length > 8) {
    if (scrapedNorm.includes(existingNorm) || existingNorm.includes(scrapedNorm)) return true;
  }

  // Word-overlap check (handles reordered titles like "Singer Songwriter Storyteller - May"
  // vs "May Singer Songwriter Storyteller", and extra words like "Banff Centre Mountain Film
  // Festival World Tour" vs "Banff Mountain Film Festival")
  const wordsA = titleWords(scrapedTitle);
  const wordsB = titleWords(existingTitle);
  if (wordsA.size >= 2 && wordsB.size >= 2) {
    const smaller = wordsA.size <= wordsB.size ? wordsA : wordsB;
    const larger = wordsA.size <= wordsB.size ? wordsB : wordsA;
    let overlap = 0;
    for (const w of smaller) {
      if (larger.has(w)) overlap++;
    }
    // If 80%+ of the smaller title's words appear in the larger, it's a match
    if (overlap / smaller.size >= 0.8) return true;
  }

  return false;
}

/** Check if an event already exists and decide what to do.
 *  First checks same-source matches (for update detection),
 *  then checks ALL events cross-source (to avoid duplicating manually-entered events).
 */
export function dedup(
  event: ScrapedEvent,
  sourceId: string | null,
  existingEvents: ExistingEvent[],
  existingStaged: ExistingEvent[]
): DedupResult {
  const allExisting = [...existingEvents, ...existingStaged];

  // Pass 1: Same source + same date (can detect updates)
  const sameSourceCandidates = sourceId
    ? allExisting.filter((e) => e.source_id === sourceId && e.start_date === event.start_date)
    : [];

  for (const existing of sameSourceCandidates) {
    const urlMatched =
      urlsMatch(event.website, existing.website) ||
      urlsMatch(event.website, existing.registration_link) ||
      urlsMatch(event.registration_url, existing.website) ||
      urlsMatch(event.registration_url, existing.registration_link);

    if (urlMatched || titlesMatch(event.title, existing.source_title || existing.title)) {
      // Found a same-source match — check if anything changed
      const changes: string[] = [];

      const scrapedStartTime = normalizeTimeForCompare(event.start_time);
      const existingStartTime = normalizeTimeForCompare(existing.start_time);
      if (scrapedStartTime && existingStartTime && scrapedStartTime !== existingStartTime) {
        changes.push(`time changed ${existingStartTime}→${scrapedStartTime}`);
      }
      if (event.cost && existing.cost && event.cost !== existing.cost) {
        changes.push(`cost changed ${existing.cost}→${event.cost}`);
      }

      if (changes.length === 0) {
        return {
          action: 'skip',
          existing_event_id: existing.id,
          existing_event_table: existing.table,
        };
      }

      return {
        action: 'update',
        existing_event_id: existing.id,
        existing_event_table: existing.table,
        update_reason: changes.join(', '),
      };
    }
  }

  // Pass 2: Cross-source — check ALL events by date + title similarity.
  // This catches events entered manually or sourced from a different source.
  const crossSourceCandidates = allExisting.filter(
    (e) => e.start_date === event.start_date && e.source_id !== sourceId
  );

  for (const existing of crossSourceCandidates) {
    const urlMatched =
      urlsMatch(event.website, existing.website) ||
      urlsMatch(event.website, existing.registration_link) ||
      urlsMatch(event.registration_url, existing.website) ||
      urlsMatch(event.registration_url, existing.registration_link);

    if (urlMatched || titlesMatch(event.title, existing.source_title || existing.title)) {
      return {
        action: 'skip',
        existing_event_id: existing.id,
        existing_event_table: existing.table,
      };
    }
  }

  return { action: 'new' };
}

// ── Source site ID resolution ─────────────────────────────────────────

/** Resolve a YAML config source ID (e.g. "icicle-creek") to the database UUID.
 *  Matches on source_sites.name (fuzzy) or url (contains).
 *  Returns the config ID as-is if no DB data available (dry-run mode).
 */
export function resolveSourceDbId(
  configId: string,
  configName: string,
  configUrl: string,
  sourceSites: { id: string; name: string; url: string }[]
): string | null {
  const isUuid = (value: string): boolean =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  // If configId is already a UUID, use it directly.
  if (isUuid(configId)) return configId;

  // Try exact name match first
  const byName = sourceSites.find((s) => s.name.toLowerCase() === configName.toLowerCase());
  if (byName) return byName.id;

  // Try URL match
  const byUrl = sourceSites.find(
    (s) => s.url === configUrl || configUrl.includes(s.url) || s.url.includes(configUrl)
  );
  if (byUrl) return byUrl.id;

  // Fuzzy name match
  let bestId: string | null = null;
  let bestScore = 0;
  for (const s of sourceSites) {
    const score = similarity(configName, s.name);
    if (score > bestScore) {
      bestScore = score;
      bestId = s.id;
    }
  }
  if (bestScore >= MATCH_THRESHOLD && bestId) return bestId;

  // No match — return null so writes can proceed without a source FK.
  return null;
}

// ── Main matching pipeline ───────────────────────────────────────────

/** Process a batch of scraped events through matching and dedup.
 *  Can work without DB (ref = null) for dry-run mode — uses source defaults only.
 */
export function matchEvents(
  events: ScrapedEvent[],
  source: SourceConfig,
  ref: ReferenceData | null,
  tagKeywords: Record<string, string[]>,
  venueTags: VenueTagRule[],
  verbose: boolean
): ProcessedEvent[] {
  const tagRegexes = buildTagRegexes(tagKeywords);
  const venuePatterns = buildVenuePatterns(venueTags);
  const processed: ProcessedEvent[] = [];

  // Resolve source config ID to database UUID
  const sourceDbId = ref
    ? resolveSourceDbId(source.id, source.name, source.url, ref.sourceSites)
    : source.id;

  for (const event of events) {
    // Location matching cascade: explicit map → DB fuzzy → source default → flag unknown
    let location_id: string | null = null;
    let location_added: string | null = null;

    // Apply explicit location_map from source config (e.g. "Bavarian Lodge" → "Ski Hill Lodge")
    let locationName = resolveMappedName(event.location_name, source.location_map);
    if (!locationName && ref) {
      locationName = inferLocationNameFromEventText(event, ref.locations);
    }

    if (ref) {
      location_id = matchLocation(locationName, ref.locations);
    }
    const hasInstanceSpecificLink =
      !!event.registration_url && event.registration_url.includes('#/instances/');

    // Only fall back to source default when the scrape did not provide a specific venue.
    if (!location_id && !locationName && !hasInstanceSpecificLink && source.default_location && ref) {
      location_id = matchLocation(source.default_location, ref.locations);
    }
    if (!location_id) {
      location_added = locationName || (!hasInstanceSpecificLink ? source.default_location : null) || null;
    }

    // Organization matching cascade: DB fuzzy → source default → flag unknown
    let organization_id: string | null = null;
    let organization_added: string | null = null;

    const mappedOrganizationName = resolveMappedName(locationName, source.organization_map);

    if (mappedOrganizationName && ref) {
      organization_id = matchOrganization(mappedOrganizationName, ref.organizations);
    }
    if (!organization_id && source.default_organization && ref) {
      organization_id = matchOrganization(source.default_organization, ref.organizations);
    }
    if (!organization_id) {
      organization_added = mappedOrganizationName || source.default_organization || null;
    }

    // Tag matching: infer from content → venue default → source default → null
    let primary_tag_id: string | null = null;
    if (ref) {
      // Resolve location name for venue-based tag lookup
      const resolvedLocName = location_id
        ? ref.locations.find((l) => l.id === location_id)?.name || null
        : locationName;
      primary_tag_id = inferTag(event, ref.tags, tagRegexes, venuePatterns, resolvedLocName);
      if (!primary_tag_id && source.default_tag) {
        primary_tag_id = matchTag(source.default_tag, ref.tags);
      }
    }

    // Dedup
    let dedupResult: DedupResult = { action: 'new' };
    if (ref) {
      dedupResult = dedup(event, sourceDbId, ref.existingEvents, ref.existingStaged);
    }

    // CANCELED events: only keep if updating an existing event
    const isCanceled = /\bcanceled\b/i.test(event.title);
    if (isCanceled && dedupResult.action === 'new') {
      if (verbose) console.log(`    SKIP "${event.title}" (canceled, not already on site)`);
      dedupResult = { action: 'skip' };
    } else if (isCanceled && dedupResult.existing_event_id) {
      dedupResult = {
        action: 'update',
        existing_event_id: dedupResult.existing_event_id,
        existing_event_table: dedupResult.existing_event_table,
        update_reason: 'event canceled',
      };
    }

    if (verbose && dedupResult.action !== 'new' && !isCanceled) {
      const reason = dedupResult.update_reason || 'no changes';
      console.log(`    DEDUP "${event.title}" → ${dedupResult.action} (${reason})`);
    }

    processed.push({
      scraped: event,
      action: dedupResult.action,
      update_reason: dedupResult.update_reason,
      location_id,
      location_added,
      organization_id,
      organization_added,
      primary_tag_id,
      parent_event_id: null, // series detection is a future enhancement
      series_key: event.series_key || null,
      series_parent_title: event.series_parent_title || null,
      series_parent_website: event.series_parent_website || null,
      source_id: sourceDbId,
      existing_event_id: dedupResult.existing_event_id,
      existing_event_table: dedupResult.existing_event_table,
    });
  }

  return processed;
}
