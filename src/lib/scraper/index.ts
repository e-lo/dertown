#!/usr/bin/env node
/**
 * Der Town Event Scraper — CLI entry point.
 *
 * Usage (via Makefile):
 *   make scrape --all              # dry run all sources (default)
 *   make scrape --source <id>      # dry run one source
 *   make scrape --all --remote     # write to production DB
 *   make scrape --all --local-db   # write to local Supabase
 *   make scrape --all --verbose    # show per-event detail
 *   make scrape --url <url>        # paste a URL for AI extraction
 */

import * as readline from 'readline';
import { loadConfig, getSourceConfig } from './config';
import { createWriteClient, createReadClient, type DbMode } from './db';
import { fetchPage } from './fetch';
import { writeScrapeLog } from './log';
import { parseIcalFeed } from './parse-ical';
import { parseHtml } from './parse-html';
import { fetchLibCalEvents } from './parse-json';
import { clampDescription } from './description';
import { enrichDescriptionsFromDetailPages } from './enrich';
import { normalizeEvent, isPastEvent } from './normalize';
import { extractEventsWithAI } from './parse-ai';
import { shouldExclude, passesGeoFilter } from './filter';
import {
  matchEvents,
  loadReferenceData,
  matchLocation,
  matchOrganization,
  matchTag,
  type ReferenceData,
} from './match';
import { writeProcessedEvents } from './staged';
import type { SourceConfig, ScrapeResult, ScrapedEvent, ProcessedEvent, VenueTagRule } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

// ── CLI argument parsing ─────────────────────────────────────────────

interface CliArgs {
  all: boolean;
  source: string | null;
  url: string | null;
  instagram: string | null;
  facebook: string | null;
  remote: boolean;
  localDb: boolean;
  verbose: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    all: false,
    source: null,
    url: null,
    instagram: null,
    facebook: null,
    remote: false,
    localDb: false,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--all':
        args.all = true;
        break;
      case '--source':
        args.source = argv[++i] || null;
        break;
      case '--url':
        args.url = argv[++i] || null;
        break;
      case '--instagram':
        args.instagram = argv[++i] || null;
        break;
      case '--facebook':
        args.facebook = argv[++i] || null;
        break;
      case '--remote':
        args.remote = true;
        break;
      case '--local-db':
        args.localDb = true;
        break;
      case '--verbose':
        args.verbose = true;
        break;
      default:
        if (argv[i].startsWith('--')) {
          console.error(`Unknown flag: ${argv[i]}`);
          process.exit(1);
        }
    }
  }

  return args;
}

function resolveDbMode(args: CliArgs): DbMode {
  if (args.remote && args.localDb) {
    console.error('Cannot use both --remote and --local-db');
    process.exit(1);
  }
  if (args.remote) return 'remote';
  if (args.localDb) return 'local-db';
  return 'dry-run';
}

// ── Source scraping pipeline ──────────────────────────────────────────

