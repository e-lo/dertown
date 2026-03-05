import * as cheerio from 'cheerio';
import type { ScrapedEvent } from './types';
import type { SourceConfig } from './types';

/** Generic HTML parser — dispatches to a site-specific extractor based on source ID. */
export function parseHtml(html: string, source: SourceConfig): ScrapedEvent[] {
  const extractor = EXTRACTORS[source.id];
  if (!extractor) {
    return [];
  }
  return extractor(html, source);
}

// ── Site-specific extractors ──────────────────────────────────────────

type Extractor = (html: string, source: SourceConfig) => ScrapedEvent[];

const EXTRACTORS: Record<string, Extractor> = {
  'icicle-creek': extractIcicleCreek,
  'ski-leavenworth': extractSkiLeavenworth,
  'wenatchee-river-institute': extractWRI,
  // leavenworth-org: uses iCal feed instead
};

/**
 * Icicle Creek Center — server-rendered HTML with structured event containers.
 * Structure:
 *   div.event-container
 *     div.event-title.event-cat-* > span.event-title-inner (title + category)
 *       div.top-date > div.top-m (month) + text (day)
 *     div.event-img > img (image)
 *     div.event-button_container > div.event-info > a (detail link)
 *     div.event-date-price_container
 *       div.event-datetime > span.date-container (e.g. "Mar 16 6:30pm")
 *       div.event-price (e.g. "$40")
 *     div.event-desc > p (description)
 */
function extractIcicleCreek(html: string, _source: SourceConfig): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  const currentYear = new Date().getFullYear();

  $('div.event-container').each((_i, container) => {
    const el = $(container);

    // Title — from event-title-inner, stripping the category span and date div
    const titleInner = el.find('.event-title-inner').clone();
    titleInner.find('.cat-names').remove();
    titleInner.find('.top-date').remove();
    const title = titleInner.text().replace(/\s+/g, ' ').trim();
    if (!title) return;

    // Category
    const catSpan = el.find('.cat-names').text().trim();

    // Date and time from event-datetime
    const dateTimeText = el.find('.event-datetime .date-container').text().trim();
    // Format: "Mar 16 6:30pm" or "Mar 16-17" or "Mar 16"
    const parsed = parseIcicleDateTime(dateTimeText, currentYear);
    if (!parsed.startDate) return;

    // Price
    const price = el.find('.event-price').text().trim() || null;

    // Image
    const img = el.find('.event-img img');
    const imageUrl = img.attr('src') || null;

    // Detail link
    const detailLink = el.find('.event-info a').attr('href') || el.find('.event-purchase a').attr('href') || null;

    // Description
    const desc = el.find('.event-desc').text().replace(/\s+/g, ' ').trim() || null;

    events.push({
      title,
      description: desc,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      start_time: parsed.startTime,
      end_time: null,
      location_name: null, // Icicle Creek events use source default
      cost: price,
      registration_required: detailLink ? true : null,
      registration_url: detailLink,
      website: detailLink,
      image_url: imageUrl,
    });
  });

  return events;
}

/** Parse Icicle Creek date/time strings like "Mar 16 6:30pm", "Mar 16-17", "Mar 16" */
function parseIcicleDateTime(text: string, year: number): {
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
} {
  if (!text) return { startDate: null, endDate: null, startTime: null };

  const monthNames: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  // Match: "Mon DD HH:MMam/pm" or "Mon DD-DD" or "Mon DD"
  const match = text.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s*(.*)$/);
  if (!match) return { startDate: null, endDate: null, startTime: null };

  const monStr = match[1].toLowerCase().slice(0, 3);
  const month = monthNames[monStr];
  if (month === undefined) return { startDate: null, endDate: null, startTime: null };

  const startDay = parseInt(match[2]);
  const endDay = match[3] ? parseInt(match[3]) : null;
  const timeStr = match[4]?.trim() || null;

  const startDate = new Date(year, month, startDay);
  const startDateStr = startDate.toISOString().split('T')[0];

  let endDateStr: string | null = null;
  if (endDay) {
    const endDate = new Date(year, month, endDay);
    endDateStr = endDate.toISOString().split('T')[0];
  }

  let startTime: string | null = null;
  if (timeStr) {
    startTime = parseTime12h(timeStr);
  }

  return { startDate: startDateStr, endDate: endDateStr, startTime };
}

/**
 * Ski Leavenworth — Drupal site with structured event rows.
 * Each .views-row contains:
 *   - div.eventdate with <time datetime="..."> elements (start/end ISO datetimes)
 *   - div.eventspecifics with strong>a (title+link), div.event-dates (location), div.views-field-view-node (description)
 */
