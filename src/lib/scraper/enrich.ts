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
  const imageSelector = source.detail_image_selector || null;
  const endTimeSelector = source.detail_end_time_selector || null;
  const locationSelector = source.detail_location_selector || null;
  if (!selectors?.length && !imageSelector && !endTimeSelector && !locationSelector) return enrichedEvents;

  const detailHtmlCache = new Map<string, string>();

  for (const event of enrichedEvents) {
    const website = toAbsoluteUrl(event.website, source.url);
    if (!website) continue;
    event.website = website;

    const needsDescription =
      selectors?.length &&
      (!event.description ||
        event.description.length < 500 ||
        looksTruncated(event.description));
    const needsImage = imageSelector && !event.image_url;
    const needsEndTime = endTimeSelector && !event.end_time;
    const needsLocation = locationSelector && !event.location_name;

    if (!needsDescription && !needsImage && !needsEndTime && !needsLocation) continue;

    try {
      let html = detailHtmlCache.get(website);
      if (!html) {
        html = await fetchPage(website);
        detailHtmlCache.set(website, html);
      }

      if (needsDescription && selectors?.length) {
        const detailDescription = extractDescriptionFromHtml(html, selectors);
        if (detailDescription && shouldReplaceDescription(event.description, detailDescription)) {
          event.description = detailDescription;
        }
      }

      if (needsImage && imageSelector) {
        const imageUrl = extractImageFromHtml(html, imageSelector);
        if (imageUrl) event.image_url = imageUrl;
      }

      if (needsEndTime && endTimeSelector) {
        const $ = cheerio.load(html);
        const endTimeText = $(endTimeSelector).first().text().trim();
        const parsed = parseTime12hLocal(endTimeText);
        if (parsed) event.end_time = parsed;
      }

      if (needsLocation && locationSelector) {
        const $ = cheerio.load(html);
        const rawText = $(locationSelector).first().text().replace(/\s+/g, ' ').trim();
        const venueName = extractVenueNameFromLocationText(rawText);
        if (venueName) event.location_name = venueName;
      }
    } catch (err) {
      if (verbose) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`    WARN: detail page fetch failed for "${event.title}": ${msg}`);
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

    if (!website.includes('salesforce-sites.com')) {
      expanded.push(event);
      continue;
    }

    try {
      // If this row already points at an instance URL, parse that page directly.
      if (website.includes('#/instances/')) {
        const instanceHtml = await fetchPage(website);
        const details = extractSalesforceInstanceDetails(instanceHtml);
        details.venue =
          details.venue ||
          resolveSalesforceVenueOverride(source, website, event.series_parent_website || null);
        const canonicalEventUrl = event.series_parent_website || event.registration_url || website;
        const seriesKey = event.series_key || buildSalesforceSeriesKey(canonicalEventUrl);
        expanded.push(
          applyInstanceDetails(
            event,
            details,
            website,
            canonicalSalesforceEventUrl(canonicalEventUrl),
            seriesKey
          )
        );
        continue;
      }

      if (!website.includes('#/events/')) {
        expanded.push(event);
        continue;
      }

      const registrationUrl = toAbsoluteUrl(event.registration_url, source.url);
      const canonicalEventUrl = canonicalSalesforceEventUrl(website);
      const seriesKey = buildSalesforceSeriesKey(website);

      // If the card already points to a specific instance, prefer that detail page directly.
      if (registrationUrl && registrationUrl.includes('#/instances/')) {
        try {
          const instanceHtml = await fetchPage(registrationUrl);
          const details = extractSalesforceInstanceDetails(instanceHtml);
          details.venue =
            details.venue ||
            resolveSalesforceVenueOverride(source, registrationUrl, canonicalEventUrl);
          expanded.push(
            applyInstanceDetails(event, details, registrationUrl, canonicalEventUrl, seriesKey)
          );
          continue;
        } catch (err) {
          if (verbose) {
            const msg = err instanceof Error ? err.message : String(err);
            console.log(
              `    WARN: failed direct Salesforce instance fetch for "${event.title}" (${registrationUrl}): ${msg}`
            );
          }
        }
      }

      const eventHtml = await fetchPage(website);
      let instanceUrls = extractSalesforceInstanceUrls(eventHtml, website);
      if (instanceUrls.length === 0) {
        instanceUrls = await fetchSalesforceInstanceUrlsFromApi(website, verbose, event.title);
      }
      if (verbose && /gothard sisters/i.test(event.title)) {
        console.log(
          `    DEBUG SALESFORCE "${event.title}": discovered ${instanceUrls.length} instance URL(s)`
        );
      }

      if (instanceUrls.length === 0) {
        const details = extractSalesforceInstanceDetails(eventHtml);
        details.venue =
          details.venue || resolveSalesforceVenueOverride(source, website, canonicalEventUrl);
        expanded.push(applyInstanceDetails(event, details, website, canonicalEventUrl, seriesKey));
        continue;
      }

      for (const instanceUrl of instanceUrls) {
        let details = extractSalesforceInstanceDetails(eventHtml);
        try {
          const instanceHtml = await fetchPage(instanceUrl);
          const instanceDetails = extractSalesforceInstanceDetails(instanceHtml);
          instanceDetails.venue =
            instanceDetails.venue ||
            resolveSalesforceVenueOverride(source, instanceUrl, canonicalEventUrl);
          if (
            verbose &&
            /gothard sisters/i.test(event.title) &&
            !instanceDetails.venue
          ) {
            const hasSnowy = /snowy\s+owl/i.test(instanceHtml);
            console.log(
              `    DEBUG SALESFORCE "${event.title}": no venue parsed for ${instanceUrl}; html_has_snowy_owl=${hasSnowy}`
            );
          }
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

function resolveSalesforceVenueOverride(
  source: SourceConfig,
  url: string,
  canonicalEventUrl: string | null
): string | null {
  const overrides = source.instance_location_overrides;
  if (!overrides) return null;

  const candidateIds = new Set<string>();

  const instanceMatch = url.match(/#\/instances\/([A-Za-z0-9]+)/i);
  if (instanceMatch?.[1]) candidateIds.add(instanceMatch[1]);

  const eventMatch = url.match(/#\/events\/([A-Za-z0-9]+)/i);
  if (eventMatch?.[1]) candidateIds.add(eventMatch[1]);

  if (canonicalEventUrl) {
    const canonicalMatch = canonicalEventUrl.match(/#\/events\/([A-Za-z0-9]+)/i);
    if (canonicalMatch?.[1]) candidateIds.add(canonicalMatch[1]);
  }

  for (const id of candidateIds) {
    const direct = overrides[id];
    if (direct) return direct;
    const lower = overrides[id.toLowerCase()];
    if (lower) return lower;
  }

  return null;
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
    // For child rows, source website should point to the specific instance page.
    website: registrationUrl,
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
    'venueTitle',
    'venueDisplayName',
    'venue',
    'spaceName',
    'facilityName',
    'roomName',
    'hallName',
    'locationName',
    'locationTitle',
    'locationDisplayName',
    'location',
  ]);
  const venueFromGenericJson = extractVenueFromGenericJson(html);
  const venueFromHtml = extractVenueFromHtml(html);
  const venueFromText = extractVenueFromText(text);
  const venue =
    cleanVenue(venueFromJson) ||
    cleanVenue(venueFromGenericJson) ||
    cleanVenue(venueFromHtml) ||
    cleanVenue(venueFromText);

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

  // Some Salesforce pages expose only instance IDs in JSON payloads.
  const idCandidates = new Set<string>();
  const idKeyPatterns = [
    /"instanceId"\s*:\s*"([A-Za-z0-9]+)"/gi,
    /"instance_id"\s*:\s*"([A-Za-z0-9]+)"/gi,
    /"ticketInstanceId"\s*:\s*"([A-Za-z0-9]+)"/gi,
    /"id"\s*:\s*"(a0F[A-Za-z0-9]+)"/gi,
  ];
  for (const re of idKeyPatterns) {
    for (const match of html.matchAll(re)) {
      const id = match[1];
      if (id && /^a0F[A-Za-z0-9]{8,}$/.test(id)) idCandidates.add(id);
    }
  }

  // Last-resort pattern: any Salesforce instance-style IDs in page text.
  for (const match of html.matchAll(/\ba0F[A-Za-z0-9]{8,}\b/g)) {
    idCandidates.add(match[0]);
  }

  for (const id of idCandidates) {
    const resolved = salesforceHashUrl(eventUrl, 'instances', id);
    if (resolved) urls.add(resolved);
  }

  return [...urls];
}

async function fetchSalesforceInstanceUrlsFromApi(
  eventUrl: string,
  verbose: boolean,
  title?: string
): Promise<string[]> {
  const eventId = extractSalesforceEventId(eventUrl);
  if (!eventId) return [];

  let origin = '';
  let pathname = '';
  try {
    const u = new URL(eventUrl);
    origin = u.origin;
    pathname = u.pathname.replace(/\/+$/, '');
  } catch {
    return [];
  }

  const baseCandidates = Array.from(
    new Set([
      `${origin}${pathname}`,
      `${origin}/ticket`,
      origin,
    ])
  );

  const endpointTemplates = [
    '/services/apexrest/events/{eventId}/instances',
    '/services/apexrest/event/{eventId}/instances',
    '/services/apexrest/ticket/events/{eventId}/instances',
    '/services/apexrest/ticketing/events/{eventId}/instances',
    '/services/apexrest/calendar/events/{eventId}/instances',
    '/services/apexrest/instances?eventId={eventId}',
    '/services/apexrest/events/{eventId}',
    '/services/apexrest/event/{eventId}',
  ];

  const attempted = new Set<string>();
  const results = new Set<string>();

  for (const base of baseCandidates) {
    for (const template of endpointTemplates) {
      const endpoint = `${base}${template.replace('{eventId}', eventId)}`;
      if (attempted.has(endpoint)) continue;
      attempted.add(endpoint);

      try {
        const text = await fetchPage(endpoint, 8000);
        const ids = extractSalesforceInstanceIdsFromText(text);
        for (const id of ids) {
          const url = salesforceHashUrl(eventUrl, 'instances', id);
          if (url) results.add(url);
        }
        if (results.size > 0) {
          if (verbose && title && /gothard sisters/i.test(title)) {
            console.log(
              `    DEBUG SALESFORCE "${title}": API fallback matched ${results.size} instance(s) via ${endpoint}`
            );
          }
          return [...results];
        }
      } catch {
        // Ignore endpoint miss/errors and continue probing.
      }
    }
  }

  return [...results];
}

function extractSalesforceInstanceIdsFromText(text: string): string[] {
  const ids = new Set<string>();
  const patterns = [
    /\ba0F[A-Za-z0-9]{8,}\b/g,
    /"instanceId"\s*:\s*"([A-Za-z0-9]+)"/gi,
    /"instance_id"\s*:\s*"([A-Za-z0-9]+)"/gi,
    /"ticketInstanceId"\s*:\s*"([A-Za-z0-9]+)"/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const candidate = match[1] || match[0];
      if (!candidate) continue;
      if (/^a0F[A-Za-z0-9]{8,}$/.test(candidate)) ids.add(candidate);
    }
  }

  return [...ids];
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

  const snowyOwl = text.match(/\bSnowy Owl(?:\s+(?:Theater|Theatre))?\b/i);
  if (snowyOwl?.[0]) return snowyOwl[0];

  return null;
}

function extractVenueFromHtml(html: string): string | null {
  const explicit = html.match(/(?:venue|location)\s*[:>\-]\s*([A-Za-z0-9 '&.,-]{3,100})/i);
  if (explicit?.[1]) return explicit[1].trim();

  const snowy = html.match(/\bSnowy\s+Owl(?:\s+(?:Theater|Theatre))?\b/i);
  if (snowy?.[0]) return snowy[0];

  return null;
}

function extractVenueFromGenericJson(html: string): string | null {
  const re = /"(?:venue|location|space|facility|room|hall)[A-Za-z_]*"\s*:\s*"([^"]{3,120})"/gi;
  for (const match of html.matchAll(re)) {
    const candidate = unescapeJsonString(match[1]).trim();
    if (!candidate) continue;
    if (/^a0[A-Za-z0-9]+$/.test(candidate)) continue;
    if (/\d{4}-\d{2}-\d{2}/.test(candidate)) continue;
    return candidate;
  }
  return null;
}

function cleanVenue(raw: string | null): string | null {
  if (!raw) return null;
  let normalized = raw.replace(/\s+/g, ' ').trim();
  if (/snowy\s+owl/i.test(normalized)) {
    normalized = /theat(re|er)/i.test(normalized) ? normalized : 'Snowy Owl Theater';
  }
  normalized = normalized.replace(/\s+at\s+icicle creek center.*$/i, '').trim();
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

/**
 * Extract venue name from a raw location text that may include an address.
 * e.g. "Ground Control Bottle Shop 10 N. Wenatchee Ave. Wenatchee, WA 98801 US"
 *   → "Ground Control Bottle Shop"
 */
function extractVenueNameFromLocationText(text: string): string | null {
  if (!text) return null;
  // Strip trailing address: text before the first street number (digits followed by a word)
  const addressMatch = text.match(/^(.*?)\s+\d+\s+[A-Z]/);
  if (addressMatch) {
    const name = addressMatch[1].trim();
    return name || null;
  }
  // No address found — return the whole text if it's not just an address
  return text || null;
}

/** Parse "7:00 pm" → "19:00", used for detail-page end time extraction. */
function parseTime12hLocal(raw: string): string | null {
  const match = raw.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const min = match[2];
  if (match[3] === 'pm' && hour !== 12) hour += 12;
  if (match[3] === 'am' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${min}`;
}

function extractImageFromHtml(html: string, selector: string): string | null {
  const $ = cheerio.load(html);
  // Special-case og:image — it's a meta content attribute, not element text
  if (selector === 'og:image') {
    return $('meta[property="og:image"]').attr('content') || null;
  }
  const node = $(selector).first();
  if (node.length === 0) return null;
  // For <img> elements, use src; for <meta>, use content; otherwise innerText
  const src = node.attr('src') || node.attr('content') || null;
  return src || null;
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
