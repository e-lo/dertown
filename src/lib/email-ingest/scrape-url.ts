import { supabaseAdmin } from '@/lib/supabase';
import { fetchPage } from '../scraper/fetch';
import { extractEventsWithAI } from '../scraper/parse-ai';
import { normalizeEvent, isPastEvent } from '../scraper/normalize';
import { clampDescription } from '../scraper/description';
import { matchEvents, loadReferenceData } from '../scraper/match';
import { writeProcessedEvents } from '../scraper/staged';
import { loadConfig } from '../scraper/config';
import type { SourceConfig, ScrapedEvent } from '../scraper/types';

export async function scrapeUrlForEmail(url: string): Promise<number> {
  const config = loadConfig();

  // Fetch and AI-extract events from the URL
  const html = await fetchPage(url);
  const rawEvents = await extractEventsWithAI(html, url, config.descriptionMaxChars, false);

  // Normalize and filter past events
  const events: ScrapedEvent[] = [];
  for (const raw of rawEvents) {
    const ev = normalizeEvent(raw);
    ev.description = clampDescription(ev.description, config.descriptionMaxChars);
    if (!isPastEvent(ev)) events.push(ev);
  }

  if (events.length === 0) return 0;

  // Build a synthetic source config (no per-source exclusion rules for email-ingest)
  const syntheticSource: SourceConfig = {
    id: 'email-ingest',
    name: 'Email Ingest',
    url,
    type: 'html',
    default_organization: null,
    default_location: null,
    default_tag: null,
  };

  // Match events against locations, orgs, tags in DB
  const ref = await loadReferenceData(supabaseAdmin).catch(() => null);
  const processed = matchEvents(
    events,
    syntheticSource,
    ref,
    config.tagKeywords,
    config.venueTags,
    false
  );

  // Write to events_staged
  const { inserted } = await writeProcessedEvents(supabaseAdmin, processed, syntheticSource, false);
  return inserted;
}
