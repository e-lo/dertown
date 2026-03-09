import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';
import type { ScrapedEvent } from './types';

/** Resolve a potentially relative URL against a base URL. */
function resolveUrl(href: string | undefined, baseUrl: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

/** Extract structured metadata (images, links) from HTML before stripping to text. */
function extractHtmlMetadata(
  html: string,
  sourceUrl: string
): { images: string[]; links: { text: string; href: string }[] } {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $('script, style, nav, footer, header, noscript, svg, iframe').remove();

  // Extract images (skip tiny icons/tracking pixels by filtering common patterns)
  const images: string[] = [];
  const seenImages = new Set<string>();
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    const resolved = resolveUrl(src, sourceUrl);
    if (!resolved) return;
    // Skip tiny icons, tracking pixels, and logos by common URL patterns
    if (/favicon|icon|pixel|tracking|logo|badge|button/i.test(resolved)) return;
    // Skip data URIs and very short filenames
    if (resolved.startsWith('data:')) return;
    if (!seenImages.has(resolved)) {
      seenImages.add(resolved);
      images.push(resolved);
    }
  });

  // Also check og:image and other meta tags
  const ogImage = $('meta[property="og:image"]').attr('content');
  const ogResolved = resolveUrl(ogImage, sourceUrl);
  if (ogResolved && !seenImages.has(ogResolved)) {
    images.unshift(ogResolved); // OG image is highest priority
  }

  // Extract links with their text
  const links: { text: string; href: string }[] = [];
  const seenLinks = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const resolved = resolveUrl(href, sourceUrl);
    if (!resolved) return;
    // Skip anchors, javascript, and mailto
    if (resolved.startsWith('#') || resolved.startsWith('javascript:')) return;
    const text = $(el).text().trim();
    if (!text) return;
    if (!seenLinks.has(resolved)) {
      seenLinks.add(resolved);
      links.push({ text, href: resolved });
    }
  });

  return { images, links };
}

/** Strip non-content HTML elements and extract clean text for AI extraction. */
export function htmlToCleanText(html: string, maxChars: number): string {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $('script, style, nav, footer, header, noscript, svg, iframe').remove();

  // Get text, collapse whitespace
  const text = $('body')
    .text()
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n\n')
    .trim();

  if (text.length <= maxChars) return text;
  // Truncate at word boundary
  const slice = text.slice(0, maxChars);
  const cutAt = slice.lastIndexOf(' ');
  return cutAt > maxChars * 0.75 ? slice.slice(0, cutAt) : slice;
}

/** Build the system and user prompts for Claude event extraction. */
export function buildExtractionPrompt(
  cleanText: string,
  sourceUrl: string,
  metadata: { images: string[]; links: { text: string; href: string }[] }
): { system: string; user: string } {
  const today = new Date().toISOString().split('T')[0];

  const system = 'You extract structured event data from webpage text. Respond with ONLY valid JSON.';

  // Build metadata sections
  let metadataSection = '';
  if (metadata.images.length > 0) {
    metadataSection += '\n\nImages found on the page:\n';
    for (const img of metadata.images.slice(0, 10)) {
      metadataSection += `- ${img}\n`;
    }
  }
  if (metadata.links.length > 0) {
    // Only include potentially relevant links (tickets, registration, event details)
    const relevantLinks = metadata.links.filter((l) =>
      /ticket|register|buy|book|event|show|perform|schedule|reserv|rsvp|sign.?up/i.test(
        l.text + ' ' + l.href
      )
    );
    if (relevantLinks.length > 0) {
      metadataSection += '\nTicket/registration links found:\n';
      for (const link of relevantLinks.slice(0, 10)) {
        metadataSection += `- "${link.text}" → ${link.href}\n`;
      }
    }
  }

  const user = `Extract event information from this webpage text. Return a JSON array of events.
Each event should have these fields (use null if not found):

- title: string (required) — the name of the event or show
- description: string or null — a brief description of the event
- start_date: string in YYYY-MM-DD format (required)
- end_date: string in YYYY-MM-DD format or null (only for multi-day events that span consecutive days, NOT for recurring shows)
- start_time: string in HH:MM 24-hour format or null
- end_time: string in HH:MM 24-hour format or null
- location_name: string (venue name) or null
- cost: string (e.g. "Free", "$10", "$10-$25") or null — look for ticket prices, admission fees, suggested donations
- registration_required: boolean — true if tickets must be purchased or registration is needed
- registration_url: string or null — URL to buy tickets or register (use full absolute URLs)
- website: string (event detail page URL) or null
- image_url: string or null — the main event/show image (not logos or icons), use a full absolute URL

IMPORTANT RULES:
1. If an event has multiple performance dates (e.g. a show running July 3, 5, 10, 12), return a SEPARATE event object for EACH date with its own start_date. Use the EXACT SAME title for all instances of the same show. Do NOT combine multiple dates into a single event with a date range.
2. Use the exact same title string for every instance of the same show — do not add dates or numbering to the title.
3. For image_url, pick the most prominent event/show image (not logos or navigation images). Use the full absolute URL from the images list below.
4. If there's a ticket purchase link, set registration_required to true and registration_url to the ticket link.
5. Only include events that haven't already passed (today is ${today}).
6. Only include events in or near Leavenworth, WA if this is a regional calendar.

The source URL is: ${sourceUrl}
${metadataSection}
Respond with ONLY valid JSON, no markdown.

Webpage text:
${cleanText}`;

  return { system, user };
}

