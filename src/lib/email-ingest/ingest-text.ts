/**
 * Core ingest logic — shared by email ingest and admin paste-import.
 * Accepts raw text (email body, pasted content, or URL) and stages
 * the result without any sender-auth checks.
 */
import { supabaseAdmin } from '@/lib/supabase';
import { parseIntent } from './command-parser';
import { extractBody } from './content-extractor';
import { screenEvent } from './screener';
import { parseEventsFromEmail } from './ai-parser';
import { checkDuplicate } from './dedup';
import { scrapeUrlForEmail } from './scrape-url';
import { matchEvents, loadReferenceData } from '../scraper/match';
import { loadConfig } from '../scraper/config';
import { normalizeEvent, isPastEvent } from '../scraper/normalize';
import { clampDescription } from '../scraper/description';
import type { MailgunPayload, ProcessResult } from './types';
import type { SourceConfig, VenueTagRule } from '../scraper/types';

export async function ingestText(text: string, sourceLabel = 'admin-paste'): Promise<ProcessResult> {
  // Reuse parseIntent by constructing a synthetic payload.
  // Subject is intentionally empty so announcement-subject detection doesn't fire;
  // URL detection and event extraction work off the body.
  const syntheticPayload: MailgunPayload = {
    sender: sourceLabel,
    recipient: '',
    from: sourceLabel,
    subject: '',
    'body-plain': text,
    timestamp: '',
    token: '',
    signature: '',
  };

  const intent = parseIntent(syntheticPayload);

  if (intent.type === 'scrape') {
    const count = await scrapeUrlForEmail(intent.url);
    return { status: 'scrape_queued', url: intent.url, count };
  }

  if (intent.type === 'announcement') {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabaseAdmin
      .from('announcements_staged')
      .insert({
        title: intent.title,
        message: extractBody(intent.body),
        status: 'pending',
        comments: `Imported via admin paste on ${today}`,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create staged announcement: ${error.message}`);
    return { status: 'announcement_created', id: data.id };
  }

  // intent.type === 'event'
  const cleanBody = extractBody(intent.body);
  const events = await parseEventsFromEmail(cleanBody);
  if (events.length === 0) {
    throw new Error('No events could be extracted from the text. Try adding more detail (date, time, location) or paste a URL instead.');
  }

  const event = events[0];
  const normalized = normalizeEvent(event);
  normalized.description = clampDescription(normalized.description, 2000);

  if (isPastEvent(normalized)) {
    throw new Error('The extracted event date is in the past.');
  }

  if (events.length > 1) {
    console.warn(`[ingest-text] Extracted ${events.length} events; using only the first`);
  }

  let globalExclude = null;
  let tagKeywords: Record<string, string[]> = {};
  let venueTags: VenueTagRule[] = [];
  try {
    const config = loadConfig();
    globalExclude = config.globalExclude;
    tagKeywords = config.tagKeywords;
    venueTags = config.venueTags;
  } catch {
    // sources.yaml unavailable — screening and tag matching skipped
  }

  const screen = screenEvent(normalized, globalExclude);
  if (!screen.pass) return { status: 'screened_out', reason: screen.reason };

  const duplicateHint = await checkDuplicate(normalized);

  const ref = await loadReferenceData(supabaseAdmin).catch(() => null);
  const syntheticSource: SourceConfig = {
    id: 'admin-paste',
    name: 'Admin Paste Import',
    url: '',
    type: 'html',
    default_organization: null,
    default_location: null,
    default_tag: null,
  };

  const processed = matchEvents([normalized], syntheticSource, ref, tagKeywords, venueTags, false);
  if (processed.length === 0) throw new Error('Event matching returned no results');

  const ev = processed[0];
  const today = new Date().toISOString().split('T')[0];
  const notes = [`Imported via admin paste on ${today}`];
  if (!ev.location_id && ev.location_added) notes.push(`Location not matched: "${ev.location_added}"`);
  if (!ev.organization_id && ev.organization_added) notes.push(`Organization not matched: "${ev.organization_added}"`);

  const { data: row, error } = await supabaseAdmin
    .from('events_staged')
    .insert({
      title: ev.scraped.title,
      source_title: ev.scraped.title,
      description: ev.scraped.description,
      start_date: ev.scraped.start_date,
      end_date: ev.scraped.end_date,
      start_time: ev.scraped.start_time,
      end_time: ev.scraped.end_time,
      cost: ev.scraped.cost,
      website: ev.scraped.website,
      registration_link: ev.scraped.registration_url,
      registration: ev.scraped.registration_required ?? false,
      external_image_url: ev.scraped.image_url,
      location_id: ev.location_id,
      location_added: ev.location_id ? null : ev.location_added,
      organization_id: ev.organization_id,
      organization_added: ev.organization_id ? null : ev.organization_added,
      primary_tag_id: ev.primary_tag_id,
      source_id: null,
      status: 'pending',
      submitted_at: new Date().toISOString(),
      comments: notes.join('\n'),
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to stage event: ${error.message}`);

  return {
    status: 'event_staged',
    id: row.id,
    ...(duplicateHint
      ? { duplicateHint: { id: duplicateHint.id, title: duplicateHint.title, match_level: duplicateHint.match_level } }
      : {}),
  };
}
