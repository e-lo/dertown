import * as cheerio from 'cheerio';
import type { ScrapedEvent } from './types';
import type { SourceConfig } from './types';

/** Parse a LibCal AJAX JSON API response into scraped events. */
export function parseLibCalJson(jsonText: string): ScrapedEvent[] {
  const data = JSON.parse(jsonText);
  if (!data.results || !Array.isArray(data.results)) return [];

  const events: ScrapedEvent[] = [];

  for (const item of data.results) {
    const title = item.title?.trim();
    if (!title) continue;

    // Date: "startdt" is "YYYY-MM-DD HH:MM:SS" in Pacific time
    const startDate = item.startdt ? item.startdt.split(' ')[0] : null;
    if (!startDate) continue;

    // Times: "start" is "9:00 AM", "end" is "10:00 AM"
    const startTime = parseTime12h(item.start);
    const endTime = parseTime12h(item.end);

    // Location: use the first location name, strip the branch prefix (e.g. "LEAVENWORTH- Main Area" → "Leavenworth Library")
    const rawLocation = item.location || null;
    const location = cleanLibCalLocation(rawLocation);

    // Description: "shortdesc" is plain text, "description" is HTML
    const description = item.shortdesc?.trim() || stripHtml(item.description) || null;

    // Cost
    const cost = item.registration_cost?.trim() || null;

    // URL
    const website = item.url || null;

    // Image
    const imageUrl = item.featured_image || null;

    // Registration
    const registrationEnabled = item.registration_enabled === true
      || item.online_registration === true
      || item.in_person_registration === true;

    events.push({
      title,
      description,
      start_date: startDate,
      end_date: null,
      start_time: startTime,
      end_time: endTime,
      location_name: location,
      cost: cost || null,
      registration_required: registrationEnabled || null,
      registration_url: registrationEnabled ? website : null,
      website,
      image_url: imageUrl,
    });
  }

  return events;
}

/** Fetch events from the LibCal AJAX API across multiple days. */
export async function fetchLibCalEvents(
  source: SourceConfig,
  verbose: boolean
): Promise<ScrapedEvent[]> {
  const apiUrl = source.api_url;
  const calIds = source.api_cal_ids || '0';
  if (!apiUrl) return [];

  const daysAhead = 45;
  const today = new Date();
  const allEvents: ScrapedEvent[] = [];
  const seenIds = new Set<string>();

  for (let d = 0; d < daysAhead; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];

    const url = `${apiUrl}?c=${calIds}&date=${dateStr}&perpage=100&page=1`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DerTown-EventScraper/1.0)',
          'Referer': source.url,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (!res.ok) continue;

      const text = await res.text();
      if (!text.trim()) continue;

      const dayEvents = parseLibCalJson(text);

      // Deduplicate across days (recurring events can appear on multiple dates)
      for (const ev of dayEvents) {
        const key = `${ev.title}|${ev.start_date}|${ev.start_time}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          allEvents.push(ev);
        }
      }
    } catch {
      // Skip failed day silently — other days may work
      if (verbose) console.log(`    WARN: Failed to fetch ${dateStr} from ${source.name}`);
    }

    // Small delay between requests to be polite
    if (d < daysAhead - 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  if (verbose) {
    console.log(`  Fetched ${daysAhead} days, ${allEvents.length} unique events`);
  }

  return allEvents;
}

/** Clean LibCal location names: "LEAVENWORTH- Main Area" → "Leavenworth Library" */
function cleanLibCalLocation(raw: string | null): string | null {
  if (!raw) return null;

  // LibCal uses "BRANCH- Room" format. Extract the branch name.
  const match = raw.match(/^([A-Z]+)-\s*/);
  if (match) {
    const branch = match[1].charAt(0) + match[1].slice(1).toLowerCase();
    return `${branch} Library`;
  }

  return raw.trim();
}

/** Strip HTML tags and decode entities to plain text. */
function stripHtml(html: string | null): string | null {
  if (!html) return null;
  const $ = cheerio.load(html);
  return $.text().replace(/\s+/g, ' ').trim() || null;
}

/** Parse "9:00 AM" → "09:00" */
function parseTime12h(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = parseInt(match[1]);
  const min = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${min}`;
}
