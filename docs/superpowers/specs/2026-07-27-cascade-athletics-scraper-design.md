# Cascade High School Athletics Scraper — Design

**Date:** 2026-07-27
**Status:** Approved (design), pending implementation plan
**Source:** `https://www.cascadekodiakathletics.com` (PlayOn Sports / VNN platform)

## Goal

Add a scraper that ingests **home varsity** games for Cascade High School (the
Kodiaks) into Der Town's staged events, tagged with the **`sports`** category,
each carrying the Kodiak logo as a default image.

## Site analysis (findings)

- **Platform:** PlayOn Sports / VNN, built on Next.js (app router). Pages are
  **fully server-rendered** — the event HTML (with stable `data-testid`
  attributes) is present in the raw response, so a plain `fetch` + `cheerio`
  scraper works with no headless browser, consistent with existing HTML sources.
- **Hard 10-event cap.** Every schedule view (the all-events `/schedule` page
  *and* each per-team page) renders at most **10 events**, with **no
  pagination**, no `page`/`offset` params, no infinite scroll, and no
  iCal/RSS/API export. Verified: the all-events page truncated at Sep 15 while
  volleyball alone runs to Oct 22; girls soccer stops at exactly 10 (Oct 6),
  mid-season.
- **Per-team pages** are the deepest reliable source: 10 events **per team**
  rather than 10 across the whole school. URL shape:
  `/sport/<slug>/schedule?team=<teamId>&year=<YYYY-YYYY>`.
  - Only the **`teamId`** drives the data; the `<slug>` just needs to be a valid
    sport slug (any real slug works). We use a fixed known-good slug constant.
  - `teamId`s **change every school year**, so they must be discovered at runtime.
- **Team discovery** — the homepage's raw HTML contains a Next.js RSC flight
  payload (`self.__next_f.push([...])`) listing **all teams for the year across
  all seasons**. Each team object exposes `id`, `displayName`
  (e.g. `"Girls Varsity Volleyball"`), `sport.name`, `gender.name`,
  `level.name` (`Varsity` / `Junior Varsity` / `Sophomore` / `Freshman` /
  `8th Grade`), `season.name` (`Fall`/`Winter`/`Spring`), and `year.name`.
  A regex over the payload cleanly yields **23 varsity teams** (validated).

### Per-event card fields (via `data-testid`)

Each event card exposes: `event-N-day-of-week` (`TUE`), `event-N-month-and-day`
(`Sep 8 2026`), `event-N-time` (`4:00 PM`), `event-N-activity-name`
(`VOLLEYBALL`), `event-N-gender-level` (`Girls Varsity`), `event-N-event-name`
(`Cascade High School, Kittitas Secondary School` — **home team listed first**),
`event-N-venue` (`Cascade High School (Leavenworth, WA)`). A `Home`/`Away` badge
`<span>` (no testid) is also present.

**Home detection:** an event is a home game when the `event-name` **starts with
`Cascade High School`** (home team first) and/or the badge reads `Home`. Away
games list Cascade second and are at opponent venues.

### Kodiak logo (default image)

Confirmed from the site header (`alt="Cascade High School Logo"`):

```
https://sportshub2-uploads.vnn-prod.zone/files/sites/2623/2020/10/09135212/Cascade.png
```

## Approach

**Per-team discovery + aggregation, home + varsity only.** One homepage fetch
discovers the season's varsity `teamId`s; each team's schedule page is then
fetched and parsed; home varsity games are kept. This maximizes coverage within
the 10-cap (10 per team, ~23 teams) and, combined with Der Town's existing dedup
and periodic re-scraping, accumulates the full home schedule as games rotate into
each team's window.

### Data flow

```
fetch homepage
  → parse RSC flight payload → list of varsity {teamId, sportLabel, gender}
  → for each varsity team:
        fetch /sport/<constSlug>/schedule?team=<id>&year=<schoolYear>
        → parse event cards (cheerio, data-testid)
        → keep HOME games only
        → build ScrapedEvent
  → aggregate → normalize → filter → match/dedup → write (existing pipeline)
```

`schoolYear` is computed from the current date (school year runs Aug–Jul, so
Aug 2026–Jul 2027 → `2026-2027`), so it rolls over automatically each year.

### Field mapping (`ScrapedEvent`)

| Field | Value |
|---|---|
| `title` | `Cascade {sportLabel} vs {opponent}` — `sportLabel` = team `displayName` minus the level word (e.g. `Girls Volleyball`, `Boys Basketball`, `Football`); `opponent` = the non-Cascade team from `event-name`, with `High School` / `Secondary School` / `H.S.` suffixes stripped. Example: **`Cascade Girls Volleyball vs Kittitas`**. |
| `description` | `Cascade High School home {sport} game vs {opponent}.` |
| `start_date` | from `event-N-month-and-day` (`Sep 8 2026` → `2026-09-08`) |
| `start_time` | from `event-N-time` (`4:00 PM` → `16:00`, via existing `parseTime12h`) |
| `end_time` / `end_date` | `null` (site provides no end time) |
| `location_name` | `event-N-venue`, with the trailing `(Leavenworth, WA)` address stripped → `Cascade High School` or `Cascade Upper (Bus Garage)` |
| `website` | the team schedule URL |
| `image_url` | Kodiak logo (via new `default_image`, see below) |
| `cost` / `registration_*` | `null` / `false` |
| primary tag | `sports` (via `default_tag`) |

