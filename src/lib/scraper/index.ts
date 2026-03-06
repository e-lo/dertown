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
 *   make scrape --url <url>        # paste a URL for AI extraction (future)
 */

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
import { shouldExclude, passesGeoFilter } from './filter';
import { matchEvents, loadReferenceData, type ReferenceData } from './match';
import { writeProcessedEvents } from './staged';
import type { SourceConfig, ScrapeResult, ScrapedEvent, VenueTagRule } from './types';

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
  forceUpdateOnPending: boolean;
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
    forceUpdateOnPending: false,
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
      case '--force-update-on-pending':
        args.forceUpdateOnPending = true;
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
  forceUpdateOnPending: boolean,
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
      { forceUpdateOnPending },
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
    console.log('  --force-update-on-pending  Force-update matched pending staged events');
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
    // URL/instagram/facebook paste — Phase 5
    console.log('URL paste mode is not yet implemented (Phase 5).');
    process.exit(0);
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

  // Scrape each source
  const results: ScrapeResult[] = [];
  for (const source of sourcesToScrape) {
    const result = await scrapeSource(
      source,
      ref,
      config.tagKeywords,
      config.venueTags,
      config.descriptionMaxChars,
      args.forceUpdateOnPending,
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
