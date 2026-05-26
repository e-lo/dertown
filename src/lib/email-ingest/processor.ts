import { supabaseAdmin } from '@/lib/supabase';
import { isSuperAdminEmail } from './sender-auth';
import { parseIntent } from './command-parser';
import { extractBody } from './content-extractor';
import { screenEvent } from './screener';
import { parseEventsFromEmail } from './ai-parser';
import { checkDuplicate } from './dedup';
import { scrapeUrlForEmail } from './scrape-url';
import { matchEvents, loadReferenceData } from '../scraper/match';
import { loadConfig } from '../scraper/config';
import type { CloudMailinPayload, ProcessResult } from './types';
import type { SourceConfig, VenueTagRule } from '../scraper/types';

export async function processInboundEmail(payload: CloudMailinPayload): Promise<ProcessResult> {
  const senderEmail = payload.envelope.from;

  // Step 1: Validate sender is a super_admin
  const isAuthorized = await isSuperAdminEmail(senderEmail);
  if (!isAuthorized) return { status: 'rejected_sender' };

  // Step 2: Detect intent
  const intent = parseIntent(payload);

  // Step 3: Branch by intent

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
        comments: `Received via email ingest from ${senderEmail} on ${today}`,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create staged announcement: ${error.message}`);
    return { status: 'announcement_created', id: data.id };
  }

  // intent.type === 'event'
  const cleanBody = extractBody(intent.body);

  // Step 4: AI extraction
  const events = await parseEventsFromEmail(cleanBody);
  if (events.length === 0) {
    throw new Error('No events could be extracted from the email');
  }

  // Use the first (most prominent) extracted event
  const event = events[0];

  // Load config once — used for screening and matching (graceful fallback if file unavailable)
  let globalExclude = null;
  let tagKeywords: Record<string, string[]> = {};
  let venueTags: VenueTagRule[] = [];
  try {
    const config = loadConfig();
    globalExclude = config.globalExclude;
    tagKeywords = config.tagKeywords;
    venueTags = config.venueTags;
  } catch {
    // scrape/sources.yaml unavailable — screening and tag matching will be skipped
  }

  // Step 5: Screen against global exclusion rules
  const screen = screenEvent(event, globalExclude);
  if (!screen.pass) return { status: 'screened_out', reason: screen.reason! };

  // Step 6: Check for duplicates
  const duplicateHint = await checkDuplicate(event);

  // Step 7: Match event against locations/orgs/tags and write to events_staged
  const ref = await loadReferenceData(supabaseAdmin).catch(() => null);

  const syntheticSource: SourceConfig = {
    id: 'email-ingest',
    name: 'Email Ingest',
    url: `mailto:${senderEmail}`,
    type: 'html',
    default_organization: null,
    default_location: null,
    default_tag: null,
  };

  const processed = matchEvents([event], syntheticSource, ref, tagKeywords, venueTags, false);
  if (processed.length === 0) throw new Error('Event matching returned no results');

  const ev = processed[0];
  const today = new Date().toISOString().split('T')[0];
  const notes = [`Received via email ingest from ${senderEmail} on ${today}`];
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

  if (error) throw new Error(`Failed to create staged event: ${error.message}`);

  return {
    status: 'event_staged',
    id: row.id,
    ...(duplicateHint
      ? { duplicateHint: { id: duplicateHint.id, title: duplicateHint.title, match_level: duplicateHint.match_level } }
      : {}),
  };
}
