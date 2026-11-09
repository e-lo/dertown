/**
 * River Valley Commons (rivervalleycommons.net/activities) — hand-edited Wix page.
 * The month calendar is a repeater with one item per week: a "November 8 - 14"
 * header followed by three parallel columns (dates, times, titles), so rows pair
 * up by index. Later repeaters hold heading/body blocks describing each activity,
 * which supply descriptions, costs and sign-up links.
 *
 * Numeric dates on this page are often stale copies from a previous month, so the
 * weekday inside the week's range decides the date.
 *
 * Routine activities (bingo, lunch, weekly classes) would swamp the calendar, so
 * only special events are kept: rows tagged "*Special Event*" in the grid, and
 * anything described under the page's "Special Events" heading.
 */

import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { ScrapedEvent, SourceConfig } from './types';
import { MONTHS } from './parse-cascade';
import { fetchPage } from './fetch';

export interface WeekRange {
  year: number;
  month: number; // 0-indexed
  startDay: number;
  endDay: number; // past the month's length when the week crosses into the next one
}

interface DetailBlock {
  heading: string;
  body: string;
  signUpUrl: string | null;
  special: boolean;
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const SPECIAL_EVENT_TAG = /\*\s*special event\s*\*/i;

/** Words that differ between a calendar row's title and its detail heading. */
const IGNORED_TITLE_WORDS = new Set(['and', 'with', 'weekly', 'monthly']);

/** Calendar titles whose detail block goes by a different name. */
const DETAIL_ALIASES: Record<string, string> = {
  'Monthly Movie Night': 'Film Night',
};

function monthIndex(name: string): number | undefined {
  return MONTHS[name.slice(0, 3).toLowerCase()];
}

function isoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

/** The page never states a year; pick the one that puts `month` nearest to now. */
function inferYear(month: number, now: Date): number {
  const monthsAhead = month - now.getUTCMonth();
  if (monthsAhead < -6) return now.getUTCFullYear() + 1;
  if (monthsAhead > 6) return now.getUTCFullYear() - 1;
  return now.getUTCFullYear();
}

/** "November 8 - 14" or "November 29 - December 5" → WeekRange. */
function parseWeekHeader(text: string, now: Date): WeekRange | null {
  const m = text.match(/^([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*(?:([A-Za-z]+)\s+)?(\d{1,2})$/);
  if (!m) return null;
  const month = monthIndex(m[1]);
  if (month === undefined) return null;

  const year = inferYear(month, now);
  const endDay = Number(m[4]);
  const crossesMonth = m[3] !== undefined && monthIndex(m[3]) !== month;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return {
    year,
    month,
    startDay: Number(m[2]),
    endDay: crossesMonth ? daysInMonth + endDay : endDay,
  };
}

/** Resolve a date cell such as "Tues. 11/10", preferring its weekday over its digits. */
export function resolveCalendarDate(raw: string, week: WeekRange): string | null {
  const weekday = WEEKDAYS.indexOf(raw.trim().slice(0, 3).toLowerCase());
  for (let day = week.startDay; day <= week.endDay && weekday >= 0; day++) {
    const date = new Date(Date.UTC(week.year, week.month, day));
    if (date.getUTCDay() === weekday) return isoDate(week.year, week.month, day);
  }

  const numeric = raw.match(/(\d{1,2})\/(\d{1,2})/);
  return numeric ? isoDate(week.year, Number(numeric[1]) - 1, Number(numeric[2])) : null;
}

function to24h(hour: number, minute: string | undefined, meridiem: string): string {
  const base = hour % 12;
  const hour24 = meridiem === 'pm' ? base + 12 : base;
  return `${String(hour24).padStart(2, '0')}:${minute ?? '00'}`;
}

/** The page's times mostly sit in daytime classes; a bare 7–11 is a morning start. */
function assumedMeridiem(hour: number): string {
  return hour >= 7 && hour < 12 ? 'am' : 'pm';
}

/** "4 - 5:30 pm", "6:15 pm", "10 - 11:30" → 24h start/end. "By Appt." → nulls. */
export function parseTimeRange(raw: string): { start: string | null; end: string | null } {
  const m = raw
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/);
  if (!m) return { start: null, end: null };

  const [, startHour, startMinute, startMeridiem, endHour, endMinute, endMeridiem] = m;
  if (!endHour) {
    const meridiem = startMeridiem ?? assumedMeridiem(Number(startHour));
    return { start: to24h(Number(startHour), startMinute, meridiem), end: null };
  }

  const endPeriod = endMeridiem ?? startMeridiem ?? assumedMeridiem(Number(startHour));
  let startPeriod = startMeridiem ?? endPeriod;
  const end = to24h(Number(endHour), endMinute, endPeriod);
  // "11 - 1 pm": a start that would land after its end crossed noon.
  if (!startMeridiem && to24h(Number(startHour), startMinute, startPeriod) > end) {
    startPeriod = 'am';
  }
  return { start: to24h(Number(startHour), startMinute, startPeriod), end };
}

function titleWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .map((word) => word.replace(/s$/, ''))
    .filter((word) => !IGNORED_TITLE_WORDS.has(word));
}

function titleAppearsIn(title: string, text: string): boolean {
  const words = new Set(titleWords(text));
  return titleWords(title).every((word) => words.has(word));
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\*[^*]*\*/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Text of each paragraph/list item in a Wix rich-text cell, with blanks dropped. */
function cellBlocks($: cheerio.CheerioAPI, cell: AnyNode): string[] {
  return $(cell)
    .find('p, li, h1, h2, h3, h4, h5, h6')
    .filter((_i, el) => $(el).find('p, li, h1, h2, h3, h4, h5, h6').length === 0)
    .map((_i, el) => {
      $(el).find('br').replaceWith('\n');
      return $(el)
        .text()
        .replace(/\u00a0/g, ' ')
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
    })
    .get()
    .filter(Boolean);
}

/** Repeater cells in page order, flagged if they sit under the "Special Events" heading. */
function repeaterCells($: cheerio.CheerioAPI): { node: AnyNode; special: boolean }[] {
  const cells: { node: AnyNode; special: boolean }[] = [];
  let inSpecialSection = false;
  $('[data-testid="richTextElement"]').each((_i, el) => {
    if ($(el).attr('id')?.includes('__item')) {
      cells.push({ node: el, special: inSpecialSection });
      return;
    }
    const heading = cellBlocks($, el).join(' ');
    if (/^\w+ events$/i.test(heading)) inSpecialSection = /^special/i.test(heading);
  });
  return cells;
}

function parseDetailBlock(
  $: cheerio.CheerioAPI,
  heading: AnyNode,
  body: AnyNode,
  baseUrl: string
): Omit<DetailBlock, 'special'> {
  const text = cellBlocks($, body).join(' ').replace(/\s+/g, ' ');
  const href = $(body).find('a[href^="http"], a[href^="/"]').first().attr('href');
  return {
    heading: cellBlocks($, heading).join('\n'),
    body: text
      .replace(/\s*Find out more[^.]*\.?/i, '')
      .replace(/\s*-\s*more about .*$/i, '')
      .trim(),
    signUpUrl: href && /sign up/i.test(text) ? new URL(href, baseUrl).href : null,
  };
}

function parseCost(body: string | undefined): string | null {
  if (!body) return null;
  const price = body.match(/\$\d[^.\n]*/);
  if (price) return price[0].trim();
  return /\bfree\b|no charge/i.test(body) ? 'Free' : null;
}

function findDetail(title: string, details: DetailBlock[]): DetailBlock | undefined {
  const lookup = DETAIL_ALIASES[title] ?? title;
  return details.find((detail) => titleAppearsIn(lookup, detail.heading));
}

/** A detail heading's own time range, e.g. "Sundays Nov. 8 & 15\n4:00 -5:30 pm". */
function detailTimeText(detail: DetailBlock | undefined): string | null {
  const m = detail?.heading.match(/\d{1,2}(?::\d{2})?\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)/i);
  return m ? m[0] : null;
}

function buildEvent(
  title: string,
  startDate: string,
  gridTimeText: string,
  detail: DetailBlock | undefined,
  source: SourceConfig
): ScrapedEvent {
  // The grid's columns are retyped by hand and do slip out of order; the
  // detail block states each special event's time once.
  const { start, end } = parseTimeRange(detailTimeText(detail) ?? gridTimeText);
  return {
    title,
    description: detail?.body || null,
    start_date: startDate,
    end_date: null,
    start_time: start,
    end_time: end,
    // Everything here is in the one building. Left null, the matcher would
    // infer a venue from the text ("Virtually anyone..." → the Virtual location).
    location_name: source.default_location ?? null,
    cost: parseCost(detail?.body),
    registration_required: null,
    registration_url: detail?.signUpUrl ?? null,
    website: source.url,
    image_url: source.default_image ?? null,
  };
}

/** "Tuesday November 24\n6:30 - 8:30 pm\nOpen Mic" — a one-off that may not be in the grid. */
function parseDatedDetail(
  detail: DetailBlock,
  now: Date
): { date: string; timeText: string; title: string } | null {
  const [dateLine, timeText, title] = detail.heading.split('\n');
  const m = dateLine.match(/^[A-Za-z]+\.?,?\s+([A-Za-z]+)\.?\s+(\d{1,2})$/);
  if (!m || !title) return null;
  const month = monthIndex(m[1]);
  if (month === undefined) return null;
  return {
    date: isoDate(inferYear(month, now), month, Number(m[2])),
    timeText,
    title: cleanTitle(title),
  };
}

function assignSeries(events: ScrapedEvent[], source: SourceConfig): void {
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.title, (counts.get(event.title) ?? 0) + 1);

