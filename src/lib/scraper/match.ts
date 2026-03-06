import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import type { ScrapedEvent, ProcessedEvent, SourceConfig, VenueTagRule } from './types';

// ── String similarity ────────────────────────────────────────────────

/** Normalize a string for comparison: lowercase, collapse whitespace, strip common suffixes. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^\w\s'&-]/g, '') // keep letters, numbers, spaces, apostrophes, ampersands, hyphens
    .replace(/\b(the|center|centre|for|of|and|at|in)\b/g, '') // strip common words
    .replace(/\s+/g, ' ')
    .trim();
}

/** Simple Levenshtein distance between two strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Similarity score 0-1 based on Levenshtein distance. */
function similarity(a: string, b: string): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

const MATCH_THRESHOLD = 0.75;

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
  title: string;
  source_title: string | null;
  source_id: string | null;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
  cost: string | null;
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
export async function loadReferenceData(
  db: SupabaseClient<Database>
): Promise<ReferenceData> {
  const [locRes, orgRes, tagRes, srcRes, evtRes, stagedRes] = await Promise.all([
    db.from('locations').select('id, name, address'),
    db.from('organizations').select('id, name'),
    db.from('tags').select('id, name'),
    db.from('source_sites').select('id, name, url'),
    db.from('events').select('id, title, source_title, source_id, start_date, start_time, end_time, description, cost, registration_link, location_id'),
    db.from('events_staged').select('id, title, source_title, source_id, start_date, start_time, end_time, description, cost, registration_link, location_id'),
  ]);

  return {
    locations: (locRes.data || []) as LocationRow[],
    organizations: (orgRes.data || []) as OrgRow[],
    tags: (tagRes.data || []) as TagRow[],
    sourceSites: (srcRes.data || []) as SourceSiteRow[],
    existingEvents: (evtRes.data || []) as ExistingEvent[],
    existingStaged: (stagedRes.data || []) as ExistingEvent[],
  };
}

// ── Matching functions ───────────────────────────────────────────────

/** Compute a match score between a scraped name and a DB name, using multiple strategies. */
function nameMatchScore(scraped: string, dbName: string): number {
  const nScraped = norm(scraped);
  const nDb = norm(dbName);

  // Strategy 1: Levenshtein similarity
  let score = similarity(scraped, dbName);

  // Strategy 2: Substring containment (e.g. "Leavenworth Ski Hill" contains "Ski Hill")
  // Require shorter string to have ≥2 words to avoid false positives from bare city names
  const shorter = nScraped.length <= nDb.length ? nScraped : nDb;
  if (shorter.includes(' ') && shorter.length > 5) {
    if (nScraped.includes(nDb) || nDb.includes(nScraped)) {
      score = Math.max(score, 0.85);
    }
  }

  // Strategy 3: Word overlap — handles missing/extra words
  // (e.g. "Leavenworth Library" vs "Leavenworth Public Library")
  const wordsScraped = new Set(nScraped.split(/\s+/).filter((w) => w.length > 1));
  const wordsDb = new Set(nDb.split(/\s+/).filter((w) => w.length > 1));
  if (wordsScraped.size >= 2 && wordsDb.size >= 2) {
    const smaller = wordsScraped.size <= wordsDb.size ? wordsScraped : wordsDb;
    const larger = wordsScraped.size <= wordsDb.size ? wordsDb : wordsScraped;
    let overlap = 0;
    for (const w of smaller) {
      if (larger.has(w)) overlap++;
    }
    const ratio = overlap / smaller.size;
    if (ratio >= 0.8) {
      score = Math.max(score, 0.75 + ratio * 0.1);
    }
  }

  return score;
}

/** Find the best matching location by name. Returns the location ID or null. */
export function matchLocation(
  name: string | null,
  locations: LocationRow[]
): string | null {
  if (!name) return null;

  let bestId: string | null = null;
  let bestScore = 0;

  for (const loc of locations) {
    const score = nameMatchScore(name, loc.name);
    if (score > bestScore) {
      bestScore = score;
      bestId = loc.id;
    }
    // Also try matching against address if available
    if (loc.address) {
      const addrScore = similarity(name, loc.address) * 0.8; // weight address matches lower
      if (addrScore > bestScore) {
        bestScore = addrScore;
        bestId = loc.id;
      }
    }
  }

  return bestScore >= MATCH_THRESHOLD ? bestId : null;
}

