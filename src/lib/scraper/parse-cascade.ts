/**
 * Cascade High School Athletics (cascadekodiakathletics.com) — PlayOn / VNN.
 * Self-fetching source: discover the season's varsity team ids from the
 * homepage RSC flight payload, then fetch each team's schedule page (which
 * caps at 10 events) and keep home games.
 */

import * as cheerio from 'cheerio';
import type { ScrapedEvent, SourceConfig } from './types';
import { parseTime12h } from './parse-html';

/** School year runs Aug–Jul; July onward maps to the upcoming year. */
export function currentSchoolYear(now: Date): string {
  const year = now.getFullYear();
  const startYear = now.getMonth() >= 6 ? year : year - 1; // month 6 = July
  return `${startYear}-${startYear + 1}`;
}

export interface VarsityTeam {
  id: string;
  sportLabel: string;
  slug: string;
}

/** Match `"key":{ ... "name":"VALUE"` tolerating backslash-escaped quotes. */
function nestedName(window: string, key: string): string | null {
  const re = new RegExp(
    String.raw`\\?"` + key + String.raw`\\?":\{[^}]*?\\?"name\\?":\\?"([^"\\]+)`
  );
  return re.exec(window)?.[1] ?? null;
}

/** Extract varsity teams from the homepage RSC flight payload. */
export function parseVarsityTeams(html: string): VarsityTeam[] {
  const teams: VarsityTeam[] = [];
  const seen = new Set<string>();
  const teamRe = /\\?"id\\?":\\?"(\d{6,})\\?",\\?"displayName\\?":\\?"([^"\\]+)/g;

  let m: RegExpExecArray | null;
  while ((m = teamRe.exec(html)) !== null) {
    const id = m[1];
    const displayName = m[2];
    const window = html.slice(m.index, m.index + 600);

    const level = nestedName(window, 'level');
    if (level !== 'Varsity') continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const gender = nestedName(window, 'gender') ?? '';
    const sport = nestedName(window, 'sport') ?? '';
    const slug = `${gender} ${sport}`
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z-]/g, '');
    const sportLabel = displayName
      .replace(/\bVarsity\b/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    teams.push({ id, sportLabel, slug });
  }

  return teams;
}

const BASE_URL = 'https://www.cascadekodiakathletics.com';

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** "Sep 8 2026" → "2026-09-08". Returns null if unparseable. */
export function parseCascadeDate(raw: string): string | null {
  const m = raw.trim().match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (month === undefined) return null;
  const day = String(Number(m[2])).padStart(2, '0');
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${day}`;
}

/** Strip school-name suffixes from an opponent name. */
export function cleanOpponent(name: string): string {
  return name
    .replace(/\b(High School|Secondary School|Middle School|Junior High)\b/gi, '')
    .replace(/\bH\.?S\.?\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function teamScheduleUrl(team: VarsityTeam, year: string): string {
  return `${BASE_URL}/sport/${team.slug}/schedule?team=${team.id}&year=${year}`;
}

/**
 * Parse a team schedule page into home-game ScrapedEvents.
 * Cards use numbered `event-N-*` data-testids, rendered twice (mobile+desktop);
 * we group by index and keep the first value per field.
 */
export function extractCascadeCards(
  html: string,
  team: VarsityTeam,
  pageUrl: string,
  source: SourceConfig
): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const byIndex = new Map<number, Record<string, string>>();

  $('[data-testid]').each((_i, el) => {
    const testid = $(el).attr('data-testid') || '';
    const match = testid.match(/^event-(\d+)-(.+)$/);
    if (!match) return;
    const idx = Number(match[1]);
    const field = match[2];
    let rec = byIndex.get(idx);
    if (!rec) {
      rec = {};
      byIndex.set(idx, rec);
    }
    if (!(field in rec)) rec[field] = $(el).text().replace(/\s+/g, ' ').trim();
  });

  const events: ScrapedEvent[] = [];
  for (const rec of byIndex.values()) {
    const parts = (rec['event-name'] || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length < 2) continue;

    // Home games list Cascade first (matches the "Home" badge).
    if (!/cascade/i.test(parts[0])) continue;

    const opponentRaw = parts.find((p) => !/cascade/i.test(p));
    if (!opponentRaw) continue;
    const opponent = cleanOpponent(opponentRaw);

    const start_date = parseCascadeDate(rec['month-and-day'] || '');
    if (!start_date) continue;

    const start_time = parseTime12h(rec['time'] || '') || null;
    const venue = (rec['venue'] || '').replace(/\s*\([^)]*\)\s*$/, '').trim() || null;

    events.push({
      title: `Cascade ${team.sportLabel} vs ${opponent}`,
      description: `Cascade High School home ${team.sportLabel.toLowerCase()} game vs ${opponent}.`,
      start_date,
      end_date: null,
      start_time,
      end_time: null,
      location_name: venue,
      cost: null,
      registration_required: false,
      registration_url: null,
      website: pageUrl,
      image_url: source.default_image ?? null,
    });
  }

  return events;
}