async function scrapeSource(
  source: SourceConfig,
  ref: ReferenceData | null,
  tagKeywords: Record<string, string[]>,
  venueTags: VenueTagRule[],
  descriptionMaxChars: number,
  verbose: boolean
): Promise<ScrapeResult> {
  const result: ScrapeResult = {
    source_id: source.id,
    source_name: source.name,
    total_extracted: 0,
    filtered_geo: 0,
    filtered_excluded: 0,
    new_count: 0,
    updated_count: 0,
    skipped_count: 0,
    errors: [],
    events: [],
  };

  try {
    // Step 1-2: Fetch and Parse
    let rawEvents: ScrapedEvent[];
    if (source.type === 'json-api') {
      // JSON API sources handle their own fetching (e.g. multi-day pagination)
      if (verbose) console.log(`  Fetching ${source.name} via JSON API...`);
      rawEvents = await fetchLibCalEvents(source, verbose);
    } else {
      const pageUrl = source.ical_url || source.url;
      if (verbose) console.log(`  Fetching ${pageUrl}...`);
      const content = await fetchPage(pageUrl);
      if (verbose) console.log(`  Fetched ${content.length} bytes`);

      if (source.type === 'ical' && source.ical_url) {
        rawEvents = parseIcalFeed(content);
      } else if (source.type === 'html') {
        rawEvents = parseHtml(content, source);
        // If the source defines a monthly URL pattern, also fetch future months
        if (source.month_url_pattern) {
          const monthsAhead = source.months_ahead ?? 3;
          const now = new Date();
          const seenTitlesAndDates = new Set(rawEvents.map((e) => `${e.title}|${e.start_date}`));
          for (let i = 1; i <= monthsAhead; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const monthUrl = source.month_url_pattern
              .replace('{year}', String(year))
              .replace('{month}', String(month));
            if (verbose) console.log(`  Fetching month page ${monthUrl}...`);
            try {
              const monthContent = await fetchPage(monthUrl);
              const monthEvents = parseHtml(monthContent, source);
              for (const ev of monthEvents) {
                const key = `${ev.title}|${ev.start_date}`;
                if (!seenTitlesAndDates.has(key)) {
                  seenTitlesAndDates.add(key);
                  rawEvents.push(ev);
                }
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              if (verbose) console.log(`  WARN: failed to fetch ${monthUrl}: ${msg}`);
            }
          }
        }
      } else {
        if (verbose) console.log(`  No extractor for type "${source.type}". Skipping parse.`);
        return result;
      }
    }

    if (source.type === 'html' && source.detail_description_selectors?.length) {
      rawEvents = await enrichDescriptionsFromDetailPages(rawEvents, source, verbose);
    }

    if (verbose) console.log(`  Parsed ${rawEvents.length} raw events`);

    // Step 3: Normalize and filter
    const events: ScrapedEvent[] = [];
    for (const raw of rawEvents) {
      const event = normalizeEvent(raw);
      event.description = clampDescription(event.description, descriptionMaxChars);

      // Skip past events
      if (isPastEvent(event)) continue;

      // Geo filter
      if (!passesGeoFilter(event, source.geo_filter, verbose)) {
        result.filtered_geo++;
        continue;
      }

      // Exclusion filter
      if (shouldExclude(event, source.exclude, verbose)) {
        result.filtered_excluded++;
        continue;
      }

      events.push(event);
    }

    result.total_extracted = events.length;

    // Steps 4-5: Match to existing records and deduplicate
    const processed = matchEvents(
      events,
      source,
      ref,
      tagKeywords,
      venueTags,
      verbose
    );
    result.events = processed;

    // Update source_id to the resolved DB UUID (for log writing)
    if (processed.length > 0) {
      result.source_id = processed[0].source_id;
    }

    for (const ev of processed) {
      switch (ev.action) {
        case 'new':
          result.new_count++;
          break;
        case 'update':
          result.updated_count++;
          break;
        case 'skip':
          result.skipped_count++;
          break;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
  }

  return result;
}

// ── Output formatting ────────────────────────────────────────────────

function printResultSummary(result: ScrapeResult, mode: DbMode): void {
  const prefix = mode === 'dry-run' ? '[DRY RUN] ' : '';
  const parts: string[] = [];

  if (result.total_extracted > 0) parts.push(`${result.total_extracted} events found`);
  if (result.filtered_geo > 0) parts.push(`${result.filtered_geo} filtered (geo)`);
  if (result.filtered_excluded > 0) parts.push(`${result.filtered_excluded} excluded (keywords)`);
  if (result.new_count > 0) parts.push(`${result.new_count} new`);
  if (result.updated_count > 0) parts.push(`${result.updated_count} updated`);
  if (result.skipped_count > 0) parts.push(`${result.skipped_count} skipped`);
  if (result.errors.length > 0) parts.push(`${result.errors.length} error(s)`);

  // If nothing extracted yet (stub phase), say so
  if (parts.length === 0) parts.push('fetch OK, no extractor yet');

  console.log(`${prefix}${result.source_name}: ${parts.join(', ')}`);

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.log(`  ERROR: ${err}`);
    }
  }
}

function printVerboseEvents(result: ScrapeResult, ref: ReferenceData | null): void {
  // Build reverse lookup maps for readable output
  const tagNames = new Map(ref?.tags.map((t) => [t.id, t.name]) || []);
  const locNames = new Map(ref?.locations.map((l) => [l.id, l.name]) || []);
  const orgNames = new Map(ref?.organizations.map((o) => [o.id, o.name]) || []);

  for (const ev of result.events) {
    const tag = ev.primary_tag_id ? tagNames.get(ev.primary_tag_id) || ev.primary_tag_id : '?';
    const loc = ev.location_id
      ? locNames.get(ev.location_id) || ev.location_id
      : ev.location_added || '?';
    const org = ev.organization_id
      ? orgNames.get(ev.organization_id) || ev.organization_id
      : ev.organization_added || '?';
    const date = ev.scraped.start_date;
    const time = ev.scraped.start_time || '';
    switch (ev.action) {
      case 'new':
        console.log(`  NEW  "${ev.scraped.title}" ${date} ${time}`);
        console.log(`       tag=${tag}  loc=${loc}  org=${org}`);
        break;
      case 'update':
        console.log(`  UPDATE "${ev.scraped.title}" — ${ev.update_reason}`);
        break;
      case 'skip':
        break;
    }
  }
}

function printFinalSummary(results: ScrapeResult[], mode: DbMode): void {
  const totalNew = results.reduce((s, r) => s + r.new_count, 0);
  const totalUpdated = results.reduce((s, r) => s + r.updated_count, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);

  console.log('');
  if (mode === 'dry-run') {
    if (totalNew > 0 || totalUpdated > 0) {
      console.log(
        `[DRY RUN] ${totalNew} would be staged, ${totalUpdated} would be auto-updated. Use --remote to write.`
      );
    } else {
      console.log('[DRY RUN] No database changes would be made.');
    }
  } else {
    const dbLabel = mode === 'local-db' ? '(local DB)' : '';
    if (totalNew > 0 || totalUpdated > 0) {
      console.log(
        `Done ${dbLabel}. ${totalNew} new staged events, ${totalUpdated} auto-updated. Review at /admin`
      );
    } else {
      console.log(`Done ${dbLabel}. No new events.`);
    }
  }

  if (totalErrors > 0) {
    console.log(`${totalErrors} error(s) occurred. Run with --verbose for details.`);
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function ensureSourceSitesExist(
  writeDb: SupabaseClient<Database>,
  sources: SourceConfig[],
  ref: ReferenceData | null,
  verbose: boolean
): Promise<void> {
  for (const source of sources) {
    if (isUuid(source.id)) continue;

    const existing =
      ref?.sourceSites.find((s) => s.name.toLowerCase() === source.name.toLowerCase()) ||
      ref?.sourceSites.find((s) => s.url === source.url);
    if (existing) continue;

    let found: { id: string; name: string; url: string } | null = null;

    const byName = await writeDb
      .from('source_sites')
      .select('id, name, url')
      .limit(1)
      .eq('name', source.name)
      .maybeSingle();
    if (byName.data) {
      found = byName.data;
    } else {
      const byUrl = await writeDb
        .from('source_sites')
        .select('id, name, url')
        .limit(1)
        .eq('url', source.url)
        .maybeSingle();
      if (byUrl.data) found = byUrl.data;
    }

    if (found) {
      if (ref) ref.sourceSites.push(found);
      continue;
    }

    const { data: created, error } = await writeDb
      .from('source_sites')
      .insert({ name: source.name, url: source.url })
      .select('id, name, url')
      .single();

    if (error) {
      if (verbose) {
        console.log(
          `  WARN: failed to auto-create source_sites row for "${source.name}": ${error.message}`
        );
      }
      continue;
    }

    if (created && ref) ref.sourceSites.push(created);
    if (verbose && created) {
      console.log(`  Created source_sites row for "${source.name}" (${created.id})`);
    }
  }
}

// ── Interactive CLI prompts ───────────────────────────────────────────

function createPromptInterface(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

/**
 * After matching, show the auto-resolved org/location/tag and let the user
 * confirm or override each one. Applies the choice to all new events in the batch.
 */
async function promptForMissingFields(
  processed: ProcessedEvent[],
  ref: ReferenceData | null
): Promise<void> {
  const newEvents = processed.filter((ev) => ev.action === 'new');
  if (newEvents.length === 0) return;

  // Resolve current values for display
  const sample = newEvents[0];
  const currentOrg = sample.organization_id
    ? ref?.organizations.find((o) => o.id === sample.organization_id)?.name || null
    : sample.organization_added || null;
  const currentLoc = sample.location_id
    ? ref?.locations.find((l) => l.id === sample.location_id)?.name || null
    : sample.location_added || null;
  const currentTag = sample.primary_tag_id
    ? ref?.tags.find((t) => t.id === sample.primary_tag_id)?.name || null
    : null;

  console.log('\n--- Confirm fields for all events (press Enter to keep current) ---');

  const rl = createPromptInterface();

  try {
    // Organization
    const orgPrompt = currentOrg
      ? `Organization [${currentOrg}]: `
      : 'Organization: ';
    const orgInput = await ask(rl, orgPrompt);
    if (orgInput) {
      const orgId = ref ? matchOrganization(orgInput, ref.organizations) : null;
      for (const ev of newEvents) {
        if (orgId) {
          ev.organization_id = orgId;
          ev.organization_added = null;
        } else {
          ev.organization_id = null;
          ev.organization_added = orgInput;
        }
      }
      if (orgId) {
        const orgName = ref?.organizations.find((o) => o.id === orgId)?.name;
        console.log(`  → Matched: "${orgName}"`);
      } else {
        console.log(`  → Will add as new: "${orgInput}"`);
      }
    }

    // Location
    const locPrompt = currentLoc
      ? `Location [${currentLoc}]: `
      : 'Location: ';
    const locInput = await ask(rl, locPrompt);
    if (locInput) {
      const locId = ref ? matchLocation(locInput, ref.locations) : null;
      for (const ev of newEvents) {
        if (locId) {
          ev.location_id = locId;
          ev.location_added = null;
        } else {
          ev.location_id = null;
          ev.location_added = locInput;
        }
      }
      if (locId) {
        const locName = ref?.locations.find((l) => l.id === locId)?.name;
        console.log(`  → Matched: "${locName}"`);
      } else {
        console.log(`  → Will add as new: "${locInput}"`);
      }
    }

    // Tag
    const tagList = ref?.tags.map((t) => t.name).join(', ') || '';
    if (tagList) console.log(`  Tags: ${tagList}`);
    const tagPrompt = currentTag
      ? `Tag [${currentTag}]: `
      : 'Tag: ';
    const tagInput = await ask(rl, tagPrompt);
    if (tagInput) {
      const tagId = ref ? matchTag(tagInput, ref.tags) : null;
      if (tagId) {
        for (const ev of newEvents) {
          ev.primary_tag_id = tagId;
        }
        const tagName = ref?.tags.find((t) => t.id === tagId)?.name;
        console.log(`  → Matched: "${tagName}"`);
      } else {
        console.log(`  → Tag "${tagInput}" not found in database, keeping current`);
      }
    }

    console.log('');
  } finally {
    rl.close();
  }
}

// ── URL paste handler ─────────────────────────────────────────────────

async function handleUrlPaste(
  pasteUrl: string,
  mode: DbMode,
  writeDb: SupabaseClient<Database> | null,
  config: ReturnType<typeof loadConfig>,
  verbose: boolean
): Promise<void> {
  if (mode === 'dry-run') {
    console.log('[DRY RUN] No database writes will be made.\n');
  } else {
    const label = mode === 'remote' ? 'REMOTE (production)' : 'LOCAL';
    console.log(`Writing to ${label} database.\n`);
  }

  console.log(`Extracting events from: ${pasteUrl}\n`);

  // Load reference data for matching/dedup
  let ref: ReferenceData | null = null;
  const readDb = writeDb || createReadClient();
  if (readDb) {
    if (verbose) console.log('Loading reference data for matching...');
    try {
      ref = await loadReferenceData(readDb);
      if (verbose) {
        console.log(
          `  ${ref.locations.length} locations, ${ref.organizations.length} orgs, ${ref.tags.length} tags`
        );
        console.log(
          `  ${ref.existingEvents.length} existing events, ${ref.existingStaged.length} staged events\n`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  WARNING: Could not load reference data: ${msg}`);
      console.log('  Dedup and matching will be skipped.\n');
    }
  } else {
    console.log('  No database credentials found. Dedup and matching will be skipped.\n');
  }

  // Step 1: Fetch the page
  if (verbose) console.log(`  Fetching ${pasteUrl}...`);
  const html = await fetchPage(pasteUrl);
  if (verbose) console.log(`  Fetched ${html.length} bytes`);

  // Step 2: AI extraction
  const rawEvents = await extractEventsWithAI(html, pasteUrl, config.descriptionMaxChars, verbose);

  // Step 3: Normalize and filter past events
  const events: ScrapedEvent[] = [];
  for (const raw of rawEvents) {
    const event = normalizeEvent(raw);
    event.description = clampDescription(event.description, config.descriptionMaxChars);
    if (isPastEvent(event)) continue;
    events.push(event);
  }

  if (verbose) console.log(`  ${events.length} events after filtering past dates`);

  if (events.length === 0) {
    console.log('No upcoming events found on this page.');
    return;
  }

  // Step 4: Build a synthetic source config for matching
  const syntheticSource: SourceConfig = {
    id: 'url-paste',
    name: 'URL Paste',
    url: pasteUrl,
    type: 'html',
    default_organization: null,
    default_location: null,
    default_tag: null,
  };

  // Step 5: Run matching pipeline
  const processed = matchEvents(
    events,
    syntheticSource,
    ref,
    config.tagKeywords,
    config.venueTags,
    verbose
  );

  // Step 5b: Prompt user for any unresolved org/location/tag
  await promptForMissingFields(processed, ref);

  // Build result summary
  const result: ScrapeResult = {
    source_id: null,
    source_name: `URL Paste (${pasteUrl})`,
    total_extracted: events.length,
    filtered_geo: 0,
    filtered_excluded: 0,
    new_count: 0,
    updated_count: 0,
    skipped_count: 0,
    errors: [],
    events: processed,
  };

  for (const ev of processed) {
    switch (ev.action) {
      case 'new':
        result.new_count++;
        break;
      case 'update':
        result.updated_count++;
        break;
      case 'skip':
        result.skipped_count++;
        break;
    }
  }

  // Report series detection
  const seriesKeys = new Set(processed.filter((ev) => ev.series_key).map((ev) => ev.series_key));
  if (seriesKeys.size > 0) {
    for (const key of seriesKeys) {
      const group = processed.filter((ev) => ev.series_key === key);
      const parentTitle = group[0].series_parent_title || group[0].scraped.title;
      console.log(`  Series detected: "${parentTitle}" (${group.length} instances)`);
    }
    if (mode === 'dry-run') {
      console.log('  Series parent(s) would be auto-created with --remote');
    }
  }

  printResultSummary(result, mode);
  if (verbose) printVerboseEvents(result, ref);

  // Step 6: Write to database if not dry-run
  if (writeDb) {
    const writeResult = await writeProcessedEvents(writeDb, processed, syntheticSource, verbose);
    if (writeResult.errors.length > 0) {
      result.errors.push(...writeResult.errors);
    }
    if (writeResult.series_rules_matched > 0 || writeResult.series_rules_unresolved > 0) {
      console.log(
        `  Series rules: ${writeResult.series_rules_linked}/${writeResult.series_rules_matched} linked` +
          (writeResult.series_rules_unresolved > 0
            ? ` (${writeResult.series_rules_unresolved} unmatched parent title)`
            : '')
      );
    }
  }

  printFinalSummary([result], mode);
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Validate: must specify at least one action
  if (!args.all && !args.source && !args.url && !args.instagram && !args.facebook) {
    console.log('Der Town Event Scraper');
    console.log('');
    console.log('Usage:');
    console.log('  make scrape --all                   Scrape all configured sources (dry run)');
    console.log('  make scrape --source <id>           Scrape one source (dry run)');
    console.log('  make scrape --url <url>             Extract events from any URL (AI)');
    console.log('  make scrape --instagram <url>       Extract from Instagram post (AI)');
    console.log('  make scrape --facebook <url>        Extract from Facebook event (AI)');
    console.log('');
    console.log('Flags:');
    console.log('  --remote      Write to production database (default is dry run)');
    console.log('  --local-db    Write to local Supabase instance');
    console.log('  --verbose     Show per-event extraction detail');
    process.exit(0);
  }

  const mode = resolveDbMode(args);
  const writeDb = createWriteClient(mode);
  const config = loadConfig();

  // Determine which sources to scrape
  let sourcesToScrape: SourceConfig[];
  if (args.all) {
    sourcesToScrape = config.sources;
  } else if (args.source) {
    sourcesToScrape = [getSourceConfig(config.sources, args.source)];
  } else {
    // URL/instagram/facebook paste — AI extraction
    const pasteUrl = args.url || args.instagram || args.facebook || '';
    await handleUrlPaste(pasteUrl, mode, writeDb, config, args.verbose);
    return;
  }

  if (mode === 'dry-run') {
    console.log('[DRY RUN] No database writes will be made.\n');
  } else {
    const label = mode === 'remote' ? 'REMOTE (production)' : 'LOCAL';
    console.log(`Writing to ${label} database.\n`);
  }

  // Always load reference data for matching/dedup — use write client if available,
  // otherwise create a read-only client to check against production data.
  let ref: ReferenceData | null = null;
  const readDb = writeDb || createReadClient();
  if (readDb) {
    if (args.verbose) console.log('Loading reference data for matching...');
    try {
      ref = await loadReferenceData(readDb);
      if (args.verbose) {
        console.log(
          `  ${ref.locations.length} locations, ${ref.organizations.length} orgs, ${ref.tags.length} tags`
        );
        console.log(
          `  ${ref.existingEvents.length} existing events, ${ref.existingStaged.length} staged events\n`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  WARNING: Could not load reference data: ${msg}`);
      console.log('  Dedup and matching will be skipped.\n');
    }
  } else {
    console.log('  No database credentials found. Dedup and matching will be skipped.\n');
  }

  if (writeDb && ref) {
    await ensureSourceSitesExist(writeDb, sourcesToScrape, ref, args.verbose);
  }

  // Scrape each source
  const results: ScrapeResult[] = [];
  for (const source of sourcesToScrape) {
    const result = await scrapeSource(
      source,
      ref,
      config.tagKeywords,
      config.venueTags,
      config.descriptionMaxChars,
      args.verbose
    );
    results.push(result);

    printResultSummary(result, mode);
    if (args.verbose) printVerboseEvents(result, ref);

    // Step 6: Write to database (only if write client available, i.e. not dry-run)
    if (writeDb) {
      const writeResult = await writeProcessedEvents(writeDb, result.events, source, args.verbose);
      if (writeResult.errors.length > 0) {
        result.errors.push(...writeResult.errors);
      }
      if (writeResult.series_rules_matched > 0 || writeResult.series_rules_unresolved > 0) {
        console.log(
          `  Series rules: ${writeResult.series_rules_linked}/${writeResult.series_rules_matched} linked` +
            (writeResult.series_rules_unresolved > 0
              ? ` (${writeResult.series_rules_unresolved} unmatched parent title)`
              : '')
        );
      }

      // Write scrape logs
      await writeScrapeLog(writeDb, result);
    }
  }

  printFinalSummary(results, mode);
}

main().catch((err) => {
  console.error('Fatal error:', err.message || err);
  process.exit(1);
});
