import * as cheerio from 'cheerio';
import { fetchPage } from './fetch';
import type { ScrapedEvent, SourceConfig } from './types';

/** Enrich HTML source events by fetching event detail pages and extracting fuller descriptions. */
export async function enrichDescriptionsFromDetailPages(
  events: ScrapedEvent[],
  source: SourceConfig,
  verbose: boolean
): Promise<ScrapedEvent[]> {
  let enrichedEvents = events;
  if (source.id === 'icicle-creek') {
    enrichedEvents = await expandIcicleSalesforceInstances(events, source, verbose);
  }

  const selectors = source.detail_description_selectors;
  if (!selectors || selectors.length === 0) return enrichedEvents;

  const detailHtmlCache = new Map<string, string>();

  for (const event of enrichedEvents) {
    const website = toAbsoluteUrl(event.website, source.url);
    if (!website) continue;
    event.website = website;

    // If current description already looks complete, skip detail-page fetch.
    if (
      event.description &&
      event.description.length >= 500 &&
      !looksTruncated(event.description)
    ) {
      continue;
    }

    try {
      let html = detailHtmlCache.get(website);
      if (!html) {
        html = await fetchPage(website);
        detailHtmlCache.set(website, html);
      }
      const detailDescription = extractDescriptionFromHtml(html, selectors);
      if (!detailDescription) continue;

      if (shouldReplaceDescription(event.description, detailDescription)) {
        event.description = detailDescription;
      }
    } catch (err) {
      if (verbose) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`    WARN: detail description fetch failed for "${event.title}": ${msg}`);
      }
    }
  }

  return enrichedEvents;
}

async function expandIcicleSalesforceInstances(
  events: ScrapedEvent[],
  source: SourceConfig,
  verbose: boolean
): Promise<ScrapedEvent[]> {
  const expanded: ScrapedEvent[] = [];

  for (const event of events) {
    const website = toAbsoluteUrl(event.website, source.url);
    if (!website) {
      expanded.push(event);
      continue;
    }

    event.website = website;

    if (!website.includes('salesforce-sites.com') || !website.includes('#/events/')) {
      expanded.push(event);
      continue;
    }

    try {
      const eventHtml = await fetchPage(website);
      const instanceUrls = extractSalesforceInstanceUrls(eventHtml, website);
      const canonicalEventUrl = canonicalSalesforceEventUrl(website);
      const seriesKey = buildSalesforceSeriesKey(website);

      if (instanceUrls.length === 0) {
        const details = extractSalesforceInstanceDetails(eventHtml);
        expanded.push(applyInstanceDetails(event, details, website, canonicalEventUrl, seriesKey));
        continue;
      }

      for (const instanceUrl of instanceUrls) {
        let details = extractSalesforceInstanceDetails(eventHtml);
        try {
          const instanceHtml = await fetchPage(instanceUrl);
          const instanceDetails = extractSalesforceInstanceDetails(instanceHtml);
          if (instanceDetails.start_date || instanceDetails.start_time || instanceDetails.venue) {
            details = instanceDetails;
          }
        } catch (err) {
          if (verbose) {
            const msg = err instanceof Error ? err.message : String(err);
            console.log(
              `    WARN: failed fetching Salesforce instance detail for "${event.title}" (${instanceUrl}): ${msg}`
            );
          }
        }

        expanded.push(
          applyInstanceDetails(event, details, instanceUrl, canonicalEventUrl, seriesKey)
        );
      }

      if (verbose && instanceUrls.length > 1) {
        console.log(`    Expanded "${event.title}" into ${instanceUrls.length} series instances`);
      }
    } catch (err) {
      if (verbose) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`    WARN: Salesforce expansion failed for "${event.title}": ${msg}`);
      }
      expanded.push(event);
    }
  }

  return expanded;
}

function applyInstanceDetails(
  base: ScrapedEvent,
  details: ParsedInstanceDetails,
  registrationUrl: string,
  canonicalEventUrl: string,
  seriesKey: string | null
): ScrapedEvent {
  return {
    ...base,
    start_date: details.start_date || base.start_date,
    end_date: details.end_date || base.end_date,
    start_time: details.start_time || base.start_time,
    end_time: details.end_time || base.end_time,
    location_name: details.venue || base.location_name,
    cost: details.cost || base.cost,
    registration_required: true,
    registration_url: registrationUrl,
    website: canonicalEventUrl,
    series_key: seriesKey,
    series_parent_title: base.series_parent_title || base.title,
    series_parent_website: canonicalEventUrl,
  };
}

interface ParsedInstanceDetails {
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  cost: string | null;
}

