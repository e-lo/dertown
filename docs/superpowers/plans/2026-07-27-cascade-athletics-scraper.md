# Cascade Athletics Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scrape home varsity games for Cascade High School (cascadekodiakathletics.com) into Der Town's staged events, tagged `sports`, each carrying the Kodiak logo.

**Architecture:** A self-fetching source. One homepage fetch discovers the season's varsity `teamId`s from the Next.js RSC flight payload; each team's schedule page is fetched and parsed for home games via `cheerio` + `data-testid` selectors; results flow through the existing normalize → filter → match/dedup → write pipeline. Wired in through a new `SELF_FETCHERS` dispatch map (keyed by source id, mirroring the existing `EXTRACTORS` map), so `index.ts` stays generic.

**Tech Stack:** TypeScript, `tsx` (standalone test scripts using `node:assert/strict`), `cheerio`, the existing scraper pipeline in `src/lib/scraper/`.

**Reference spec:** `docs/superpowers/specs/2026-07-27-cascade-athletics-scraper-design.md`

---

## File Structure

- **Create** `src/lib/scraper/parse-cascade.ts` — all Cascade-specific logic: school-year helper, flight-payload team discovery, per-card extraction, and the `fetchCascadeAthletics` orchestrator. Single responsibility: turn cascadekodiakathletics.com into `ScrapedEvent[]`.
- **Create** `src/lib/__tests__/scraper-cascade-discovery.test.ts` — unit tests for `currentSchoolYear` + `parseVarsityTeams`.
- **Create** `src/lib/__tests__/scraper-cascade-cards.test.ts` — unit tests for `extractCascadeCards` (+ `parseCascadeDate`, `cleanOpponent`, `teamScheduleUrl`).
- **Modify** `src/lib/scraper/types.ts` — add `default_image?` to `SourceConfig`.
- **Modify** `src/lib/scraper/parse-html.ts` — `export` the existing `parseTime12h` for reuse.
- **Modify** `src/lib/scraper/index.ts` — add `SELF_FETCHERS` dispatch and call it in `scrapeSource`.
- **Modify** `scrape/sources.yaml` — add the `cascade-athletics` source entry.
- **Modify** `package.json` — add two `test:*` scripts.

Key exported interface (defined in Task 3, used in Tasks 4–6):

```ts
export interface VarsityTeam {
  id: string;        // team id for the schedule URL
  sportLabel: string; // e.g. "Girls Volleyball", "Football" (displayName minus "Varsity")
  slug: string;       // e.g. "girls-volleyball" (from gender + sport), for the URL path
}
```

---

## Task 1: Add `default_image` to `SourceConfig`

**Files:**
- Modify: `src/lib/scraper/types.ts:88` (inside the `SourceConfig` interface)

- [ ] **Step 1: Add the field**

In `src/lib/scraper/types.ts`, inside `interface SourceConfig`, add after the `default_tag` line:

```ts
  default_tag?: string | null;
  default_image?: string | null; // fallback image_url for events that have none
```

- [ ] **Step 2: Verify it type-checks (lint parses the file)**

Run: `npx eslint src/lib/scraper/types.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scraper/types.ts
git commit -m "feat(scraper): add default_image field to SourceConfig"
```

---

## Task 2: `currentSchoolYear` helper + new module

**Files:**
- Create: `src/lib/scraper/parse-cascade.ts`
- Create: `src/lib/__tests__/scraper-cascade-discovery.test.ts`
- Modify: `package.json` (add test script)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/scraper-cascade-discovery.test.ts`:

```ts
import assert from 'node:assert/strict';
import { currentSchoolYear } from '../scraper/parse-cascade';

function run() {
  // July (month 6) and later belong to the upcoming school year.
  assert.equal(currentSchoolYear(new Date(2026, 6, 27)), '2026-2027', 'late July → new year');
  assert.equal(currentSchoolYear(new Date(2026, 8, 8)), '2026-2027', 'September → same year');
  assert.equal(currentSchoolYear(new Date(2027, 0, 16)), '2026-2027', 'January → prior calendar year');
  // Before July belongs to the year that started the previous August.
  assert.equal(currentSchoolYear(new Date(2026, 2, 1)), '2025-2026', 'March → prior school year');

  console.log('scraper-cascade-discovery tests passed');
}

run();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx src/lib/__tests__/scraper-cascade-discovery.test.ts`
Expected: FAIL — cannot find module `../scraper/parse-cascade` (file does not exist yet).

- [ ] **Step 3: Create the module with the minimal implementation**

Create `src/lib/scraper/parse-cascade.ts`:

```ts
/**
 * Cascade High School Athletics (cascadekodiakathletics.com) — PlayOn / VNN.
 * Self-fetching source: discover the season's varsity team ids from the
 * homepage RSC flight payload, then fetch each team's schedule page (which
 * caps at 10 events) and keep home games.
 */