  for (const event of events) {
    if ((counts.get(event.title) ?? 0) < 2) {
      event.series_key = null;
      continue;
    }
    const slug = event.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    event.series_key = `${source.id}-${slug}`;
    event.series_parent_title = event.title;
    event.series_parent_website = source.url;
  }
}

export function parseRiverValleyEvents(
  html: string,
  source: SourceConfig,
  now: Date
): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const cells = repeaterCells($);

  const weeks: { range: WeekRange; dates: string[]; times: string[]; titles: string[] }[] = [];
  const details: DetailBlock[] = [];
  for (let i = 0; i < cells.length;) {
    const range = parseWeekHeader(cellBlocks($, cells[i].node).join(' '), now);
    if (range && i + 3 < cells.length) {
      const [dates, times, titles] = cells
        .slice(i + 1, i + 4)
        .map(({ node }) => cellBlocks($, node).map((text) => text.replace(/\s+/g, ' ')));
      weeks.push({ range, dates, times, titles });
      i += 4;
    } else if (i + 1 < cells.length) {
      const block = parseDetailBlock($, cells[i].node, cells[i + 1].node, source.url);
      details.push({ ...block, special: cells[i].special });
      i += 2;
    } else {
      i += 1;
    }
  }

  if (weeks.length === 0) throw new Error('No calendar weeks found; has the page layout changed?');

  const events: ScrapedEvent[] = [];
  for (const { range, dates, times, titles } of weeks) {
    if (dates.length !== times.length || dates.length !== titles.length) {
      console.log(
        `  WARN: skipping week of ${range.month + 1}/${range.startDay}: ` +
          `${dates.length} dates, ${times.length} times, ${titles.length} titles`
      );
      continue;
    }
    titles.forEach((rawTitle, row) => {
      const startDate = resolveCalendarDate(dates[row], range);
      const title = cleanTitle(rawTitle);
      if (!startDate || !title) return;
      const detail = findDetail(title, details);
      if (!SPECIAL_EVENT_TAG.test(rawTitle) && !detail?.special) return;
      events.push(buildEvent(title, startDate, times[row], detail, source));
    });
  }

  for (const detail of details.filter((block) => block.special)) {
    const dated = parseDatedDetail(detail, now);
    if (!dated) continue;
    const inGrid = events.some(
      (event) => event.start_date === dated.date && titleAppearsIn(event.title, dated.title)
    );
    if (!inGrid) events.push(buildEvent(dated.title, dated.date, dated.timeText, detail, source));
  }

  assignSeries(events, source);
  return events;
}

/** Self-fetching entry point; see SELF_FETCHERS in index.ts. */
export async function fetchRiverValleyCommons(
  source: SourceConfig,
  verbose: boolean
): Promise<ScrapedEvent[]> {
  const html = await fetchPage(source.url);
  const events = parseRiverValleyEvents(html, source, new Date());
  if (verbose) console.log(`  Parsed ${events.length} calendar rows`);
  return events;
}