function extractSalesforceInstanceDetails(html: string): ParsedInstanceDetails {
  const isoDateTimes = extractUniqueMatches(
    html,
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})/gi
  );

  const parsedIsos = isoDateTimes
    .map((iso) => isoToPacificDateTime(iso))
    .filter((x): x is { date: string; time: string | null } => !!x);

  let startDate = parsedIsos[0]?.date || null;
  let startTime = parsedIsos[0]?.time || null;
  let endTime = parsedIsos[1]?.time || null;
  let endDate: string | null = null;
  if (parsedIsos[1]?.date && parsedIsos[1]?.date !== startDate) {
    endDate = parsedIsos[1].date;
  }

  if (!startDate) {
    const dateKeyValue = firstMatchingJsonStringValue(html, [
      'startDate',
      'eventDate',
      'instanceDate',
      'date',
    ]);
    const parsedDate = parseDateOnly(dateKeyValue);
    if (parsedDate) startDate = parsedDate;
  }

  if (!startTime) {
    const startTimeValue = firstMatchingJsonStringValue(html, [
      'startTime',
      'start_time',
      'timeStart',
      'eventStartTime',
    ]);
    startTime = parseTime12h(startTimeValue) || normalize24hTime(startTimeValue);
  }

  if (!endTime) {
    const endTimeValue = firstMatchingJsonStringValue(html, [
      'endTime',
      'end_time',
      'timeEnd',
      'eventEndTime',
    ]);
    endTime = parseTime12h(endTimeValue) || normalize24hTime(endTimeValue);
  }

  const $ = cheerio.load(html);
  const text = $.text().replace(/\s+/g, ' ').trim();

  if (!startDate || !startTime) {
    const textualStart = parseTextualDateTime(text);
    if (!startDate && textualStart.date) startDate = textualStart.date;
    if (!startTime && textualStart.time) startTime = textualStart.time;
    if (!endTime && textualStart.endTime) endTime = textualStart.endTime;
  }

  const venueFromJson = firstMatchingJsonStringValue(html, [
    'venueName',
    'venue',
    'locationName',
    'location',
  ]);
  const venueFromText = extractVenueFromText(text);
  const venue = cleanVenue(venueFromJson) || cleanVenue(venueFromText);

  const cost = extractPriceRange(html, text);

  return {
    start_date: startDate,
    end_date: endDate,
    start_time: startTime,
    end_time: endTime,
    venue,
    cost,
  };
}

function extractSalesforceInstanceUrls(html: string, eventUrl: string): string[] {
  const urls = new Set<string>();
  const fromAbsolute = extractUniqueMatches(
    html,
    /https?:\/\/[^"'\\\s]+#\/instances\/[A-Za-z0-9]+/gi
  );

  for (const value of fromAbsolute) {
    const normalized = toAbsoluteUrl(unescapeJsonString(value), eventUrl);
    if (normalized) urls.add(normalized);
  }

  const fromHashRefs = extractUniqueMatches(html, /#\/instances\/([A-Za-z0-9]+)/g).map(
    (m) => m.replace(/^#\/instances\//, '')
  );
  for (const id of fromHashRefs) {
    const resolved = salesforceHashUrl(eventUrl, 'instances', id);
    if (resolved) urls.add(resolved);
  }

  const fromEscaped = extractUniqueMatches(html, /\\\/instances\\\/([A-Za-z0-9]+)/g).map((m) =>
    m.replace(/\\\/instances\\\//, '')
  );
  for (const id of fromEscaped) {
    const resolved = salesforceHashUrl(eventUrl, 'instances', id);
    if (resolved) urls.add(resolved);
  }

  return [...urls];
}

function salesforceHashUrl(
  baseUrl: string,
  kind: 'events' | 'instances',
  id: string
): string | null {
  try {
    const u = new URL(baseUrl);
    return `${u.origin}${u.pathname}#/${kind}/${id}`;
  } catch {
    return null;
  }
}

function canonicalSalesforceEventUrl(eventUrl: string): string {
  const eventId = extractSalesforceEventId(eventUrl);
  if (!eventId) return eventUrl;
  return salesforceHashUrl(eventUrl, 'events', eventId) || eventUrl;
}

function buildSalesforceSeriesKey(eventUrl: string): string | null {
  const eventId = extractSalesforceEventId(eventUrl);
  if (eventId) return `salesforce-event:${eventId}`;
  const canonical = canonicalSalesforceEventUrl(eventUrl);
  return canonical ? `salesforce-url:${canonical}` : null;
}

function extractSalesforceEventId(url: string): string | null {
  const match = url.match(/#\/events\/([A-Za-z0-9]+)/i);
  return match ? match[1] : null;
}

function extractUniqueMatches(input: string, regex: RegExp): string[] {
  const values = new Set<string>();
  for (const match of input.matchAll(regex)) {
    if (match[0]) values.add(match[0]);
  }
  return [...values];
}

function unescapeJsonString(raw: string): string {
  return raw
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/\\u003A/gi, ':')
    .replace(/\\u0026/gi, '&');
}

function firstMatchingJsonStringValue(input: string, keys: string[]): string | null {
  for (const key of keys) {
    const re = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'i');
    const match = input.match(re);
    if (match?.[1]) {
      return unescapeJsonString(match[1]).trim();
    }
  }
  return null;
}

function isoToPacificDateTime(iso: string): { date: string; time: string | null } | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;

  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
  }).format(d);

  const timeParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const hour = timeParts.find((p) => p.type === 'hour')?.value || '00';
  const minute = timeParts.find((p) => p.type === 'minute')?.value || '00';
  const time = `${hour}:${minute}`;

  return { date, time: time === '00:00' ? null : time };
}