/** School year runs Aug–Jul; July onward maps to the upcoming year. */
export function currentSchoolYear(now: Date): string {
  const year = now.getFullYear();
  const startYear = now.getMonth() >= 6 ? year : year - 1; // month 6 = July
  return `${startYear}-${startYear + 1}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx src/lib/__tests__/scraper-cascade-discovery.test.ts`
Expected: PASS — prints `scraper-cascade-discovery tests passed`.

- [ ] **Step 5: Add the test script to package.json**

In `package.json` `scripts`, add after the `test:scraper-ical-timezone` line:

```json
    "test:scraper-cascade-discovery": "tsx src/lib/__tests__/scraper-cascade-discovery.test.ts",
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/scraper/parse-cascade.ts src/lib/__tests__/scraper-cascade-discovery.test.ts package.json
git commit -m "feat(scraper): add currentSchoolYear helper for cascade athletics"
```

---

## Task 3: `parseVarsityTeams` — flight-payload discovery

**Files:**
- Modify: `src/lib/scraper/parse-cascade.ts`
- Modify: `src/lib/__tests__/scraper-cascade-discovery.test.ts`

The homepage embeds team data in `self.__next_f.push([...])` chunks. Each team object looks like (quotes are backslash-escaped in the real HTML):

```
{"id":"7866316","displayName":"Girls Varsity Volleyball", ... ,"gender":{"id":"2","name":"Girls"},"sport":{"id":"64","name":"Volleyball"},"level":{"id":"1","name":"Varsity"}, ... }
```

The parser tolerates optional backslash-escaping (`\\?"`) so it works on both the real (escaped) HTML and clean-quote test fixtures. We keep only `level.name === "Varsity"`. `sportLabel` comes from `displayName` minus the word "Varsity"; `slug` comes from `gender.name` + `sport.name` (reliable even when `displayName` omits gender, e.g. "Varsity Football").

- [ ] **Step 1: Write the failing test**

Append to `run()` in `src/lib/__tests__/scraper-cascade-discovery.test.ts`, and add the import at the top:

```ts
import { currentSchoolYear, parseVarsityTeams } from '../scraper/parse-cascade';
```

Add before the final `console.log` in `run()`:

```ts
  // A minimal flight payload: one varsity team, one JV team (must be dropped),
  // and one gender-less-displayName varsity team (football).
  const payload = [
    '<script>self.__next_f.push([1,"51:[',
    '{"id":"7866316","displayName":"Girls Varsity Volleyball","homeDescription":null,',
    '"gender":{"id":"2","name":"Girls"},"sport":{"id":"64","name":"Volleyball"},',
    '"level":{"id":"1","name":"Varsity"},"season":{"id":"1","name":"Fall"}},',
    '{"id":"7866317","displayName":"Girls Junior Varsity Volleyball","homeDescription":null,',
    '"gender":{"id":"2","name":"Girls"},"sport":{"id":"64","name":"Volleyball"},',
    '"level":{"id":"2","name":"Junior Varsity"},"season":{"id":"1","name":"Fall"}},',
    '{"id":"7866314","displayName":"Varsity Football","homeDescription":null,',
    '"gender":{"id":"1","name":"Boys"},"sport":{"id":"30","name":"Football"},',
    '"level":{"id":"1","name":"Varsity"},"season":{"id":"1","name":"Fall"}}',
    ']"])</script>',
  ].join('');

  const teams = parseVarsityTeams(payload);
  assert.equal(teams.length, 2, 'only the two varsity teams are kept');

  const vb = teams.find((t) => t.id === '7866316');
  assert.ok(vb, 'volleyball team present');
  assert.equal(vb!.sportLabel, 'Girls Volleyball', 'sportLabel strips "Varsity"');
  assert.equal(vb!.slug, 'girls-volleyball', 'slug from gender + sport');

  const fb = teams.find((t) => t.id === '7866314');
  assert.ok(fb, 'football team present');
  assert.equal(fb!.sportLabel, 'Football', 'football sportLabel');
  assert.equal(fb!.slug, 'boys-football', 'football slug uses payload gender');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx src/lib/__tests__/scraper-cascade-discovery.test.ts`
Expected: FAIL — `parseVarsityTeams` is not exported / not a function.

- [ ] **Step 3: Implement `parseVarsityTeams`**

Add to `src/lib/scraper/parse-cascade.ts`:

```ts
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
    const sportLabel = displayName.replace(/\bVarsity\b/i, '').replace(/\s+/g, ' ').trim();

    teams.push({ id, sportLabel, slug });
  }

  return teams;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx src/lib/__tests__/scraper-cascade-discovery.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scraper/parse-cascade.ts src/lib/__tests__/scraper-cascade-discovery.test.ts
git commit -m "feat(scraper): discover cascade varsity teams from flight payload"
```

---

## Task 4: `extractCascadeCards` — per-team home-game extraction

**Files:**
- Modify: `src/lib/scraper/parse-html.ts:472` (add `export` to `parseTime12h`)
- Modify: `src/lib/scraper/parse-cascade.ts`
- Create: `src/lib/__tests__/scraper-cascade-cards.test.ts`
- Modify: `package.json` (add test script)

Each event card exposes numbered `data-testid`s: `event-N-month-and-day` (`Sep 8 2026`), `event-N-time` (`4:00 PM`), `event-N-event-name` (`Cascade High School, Kittitas Secondary School` — home team first), `event-N-venue` (`Cascade High School (Leavenworth, WA)`). The mobile and desktop layouts each render the same testid, so we group by event index and keep the first value per field. Home games are those whose `event-name` starts with a Cascade segment; the opponent is the non-Cascade segment.

- [ ] **Step 1: Export `parseTime12h` from parse-html.ts**

In `src/lib/scraper/parse-html.ts`, change line 472 from:

```ts
function parseTime12h(raw: string): string | null {
```

to:

```ts
export function parseTime12h(raw: string): string | null {
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/__tests__/scraper-cascade-cards.test.ts`:

```ts
import assert from 'node:assert/strict';
import {
  extractCascadeCards,
  parseCascadeDate,
  cleanOpponent,
  teamScheduleUrl,
  type VarsityTeam,
} from '../scraper/parse-cascade';
import type { SourceConfig } from '../scraper/types';

const LOGO = 'https://sportshub2-uploads.vnn-prod.zone/files/sites/2623/2020/10/09135212/Cascade.png';

const source = {
  id: 'cascade-athletics',
  name: 'Cascade High School Athletics',
  url: 'https://www.cascadekodiakathletics.com',
  type: 'html',
  default_image: LOGO,
} as SourceConfig;

const team: VarsityTeam = { id: '7866316', sportLabel: 'Girls Volleyball', slug: 'girls-volleyball' };

/** One home card (Cascade first) and one away card (Cascade second). */
function fixture(): string {
  return `
    <div>
      <span data-testid="event-1-month-and-day">Sep 8 2026</span>
      <span data-testid="event-1-time">6:30 PM</span>
      <span data-testid="event-1-event-name">Cascade High School, Kittitas Secondary School</span>
      <span data-testid="event-1-venue">Cascade High School (Leavenworth, WA)</span>
    </div>
    <div>
      <span data-testid="event-2-month-and-day">Sep 15 2026</span>
      <span data-testid="event-2-time">5:00 PM</span>
      <span data-testid="event-2-event-name">Omak High School, Cascade High School</span>
      <span data-testid="event-2-venue">Omak H.S (Omak, WA)</span>
    </div>`;
}

function run() {
  assert.equal(parseCascadeDate('Sep 8 2026'), '2026-09-08');
  assert.equal(parseCascadeDate('Oct 22 2026'), '2026-10-22');
  assert.equal(parseCascadeDate('garbage'), null);

  assert.equal(cleanOpponent('Kittitas Secondary School'), 'Kittitas');
  assert.equal(cleanOpponent('Quincy High School'), 'Quincy');
  assert.equal(cleanOpponent('Omak H.S'), 'Omak');

  assert.equal(
    teamScheduleUrl(team, '2026-2027'),
    'https://www.cascadekodiakathletics.com/sport/girls-volleyball/schedule?team=7866316&year=2026-2027'
  );

  const url = teamScheduleUrl(team, '2026-2027');
  const events = extractCascadeCards(fixture(), team, url, source);

  assert.equal(events.length, 1, 'only the home game is kept');
  const e = events[0];
  assert.equal(e.title, 'Cascade Girls Volleyball vs Kittitas');
  assert.equal(e.start_date, '2026-09-08');
  assert.equal(e.start_time, '18:30');
  assert.equal(e.end_time, null);
  assert.equal(e.location_name, 'Cascade High School', 'venue address suffix stripped');
  assert.equal(e.website, url);
  assert.equal(e.image_url, LOGO, 'default image applied');
  assert.equal(e.description, 'Cascade High School home girls volleyball game vs Kittitas.');

  console.log('scraper-cascade-cards tests passed');
}

run();
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx tsx src/lib/__tests__/scraper-cascade-cards.test.ts`
Expected: FAIL — `extractCascadeCards` / helpers not exported.

- [ ] **Step 4: Implement the extractor and helpers**

Add to `src/lib/scraper/parse-cascade.ts` (add the imports at the top of the file):

```ts
import * as cheerio from 'cheerio';
import type { ScrapedEvent, SourceConfig } from './types';
import { parseTime12h } from './parse-html';

const BASE_URL = 'https://www.cascadekodiakathletics.com';

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
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
    const venue =
      (rec['venue'] || '').replace(/\s*\([^)]*\)\s*$/, '').trim() || null;

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
```

- [ ] **Step 5: Run both scraper-cascade tests to verify they pass**

Run: `npx tsx src/lib/__tests__/scraper-cascade-cards.test.ts && npx tsx src/lib/__tests__/scraper-cascade-discovery.test.ts`
Expected: both print `... tests passed`.

- [ ] **Step 6: Add the cards test script to package.json**

In `package.json` `scripts`, add after the `test:scraper-cascade-discovery` line:

```json
    "test:scraper-cascade-cards": "tsx src/lib/__tests__/scraper-cascade-cards.test.ts",
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/scraper/parse-cascade.ts src/lib/scraper/parse-html.ts src/lib/__tests__/scraper-cascade-cards.test.ts package.json
git commit -m "feat(scraper): extract cascade home varsity games from team pages"
```

---

## Task 5: `fetchCascadeAthletics` orchestrator

**Files:**
- Modify: `src/lib/scraper/parse-cascade.ts`

This ties discovery + per-team fetching together. It performs network I/O, so it is verified by the dry run in Task 7 rather than a unit test (its pure pieces are already tested).

- [ ] **Step 1: Implement the orchestrator**

Add to `src/lib/scraper/parse-cascade.ts` (add `fetchPage` to the imports):

```ts
import { fetchPage } from './fetch';
```

```ts
/**
 * Self-fetching entry point: discover varsity teams from the homepage, then
 * fetch each team's schedule page and collect home games. One failing team
 * page is logged and skipped rather than aborting the whole run.
 */
export async function fetchCascadeAthletics(
  source: SourceConfig,
  verbose: boolean
): Promise<ScrapedEvent[]> {
  const year = currentSchoolYear(new Date());
  const homepage = await fetchPage(source.url);
  const teams = parseVarsityTeams(homepage);
  if (verbose) console.log(`  Discovered ${teams.length} varsity teams (year ${year})`);

  const all: ScrapedEvent[] = [];
  for (const team of teams) {
    const url = teamScheduleUrl(team, year);
    try {
      const html = await fetchPage(url);
      const cards = extractCascadeCards(html, team, url, source);
      if (verbose) console.log(`  ${team.sportLabel}: ${cards.length} home game(s)`);
      all.push(...cards);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (verbose) console.log(`  WARN: ${team.sportLabel} (${url}) failed: ${msg}`);
    }
  }

  return all;
}
```

- [ ] **Step 2: Verify the module lints and type-resolves**

Run: `npx eslint src/lib/scraper/parse-cascade.ts`
Expected: no errors.

- [ ] **Step 3: Re-run the unit tests (imports still resolve)**

Run: `npx tsx src/lib/__tests__/scraper-cascade-cards.test.ts && npx tsx src/lib/__tests__/scraper-cascade-discovery.test.ts`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/scraper/parse-cascade.ts
git commit -m "feat(scraper): add fetchCascadeAthletics orchestrator"
```

---

## Task 6: Wire into the pipeline

**Files:**
- Modify: `src/lib/scraper/index.ts` (imports near line 20; `scrapeSource` fetch branch near line 137)
- Modify: `scrape/sources.yaml`

- [ ] **Step 1: Import the orchestrator and add the dispatch map**

In `src/lib/scraper/index.ts`, add to the import near line 20:

```ts
import { parseHtml } from './parse-html';
import { fetchCascadeAthletics } from './parse-cascade';
```

Then, immediately after the imports block (before `scrapeSource` is defined, near line 112), add:

```ts
// Sources that fetch their own pages (multi-page crawl) rather than a single URL.
// Keyed by source id, mirroring the EXTRACTORS dispatch in parse-html.ts.
type SelfFetcher = (source: SourceConfig, verbose: boolean) => Promise<ScrapedEvent[]>;
const SELF_FETCHERS: Record<string, SelfFetcher> = {
  'cascade-athletics': fetchCascadeAthletics,
};
```

- [ ] **Step 2: Call the dispatch in `scrapeSource`**

In `src/lib/scraper/index.ts`, replace the fetch/parse block that starts at line 138 (`let rawEvents: ScrapedEvent[];`) so the self-fetcher is checked first. The existing block is:

```ts
    let rawEvents: ScrapedEvent[];
    if (source.type === 'json-api') {
```

Change it to:

```ts
    let rawEvents: ScrapedEvent[];
    const selfFetcher = SELF_FETCHERS[source.id];
    if (selfFetcher) {
      if (verbose) console.log(`  Self-fetching ${source.name}...`);
      rawEvents = await selfFetcher(source, verbose);
    } else if (source.type === 'json-api') {
```

(The rest of the `if/else` chain and the trailing `}` are unchanged.)

- [ ] **Step 3: Add the source entry to sources.yaml**

In `scrape/sources.yaml`, add a new entry under `sources:` (after the `wri` entry):

```yaml
  - id: 'cascade-athletics'
    name: 'Cascade High School Athletics'
    url: 'https://www.cascadekodiakathletics.com'
    type: 'html'
    default_organization: 'Cascade High School'
    default_location: 'Cascade High School'
    default_tag: 'sports'
    default_image: 'https://sportshub2-uploads.vnn-prod.zone/files/sites/2623/2020/10/09135212/Cascade.png'
    location_map:
      'Cascade Upper (Bus Garage)': 'Kodiak Field'
    geo_filter: null
```

- [ ] **Step 4: Verify index.ts lints**

Run: `npx eslint src/lib/scraper/index.ts`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scraper/index.ts scrape/sources.yaml
git commit -m "feat(scraper): wire cascade-athletics self-fetching source"
```

---

## Task 7: Dry-run verification + docs

**Files:**
- Modify: `docs/feature-event-scraper.md` (if it lists sources) and/or `scrape/README.md`

- [ ] **Step 1: Run the full dry run (no DB writes)**

Run: `make scrape ARGS="--source cascade-athletics --verbose"`
Expected: logs `Discovered N varsity teams`, then per-team `M home game(s)` lines; a parsed-events summary with home varsity games only. Confirm in the output:
- Titles read `Cascade <Sport> vs <Opponent>`.
- No `Away` games appear (spot-check opponents/venues are Cascade/Leavenworth home venues).
- Dates/times look right (e.g. `18:30`, not `6:30 PM`).
- No crash if a team page 404s (logged as `WARN`).

If something is off, fix the relevant module, re-run its unit test, then re-run the dry run.

- [ ] **Step 2: Sanity-check the tag and locations exist (read-only)**

Confirm a `sports` row exists in the `tags` table, and that `Cascade High School` and `Kodiak Field` locations exist (or will be recorded via `location_added`). This is a read-only check against the configured Supabase (per the project's deploy-and-verify workflow); create the `tags`/locations rows if missing before a write-mode run.

- [ ] **Step 3: Update source docs**

Add a one-line entry for `cascade-athletics` to `scrape/README.md`'s source list (match the existing format), noting it is a self-fetching PlayOn/VNN source limited to home varsity games and capped at 10 events per team page.

- [ ] **Step 4: Commit**

```bash
git add scrape/README.md
git commit -m "docs(scraper): document cascade-athletics source"
```

- [ ] **Step 5: Live write run (when ready)**

When the dry run looks correct: `make scrape ARGS="--source cascade-athletics --remote --verbose"` to stage events, then review them in the admin queue. (This writes to production per the deploy-and-verify workflow — run only when satisfied.)

---

## Self-Review notes

- **Spec coverage:** discovery (Task 3), 10-cap handling via per-team fetch (Tasks 3/5), home+varsity filter (Tasks 3/4), title/description/venue/image mapping (Task 4), `default_image` field (Task 1), self-fetch wiring (Task 6), `sports` tag + `Kodiak Field` mapping (Tasks 6/7), tests + dry run (Tasks 2–7). All spec sections map to a task.
- **Type consistency:** `VarsityTeam` (`id`/`sportLabel`/`slug`) is defined in Task 3 and used unchanged in Tasks 4–5; `extractCascadeCards(html, team, pageUrl, source)` signature matches its Task 4 test and its Task 5 caller; `parseTime12h` is exported in Task 4 before Task 4's implementation imports it.
- **Known limitation (accepted):** sports with >10 games surface later games only as earlier ones pass; regular in-season scraping is required. Documented in Task 7 Step 3 and the spec.