## Code changes

### 1. `SourceConfig` — new `default_image` field (`src/lib/scraper/types.ts`)

```ts
default_image?: string | null; // fallback image_url for events with none
```

Applied generically in `scrapeSource` (`index.ts`) inside the
normalize/filter loop, so it's reusable by any future source:

```ts
if (!event.image_url && source.default_image) event.image_url = source.default_image;
```

### 2. Self-fetching source dispatch (`src/lib/scraper/index.ts` + new module)

Cascade needs custom multi-page fetching (discover → fetch N team pages), like
`json-api` sources already self-fetch. Mirror the existing id-keyed `EXTRACTORS`
dispatch with a parallel `SELF_FETCHERS` map so `index.ts` stays generic:

```ts
// in scrapeSource, before the generic html branch:
const selfFetcher = SELF_FETCHERS[source.id];
if (selfFetcher) {
  rawEvents = await selfFetcher(source, verbose); // fetch + parse, returns ScrapedEvent[]
} else if (source.type === 'json-api') { ... } else { ...existing html/ical... }
```

New module `src/lib/scraper/parse-cascade.ts` (name TBD in plan) exporting
`fetchCascadeAthletics(source, verbose): Promise<ScrapedEvent[]>`, which:

1. `fetchPage(source.url)` (homepage).
2. Parse the flight payload → varsity teams (regex for team objects; keep
   `level.name === 'Varsity'`; capture `id`, `displayName`, `gender`).
3. For each varsity team, `fetchPage(teamScheduleUrl)` and parse cards with a
   `cheerio` helper `extractCascadeCards(html, team)`; keep home games; build
   `ScrapedEvent`s. Wrap each team fetch in try/catch (one bad team ≠ whole run).
4. Return the aggregated array.

Reuse existing helpers (`parseTime12h`, `extractVenueNameFromLocationText`,
`resolveUrl`). No detail-page enrichment needed.

### 3. `scrape/sources.yaml` — new source entry

```yaml
  - id: 'cascade-athletics'
    name: 'Cascade High School Athletics'
    url: 'https://www.cascadekodiakathletics.com'
    type: 'html'
    default_organization: 'Cascade High School'   # create org row if missing
    default_location: 'Cascade High School'         # create location row if missing
    default_tag: 'sports'
    default_image: 'https://sportshub2-uploads.vnn-prod.zone/files/sites/2623/2020/10/09135212/Cascade.png'
    location_map:
      'Cascade Upper (Bus Garage)': 'Kodiak Field'   # dedicated location; create row if missing
    geo_filter: null   # home-only filter already restricts to Leavenworth venues
```

### 4. Tag + reference rows

- Ensure a **`sports`** row exists in the `tags` table (the `sports` group is
  already defined in `tag_keywords`). Verify/create.
- `Cascade High School` organization and location rows: the pipeline
  auto-records unmatched names via `organization_added` / `location_added`, but
  creating canonical rows up front gives clean matching.

## Testing

- Unit test `extractCascadeCards` against a saved team-schedule HTML fixture:
  asserts home/away split, varsity filtering, date/time parse, title/opponent
  formatting, venue cleanup.
- Unit test the flight-payload parser against a saved homepage fixture: asserts
  the 23 varsity teams and correct `id`/`displayName` extraction.
- Dry run: `make scrape ARGS="--source cascade-athletics --verbose"` (no writes),
  eyeball extracted home varsity events; then `--remote` when satisfied.
- Reuse project TZ convention (`America/Los_Angeles`) in date/time tests.

## Known limitations (accepted)

- **>10-game sports** (soccer ~14, basketball ~20) show only their first/next 10
  per fetch. Games 11+ surface only after earlier ones pass, so regular
  (e.g. weekly) in-season scraping is needed for complete coverage. No
  full-season export exists on the site to avoid this.
- Team `slug`↔`id` mapping is bypassed (fixed slug constant). If VNN changes
  routing so slug must match id, discovery must also capture each team's slug
  (available in the flight payload) — low risk, noted for maintenance.

## Decisions locked with user

- Coverage: **per-team discovery + aggregation** (not the all-events page).
- Levels: **Varsity only** (exclude JV / C-Team / Sophomore / Freshman).
- Title format: **`Cascade {sportLabel} vs {opponent}`**, gender retained in
  `sportLabel` for disambiguation (`Cascade Girls Soccer vs Chelan`).

## Open items for plan/review

1. `Cascade Upper (Bus Garage)` maps to the **`Kodiak Field`** location (create
   the row if it doesn't exist). Home games at `Cascade High School` map to a
   `Cascade High School` location.
2. Confirm the `sports` tag row exists in production.