/** Extract JSON from a response that may be wrapped in markdown code blocks. */
function extractJson(text: string): string {
  // Try to extract from \`\`\`json ... \`\`\` or \`\`\` ... \`\`\` blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  return text.trim();
}

/** Validate and normalize a raw extracted event object into a ScrapedEvent. */
function validateEvent(raw: Record<string, unknown>, sourceUrl: string): ScrapedEvent | null {
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const startDate = typeof raw.start_date === 'string' ? raw.start_date.trim() : '';

  if (!title || !startDate) return null;

  return {
    title,
    description: typeof raw.description === 'string' ? raw.description : null,
    start_date: startDate,
    end_date: typeof raw.end_date === 'string' ? raw.end_date : null,
    start_time: typeof raw.start_time === 'string' ? raw.start_time : null,
    end_time: typeof raw.end_time === 'string' ? raw.end_time : null,
    location_name: typeof raw.location_name === 'string' ? raw.location_name : null,
    cost: typeof raw.cost === 'string' ? raw.cost : null,
    registration_required:
      typeof raw.registration_required === 'boolean' ? raw.registration_required : null,
    registration_url: typeof raw.registration_url === 'string' ? raw.registration_url : null,
    website: typeof raw.website === 'string' ? raw.website : sourceUrl,
    image_url: typeof raw.image_url === 'string' ? raw.image_url : null,
  };
}

/** Build a stable series key from a title and source URL. */
function buildSeriesKey(title: string, sourceUrl: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const host = (() => {
    try {
      return new URL(sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      return 'unknown';
    }
  })();
  return `ai-${host}-${slug}`;
}

/** Assign series_key to events that share the same title (2+ instances = a series). */
function assignSeriesKeys(events: ScrapedEvent[], sourceUrl: string): void {
  // Count occurrences of each normalized title
  const titleCounts = new Map<string, number>();
  for (const ev of events) {
    const key = ev.title.toLowerCase().trim();
    titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
  }

  for (const ev of events) {
    const key = ev.title.toLowerCase().trim();
    if ((titleCounts.get(key) || 0) >= 2) {
      const seriesKey = buildSeriesKey(ev.title, sourceUrl);
      ev.series_key = seriesKey;
      ev.series_parent_title = ev.title;
      ev.series_parent_website = sourceUrl;
    }
  }
}

/** Use Claude Haiku to extract events from HTML page content. */
export async function extractEventsWithAI(
  html: string,
  sourceUrl: string,
  descriptionMaxChars: number,
  verbose: boolean
): Promise<ScrapedEvent[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not set. Add it to .env.local for AI extraction.'
    );
  }

  // Extract metadata (images, links) before stripping HTML
  const metadata = extractHtmlMetadata(html, sourceUrl);
  if (verbose) {
    console.log(`  Found ${metadata.images.length} images, ${metadata.links.length} links`);
  }

  const cleanText = htmlToCleanText(html, descriptionMaxChars);
  if (verbose) console.log(`  Clean text: ${cleanText.length} chars`);

  if (cleanText.length < 50) {
    if (verbose) console.log('  Page text too short for extraction, skipping');
    return [];
  }

  const { system, user } = buildExtractionPrompt(cleanText, sourceUrl, metadata);

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    system,
    messages: [{ role: 'user', content: user }],
  });

  // Extract text from response
  const responseText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  if (verbose) {
    const usage = response.usage;
    // Haiku pricing: $0.80/M input, $4/M output
    const cost = (usage.input_tokens * 0.8 + usage.output_tokens * 4) / 1_000_000;
    console.log(
      `  AI tokens: ${usage.input_tokens} in / ${usage.output_tokens} out (~$${cost.toFixed(4)})`
    );
  }

  // Parse JSON response
  const jsonStr = extractJson(responseText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${jsonStr.slice(0, 200)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not a JSON array');
  }

  // Validate each event
  const events: ScrapedEvent[] = [];
  for (const raw of parsed) {
    if (typeof raw !== 'object' || raw === null) continue;
    const event = validateEvent(raw as Record<string, unknown>, sourceUrl);
    if (event) events.push(event);
  }

  // Auto-detect series: events that share the same title get a series_key
  assignSeriesKeys(events, sourceUrl);

  if (verbose) {
    console.log(`  AI extracted ${events.length} valid events`);
    // Report series detection
    const seriesGroups = new Map<string, number>();
    for (const ev of events) {
      if (ev.series_key) {
        seriesGroups.set(ev.series_key, (seriesGroups.get(ev.series_key) || 0) + 1);
      }
    }
    for (const [key, count] of seriesGroups) {
      console.log(`  Series key "${key}": ${count} events`);
    }
  }

  return events;
}