function extractSkiLeavenworth(html: string, _source: SourceConfig): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];

  // Each event row contains an eventdate div and an eventspecifics div
  const dateBlocks = $('div.eventdate');
  const specBlocks = $('div.eventspecifics');

  const count = Math.min(dateBlocks.length, specBlocks.length);

  for (let i = 0; i < count; i++) {
    const dateBlock = $(dateBlocks[i]);
    const specBlock = $(specBlocks[i]);

    // Extract date and time from <time datetime="..."> elements
    const timeEls = dateBlock.find('time[datetime]');
    if (timeEls.length === 0) continue;

    const startDatetime = timeEls.first().attr('datetime') || '';
    const endDatetime = timeEls.length > 1 ? $(timeEls[1]).attr('datetime') || '' : null;

    // Datetimes are UTC — convert to Pacific for both date and time
    const { date: startDate, time: startTime } = extractDateTimeFromIso(startDatetime);
    if (!startDate) continue;
    const endParts = endDatetime ? extractDateTimeFromIso(endDatetime) : null;
    const endTime = endParts?.time || null;

    // Title and link
    const titleLink = specBlock.find('strong a');
    if (titleLink.length === 0) continue;
    const title = titleLink.text().trim();
    const href = titleLink.attr('href') || '';
    const website = href.startsWith('http') ? href : `https://skileavenworth.com${href}`;

    // Location from div.event-dates (may contain a map link)
    const eventDatesDiv = specBlock.find('div.event-dates');
    const mapLink = eventDatesDiv.find('a[href*="maps"]');
    const location_name = mapLink.length > 0
      ? mapLink.text().trim()
      : eventDatesDiv.text().trim() || null;

    // Description
    const descDiv = specBlock.find('div.views-field-view-node');
    const description = descDiv.text().trim() || null;

    events.push({
      title,
      description,
      start_date: startDate,
      end_date: null,
      start_time: startTime,
      end_time: endTime,
      location_name: location_name || null,
      cost: null,
      registration_required: null,
      registration_url: null,
      website,
      image_url: null,
    });
  }

  return events;
}

/** Extract date (YYYY-MM-DD) and time (HH:MM) from an ISO datetime, converting to Pacific. */
function extractDateTimeFromIso(iso: string): { date: string | null; time: string | null } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: null, time: null };

  // Convert to Pacific time using Intl
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
  }).format(d); // gives YYYY-MM-DD

  const timeParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hour = timeParts.find(p => p.type === 'hour')?.value || '00';
  const minute = timeParts.find(p => p.type === 'minute')?.value || '00';
  const time = `${hour}:${minute}`;

  return {
    date: dateParts,
    time: time === '00:00' ? null : time,
  };
}

/**
 * Wenatchee River Institute — calendar table with event links.
 * Events are <a> tags inside <td> cells, with time prefixed in the link text.
 * Link URL pattern: /event-calendar.html/event/YYYY/MM/DD/slug/ID
 */
function extractWRI(html: string, _source: SourceConfig): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];

  // Find all event links — they point to /event-calendar.html/event/...
  // Use a Set to deduplicate by URL (the calendar can show the same event multiple times)
  const seen = new Set<string>();

  $('a[href*="/event-calendar.html/event/"]').each((_i, el) => {
    const href = $(el).attr('href') || '';

    // Deduplicate by URL path
    const urlPath = href.replace(/^https?:\/\/[^/]+/, '');
    if (seen.has(urlPath)) return;
    seen.add(urlPath);

    // Extract date from URL: /event/YYYY/MM/DD/slug/ID
    const urlMatch = href.match(/\/event\/(\d{4})\/(\d{2})\/(\d{2})\//);
    if (!urlMatch) return;

    const startDate = `${urlMatch[1]}-${urlMatch[2]}-${urlMatch[3]}`;

    // Get clean text — collapse whitespace from nested elements
    const rawText = $(el).text().replace(/\s+/g, ' ').trim();

    // Extract time from link text: "7:00 pm Event Title" or "7:00 pm - 8:00 pm Event Title"
    const timeMatch = rawText.match(/^(\d{1,2}:\d{2}\s*(?:am|pm))(?:\s*-\s*(\d{1,2}:\d{2}\s*(?:am|pm)))?\s+(.+)$/i);
    let title: string;
    let startTime: string | null = null;
    let endTime: string | null = null;

    if (timeMatch) {
      startTime = parseTime12h(timeMatch[1]);
      endTime = timeMatch[2] ? parseTime12h(timeMatch[2]) : null;
      title = timeMatch[3].trim();
    } else {
      // Try "Starts HH:MM am/pm" pattern
      const startsMatch = rawText.match(/^(.+?)\s+Starts\s+(\d{1,2}:\d{2}\s*(?:am|pm))$/i);
      if (startsMatch) {
        title = startsMatch[1].trim();
        startTime = parseTime12h(startsMatch[2]);
      } else {
        // Strip "All Day" suffix
        title = rawText.replace(/\s+All Day$/i, '').trim();
      }
    }

    // Clean up multi-day markers like "(Day 1 of 5)"
    title = title.replace(/\s*\(Day \d+ of \d+\)\s*/g, '').trim();

    if (!title) return;

    const website = href.startsWith('http')
      ? href
      : `https://wenatcheeriverinstitute.org${href}`;

    events.push({
      title,
      description: null,
      start_date: startDate,
      end_date: null,
      start_time: startTime,
      end_time: endTime,
      location_name: null,
      cost: null,
      registration_required: null,
      registration_url: null,
      website,
      image_url: null,
    });
  });

  return events;
}

/** Parse "7:00 pm" → "19:00" */
function parseTime12h(raw: string): string | null {
  const match = raw.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (!match) return null;
  let hour = parseInt(match[1]);
  const min = match[2];
  const period = match[3];
  if (period === 'pm' && hour !== 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${min}`;
}