/** Find the best matching organization by name. Returns the org ID or null. */
export function matchOrganization(
  name: string | null,
  organizations: OrgRow[]
): string | null {
  if (!name) return null;

  let bestId: string | null = null;
  let bestScore = 0;

  for (const org of organizations) {
    const score = nameMatchScore(name, org.name);
    if (score > bestScore) {
      bestScore = score;
      bestId = org.id;
    }
  }

  return bestScore >= MATCH_THRESHOLD ? bestId : null;
}

/** Normalize a tag name for comparison: lowercase, strip non-alphanumeric. */
function normTag(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Find a tag ID by name (normalized match — "arts-culture" matches "Arts+Culture"). */
export function matchTag(
  tagName: string | null,
  tags: TagRow[]
): string | null {
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
  update_reason?: string;
}

/** Normalize a title for dedup comparison. */
function normTitle(title: string): string {
  return title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

/** Significant words from a title (lowercase, stripped of noise). */
function titleWords(title: string): Set<string> {
  const stop = new Set(['the', 'a', 'an', 'and', 'at', 'in', 'of', 'for', 'to', 'by', '-', '&']);
  return new Set(
    normTitle(title).split(/\s+/).filter((w) => w.length > 1 && !stop.has(w))
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
  sourceId: string,
  existingEvents: ExistingEvent[],
  existingStaged: ExistingEvent[]
): DedupResult {
  const allExisting = [...existingEvents, ...existingStaged];

  // Pass 1: Same source + same date (can detect updates)
  const sameSourceCandidates = allExisting.filter(
    (e) => e.source_id === sourceId && e.start_date === event.start_date
  );

  for (const existing of sameSourceCandidates) {
    if (titlesMatch(event.title, existing.source_title || existing.title)) {
      // Found a same-source match — check if anything changed
      const changes: string[] = [];

      if (event.start_time && existing.start_time && event.start_time !== existing.start_time) {
        changes.push(`time changed ${existing.start_time}→${event.start_time}`);
      }
      if (event.cost && existing.cost && event.cost !== existing.cost) {
        changes.push(`cost changed ${existing.cost}→${event.cost}`);
      }

      if (changes.length === 0) {
        return { action: 'skip', existing_event_id: existing.id };
      }

      return {
        action: 'update',
        existing_event_id: existing.id,
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
    if (titlesMatch(event.title, existing.source_title || existing.title)) {
      return { action: 'skip', existing_event_id: existing.id };
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
): string {
  // Try exact name match first
  const byName = sourceSites.find(
    (s) => s.name.toLowerCase() === configName.toLowerCase()
  );
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

  // No match — return config ID (will fail FK constraint if written to DB)
  return configId;
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
    let locationName = event.location_name;
    if (locationName && source.location_map) {
      const mapped = Object.entries(source.location_map).find(
        ([key]) => key.toLowerCase() === locationName!.toLowerCase()
      );
      if (mapped) locationName = mapped[1];
    }

    if (ref) {
      location_id = matchLocation(locationName, ref.locations);
    }
    if (!location_id && source.default_location && ref) {
      location_id = matchLocation(source.default_location, ref.locations);
    }
    if (!location_id) {
      location_added = locationName || source.default_location || null;
    }

    // Organization matching cascade: DB fuzzy → source default → flag unknown
    let organization_id: string | null = null;
    let organization_added: string | null = null;

    if (source.default_organization && ref) {
      organization_id = matchOrganization(source.default_organization, ref.organizations);
    }
    if (!organization_id) {
      organization_added = source.default_organization || null;
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
      source_id: sourceDbId,
      existing_event_id: dedupResult.existing_event_id,
    });
  }

  return processed;
}