function parseDateOnly(raw: string | null): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d);
}

function parseTextualDateTime(text: string): {
  date: string | null;
  time: string | null;
  endTime: string | null;
} {
  const dateMatch = text.match(
    /\b([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\b(?:\s*(?:at|@)\s*)?(\d{1,2}:\d{2}\s*[AP]M)?/i
  );
  const rangeMatch = text.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*[-–]\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
  const date = parseDateOnly(dateMatch?.[1] || null);
  const time = parseTime12h(dateMatch?.[2] || null);
  const endTime = parseTime12h(rangeMatch?.[2] || null);
  return { date, time, endTime };
}

function parseTime12h(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const min = match[2];
  const period = match[3];
  if (period === 'pm' && hour !== 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${min}`;
}

function normalize24hTime(raw: string | null): string | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hour = match[1].padStart(2, '0');
  return `${hour}:${match[2]}`;
}

function extractVenueFromText(text: string): string | null {
  const explicit = text.match(/(?:Venue|Location)\s*[:\-]\s*([A-Za-z0-9 '&.,-]{3,80})/i);
  if (explicit?.[1]) return explicit[1].trim();

  const snowyOwl = text.match(/\bSnowy Owl (?:Theater|Theatre)\b/i);
  if (snowyOwl?.[0]) return snowyOwl[0];

  return null;
}

function cleanVenue(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  if (/^(venue|location)$/i.test(normalized)) return null;
  return normalized;
}

function extractPriceRange(html: string, text: string): string | null {
  const numericKeys = {
    min: firstMatchingJsonNumberValue(html, ['minPrice', 'minimumPrice', 'priceMin', 'lowestPrice']),
    max: firstMatchingJsonNumberValue(html, ['maxPrice', 'maximumPrice', 'priceMax', 'highestPrice']),
  };

  if (numericKeys.min !== null || numericKeys.max !== null) {
    const min = numericKeys.min ?? numericKeys.max!;
    const max = numericKeys.max ?? numericKeys.min!;
    return formatCurrencyRange(min, max);
  }

  const priceLabel = firstMatchingJsonStringValue(html, [
    'priceRange',
    'priceDisplay',
    'priceText',
    'ticketPrice',
  ]);
  if (priceLabel && /\$|free/i.test(priceLabel)) {
    return priceLabel.trim();
  }

  const prices = extractDollarAmounts(text);
  if (prices.length > 0) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return formatCurrencyRange(min, max);
  }

  if (/\bfree\b/i.test(text)) return 'Free';
  return null;
}

function firstMatchingJsonNumberValue(input: string, keys: string[]): number | null {
  for (const key of keys) {
    const re = new RegExp(`"${key}"\\s*:\\s*(\\d+(?:\\.\\d{1,2})?)`, 'i');
    const match = input.match(re);
    if (!match?.[1]) continue;
    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed)) continue;
    return parsed;
  }
  return null;
}

function extractDollarAmounts(text: string): number[] {
  const amounts = new Set<number>();
  for (const match of text.matchAll(/\$\s*(\d+(?:\.\d{1,2})?)/g)) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) amounts.add(value);
  }
  return [...amounts];
}

function formatCurrencyRange(a: number, b: number): string {
  const [min, max] = a <= b ? [a, b] : [b, a];
  if (min === max) return `$${formatCurrency(min)}`;
  return `$${formatCurrency(min)}-$${formatCurrency(max)}`;
}

function formatCurrency(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function extractDescriptionFromHtml(html: string, selectors: string[]): string | null {
  const $ = cheerio.load(html);

  for (const selector of selectors) {
    const node = $(selector).first();
    if (node.length === 0) continue;

    const text = node.text().replace(/\s+/g, ' ').trim();

    if (text.length >= 40) return text;
  }

  return null;
}

function toAbsoluteUrl(url: string | null, base: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

function looksTruncated(text: string): boolean {
  return /\.\.\.$/.test(text.trim()) || /…$/.test(text.trim());
}

function shouldReplaceDescription(current: string | null, candidate: string): boolean {
  if (!current || current.trim().length === 0) return true;
  if (looksTruncated(current)) return true;
  return candidate.length > current.length + 120;
}

// Test-only exports for scraper detail parsing.
export const __testing = {
  extractSalesforceInstanceDetails,
  extractSalesforceInstanceUrls,
  buildSalesforceSeriesKey,
};
