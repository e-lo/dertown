# Feature: Automated Event Scraping

## Overview

A CLI-driven system that scrapes event listings from local venue websites, extracts structured event data, and feeds them into the existing staged-event review workflow for admin approval before going live on the Der Town site.

---

## Goals

- Discover new events from configured venue websites on-demand
- Detect and auto-apply minor updates to previously scraped events
- Fill out all available event fields (date, time, location, tag, cost, description, etc.)
- Minimize cost: zero infrastructure cost, near-zero AI cost (~$0.01-0.05 per full scrape run)
- Use deterministic parsing where possible; AI only as fallback for unstructured HTML

---

## Non-Goals (for now)

- Automated scheduling (cron) — manual CLI trigger is sufficient
- Real-time monitoring or webhooks from source sites
- Scraping Instagram/Facebook feeds automatically (manual paste workflow instead)
- Full headless browser rendering (avoid Puppeteer/Playwright dependency if possible)

---

## Existing Database Infrastructure

The database already has tables supporting this feature:

### `source_sites` table
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | string | Source display name |
| `url` | string | Source calendar URL |
| `organization_id` | uuid? | FK to organizations (optional default org for events from this source) |
| `event_tag_id` | uuid? | FK to tags (optional default tag for events from this source) |
| `extraction_function` | string? | Name of the extraction function to use |
| `import_frequency` | enum? | `'hourly' | 'daily' | 'weekly' | 'manual'` |
| `last_scraped` | timestamp? | Last successful scrape |
| `last_status` | string? | Last scrape result status |
| `last_error` | string? | Last error message |

### `scrape_logs` table
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `source_id` | uuid | FK to source_sites |
| `status` | string | Scrape result status |
| `error_message` | string? | Error details |
| `timestamp` | timestamp? | When the scrape ran |

### Existing foreign keys
- `events.source_id` → `source_sites.id`
- `events_staged.source_id` → `source_sites.id`

---

## Source Sites

### Initial sources to configure

| Source | URL | Data Format | Extraction Strategy | Geo Filter Needed |
|--------|-----|-------------|--------------------|--------------------|
| Icicle Creek Center | `https://icicle.org` (find-events page) | Plain HTML | HTML parser, AI fallback | No (all local) |
| NCW Libraries | `https://ncwlibraries.libcal.com/calendar/...` | JS-rendered; has iCal infrastructure + AJAX API | Try iCal feed (`ical_subscribe.php`), else AJAX JSON endpoints | Yes (filter to Leavenworth library) |
| Ski Leavenworth | `https://skileavenworth.com/events` | Plain HTML | HTML parser | No (all local) |
| Leavenworth.org | `https://leavenworth.org/calendar/` | HTML + JSON-LD (page-level); WordPress Events Calendar plugin | Try WP iCal export (`?ical=1`), else HTML parser | No (all local) |
| Wenatchee River Institute | `https://wenatcheeriverinstitute.org/event-calendar.html` | Plain HTML | HTML parser | No (all local) |

### Source configuration file

Each source is configured in both:
1. **Database** (`source_sites` table) — stores runtime state (`last_scraped`, `last_status`) and references to existing org/tag records
2. **Config file** (`scrape/sources.yaml` in repo) — stores extraction rules, selectors, geo filters, and field mappings that are version-controlled

```yaml
# scrape/sources.yaml
sources:
  - id: "icicle-creek"           # matches source_sites.id or name
    name: "Icicle Creek Center"
    url: "https://icicle.org/find-events/"
    type: "html"                  # html | ical | json-api
    selectors:                    # CSS selectors for HTML extraction
      event_list: ".events-list .event-item"   # to be determined during implementation
      title: "h3.event-title"
      date: ".event-date"
      time: ".event-time"
      description: ".event-description"
      link: "a.event-link"
      image: "img.event-image"
    geo_filter: null              # no filtering needed
    default_organization: "Icicle Creek Center for the Arts"
    default_location: null        # varies per event
    exclude: null                 # no exclusions needed

  - id: "ncw-libraries"
    name: "NCW Libraries"
    url: "https://ncwlibraries.libcal.com/calendar/..."
    type: "ical"                  # try iCal first
    ical_url: "https://ncwlibraries.libcal.com/ical_subscribe.php?src=p"  # to verify
    fallback_type: "json-api"
    api_url: "https://ncwlibraries.libcal.com/ajax/calendar/list"
    geo_filter:
      location_keywords: ["leavenworth", "peshastin"]
    default_organization: "NCW Libraries"
    exclude: null

  - id: "leavenworth-org"
    name: "Leavenworth.org"
    url: "https://leavenworth.org/calendar/"
    type: "html"
    # Exclude generic bar/restaurant live music that clutters the calendar
    exclude:
      title_keywords: ["live music at", "open mic night", "karaoke"]
      # Can also exclude by venue name or other fields
      location_keywords: ["visconti's", "J5 Coffee"]

  # ... etc for each source
```

#### Source exclusion rules

Each source can define `exclude` rules to skip events that aren't relevant. This prevents noise like every nightly bar performance from flooding the review queue.

```yaml
exclude:
  # Skip events whose title contains any of these (case-insensitive)
  title_keywords: ["live music at", "open mic", "karaoke", "DJ night"]
  # Skip events at these venues (case-insensitive fuzzy match)
  location_keywords: ["visconti's"]
  # Skip events matching a regex pattern (for advanced filtering)
  title_patterns: ["^Live: .+ at .+$"]
```

Exclusion is applied in Step 3 (Normalize) after extraction but before matching/dedup. Excluded events are silently skipped (logged in verbose mode).

---

## Extraction Pipeline

### Step 1: Fetch

For each configured source:
1. Fetch the calendar page(s) via HTTP
2. If the source has an iCal feed URL, fetch that instead
3. Handle pagination if needed (some sites paginate events)

### Step 2: Parse (deterministic first, AI fallback)

**Tier 1 — iCal feeds** (zero AI cost):
- Parse `.ics` format with a library like `ical.js` or `node-ical`
- Map iCal fields directly to event fields (SUMMARY→title, DTSTART→start_date/start_time, etc.)

**Tier 2 — JSON APIs / JSON-LD** (zero AI cost):
- Parse JSON responses from AJAX endpoints (e.g., LibCal)
- Extract JSON-LD `@type: Event` data if present
- Map fields deterministically

**Tier 3 — Structured HTML with CSS selectors** (zero AI cost):
- Use a DOM parser (e.g., `cheerio`) with per-source CSS selectors from config
- Extract text content from matched elements
- Parse dates/times with deterministic patterns

**Tier 4 — AI extraction** (fallback, ~$0.001/event with Haiku):
- When HTML is unstructured or selectors fail to extract clean data
- Send cleaned HTML text to Claude Haiku with a structured extraction prompt
- Request JSON output matching the event schema
- Use only for pages where Tiers 1-3 can't reliably extract data

### Step 3: Normalize and Filter

For each extracted event (deterministic, no AI):

1. **Dates**: Parse to `YYYY-MM-DD` format, handle relative dates ("this Saturday")
2. **Times**: Parse to `HH:MM` 24-hour format
3. **URLs**: Normalize (add https:// if missing)
4. **Cost**: Normalize to standard format (e.g., "Free", "$10", "$10-$25")
5. **Date filter**: Skip events that have already passed
6. **Geo filter**: If source has `geo_filter` config, check event location against keywords and skip non-matching events
7. **Exclusion filter**: If source has `exclude` rules, skip events matching any exclusion criteria (title keywords, location keywords, title regex patterns). Log skipped events in verbose mode.

### Step 4: Match to existing records

**Location matching** (deterministic, cascading):
1. **Fuzzy match against DB**: Query `locations` table and fuzzy-match the scraped venue name (case-insensitive, strip common suffixes like "Center", "Hall", handle abbreviations). Use a simple normalized-string-distance approach — no AI needed.
2. **Fallback to source config default**: If no fuzzy match, use the source's `default_location` from config (e.g., Icicle Creek events default to the Icicle Creek venue).
3. **Flag as unknown**: If neither match works, set `location_added` with the venue name for admin to map during approval.

**Organization matching** (deterministic, cascading):
1. **Fuzzy match against DB**: Query `organizations` table and fuzzy-match the scraped org name (same normalization as locations).
2. **Fallback to source config default**: Use the source's `default_organization` from config.
3. **Flag as unknown**: If neither match works, set `organization_added` for admin review.

**Tag matching** (deterministic):
- Source config can specify a `default_tag` per source
- Additionally, use keyword-based rules to infer tags:
  - "concert", "music", "performance" → `arts-culture`
  - "hike", "trail", "ski" → `outdoors`
  - "meeting", "council" → `civic`
  - "kids", "family", "children" → `family`
  - etc.
- Fall back to source default tag if no keywords match
- Store as `primary_tag_id` (look up tag UUID by name)

**Series/parent event detection** (deterministic):
- If multiple events from the same source have the same title (or title pattern like "Yoga Class - Jan 5", "Yoga Class - Jan 12"), group them
- Check if a parent event already exists in the database with that title
- Set `parent_event_id` if match found

### Step 5: Deduplicate

Deduplication uses `source_title` (the original scraped title) for matching, not the public-facing `title` which the admin may have edited to be more user-friendly. See [Schema Change: source_title](#schema-change-source_title) below.

For each normalized event, check against existing events:

1. **By source**: Query `events` and `events_staged` where `source_id` matches and `source_title` is similar and `start_date` matches
2. **Fuzzy title match**: Normalize `source_title` values (lowercase, strip punctuation) and compare
3. **Decision logic**:
   - **No match found** → Create new staged event
   - **Match found, data identical** → Skip (already imported)
   - **Match found, minor changes** (description, time, cost, registration link) → Auto-update the existing event directly (update fields **except** `title`, which the admin may have customized)
   - **Match found, major changes** (date changed, location changed, appears cancelled) → Create staged event flagged for review with a note explaining the change

### Step 6: Insert into `events_staged`

New and flagged-for-review events are inserted into `events_staged` with:
- All extracted fields mapped to staged event columns
- `title` set to the extracted title (admin can edit this freely)
- `source_title` set to the same extracted title (never edited, used for future dedup matching)
- `source_id` set to the source site's UUID
- `status: 'pending'`
- `comments` field populated with:
  - Source URL where the event was found
  - Any extraction notes (e.g., "AI-extracted", "time inferred", "location not matched")
  - For updates: description of what changed

### Step 7: Log results

Write to `scrape_logs` table:
- Source ID, timestamp, status
- Count of new events created, updated, skipped
- Any errors

Update `source_sites` record:
- `last_scraped` timestamp
- `last_status`
- `last_error` (cleared on success)

---

## Review Workflow

Scraped events flow through the **existing staged events approval workflow**:

1. Scraper inserts events into `events_staged` with `status: 'pending'`
2. Admin sees them in the dashboard "Approve Events" section
3. Admin can edit fields (fix location, adjust tag, etc.) then approve
4. Approval creates the event in the `events` table via existing flow
5. `source_id` is preserved through approval, enabling future update detection

**Identifying scraped vs user-submitted events**: Events with a non-null `source_id` came from the scraper. The `comments` field will contain the source URL and extraction notes. The admin dashboard already shows staged events — no new UI needed for the initial version.

---

## Schema Change: `source_title`

Both `events` and `events_staged` tables need a new nullable column:

```sql
ALTER TABLE events ADD COLUMN source_title text;
ALTER TABLE events_staged ADD COLUMN source_title text;
```

**Purpose**: The scraper writes the original parsed title into `source_title` and copies it into `title`. The admin can then freely edit `title` to be more user-friendly (e.g., "WRI Spring Bird Walk" instead of "SPRING BIRD WALK - Wenatchee River Institute Nature Series #4") without breaking deduplication. Future scrape runs match on `source_title` + `start_date` + `source_id`, so the admin's custom `title` is never overwritten by auto-updates.

| Field | Written by | Editable by admin | Used for dedup |
|-------|-----------|-------------------|----------------|
| `title` | Scraper (initial), Admin (edits) | Yes | No |
| `source_title` | Scraper only | No (hidden from edit UI) | Yes |

For non-scraped events (user submissions), `source_title` is null.

---

## Manual Paste Workflow (Social Media)

For Instagram/Facebook posts that can't be auto-scraped:

### CLI
```bash
npm run scrape -- --url "https://www.instagram.com/p/ABC123/"
```
- Fetches the URL content
- Sends to AI (Haiku) for event extraction
- Creates a staged event with extracted data
- Prints summary to terminal

### Admin UI (future, lower priority)
- Text field on admin dashboard to paste a URL or raw post text
- Submits to an API endpoint that runs the same extraction logic
- Creates a staged event for review

---

## CLI Interface

Uses a `Makefile` target for ergonomic local usage:

```bash
# Scrape all configured sources (dry run by default — no DB writes)
make scrape ARGS="--all"

# Scrape a specific configured source (also dry run by default)
make scrape ARGS="--source icicle-creek"

# Import from a social media post (AI extraction)
make scrape ARGS="--instagram https://www.instagram.com/p/ABC123/"
make scrape ARGS="--facebook https://www.facebook.com/events/123456/"

# Import from any arbitrary URL (AI extraction)
make scrape ARGS="--url https://example.com/some-event-page"

# Write to remote (production) database — the only flag that actually writes
make scrape ARGS="--all --remote"

# Verbose output — show extraction details, skip reasons, match results
make scrape ARGS="--all --verbose"
```

Under the hood, the Makefile target runs the Node.js script:

```makefile
scrape:
	npx tsx src/lib/scraper/index.ts $(ARGS)
```

### CLI output

Default output (dry run) is a concise summary per source:

```
[DRY RUN] Scraping icicle-creek... 8 events found, 3 new, 2 updated, 3 skipped
[DRY RUN] Scraping ncw-libraries... 12 events found, 5 filtered (geo), 4 new, 1 updated, 2 skipped
[DRY RUN] Scraping leavenworth-org... 15 events found, 6 excluded (keywords), 5 new, 2 updated, 2 skipped

[DRY RUN] 12 would be staged, 5 would be auto-updated. Use --remote to write.
```

With `--remote`:
```
Scraping icicle-creek... 8 events found, 3 new, 2 updated, 3 skipped
Scraping ncw-libraries... 12 events found, 5 filtered (geo), 4 new, 1 updated, 2 skipped
Scraping leavenworth-org... 15 events found, 6 excluded (keywords), 5 new, 2 updated, 2 skipped

Done. 12 new staged events, 5 auto-updated. Review at /admin
```

Verbose mode (`--verbose`) adds per-event detail (title, match result, skip reason, etc.).

---

## Database Connection & Local Execution

The scraper runs as a standalone Node.js script (not inside Astro), so it uses `dotenv` + `process.env` instead of `import.meta.env`. It creates its own `supabaseAdmin` client using the service role key to bypass RLS.

### Environment variables

The scraper reads from `.env.local` (gitignored), same as the Astro dev server:

```
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-key       # only needed for AI extraction
```

### Default behavior: dry run (safe by default)

By default, `make scrape` runs the full extraction pipeline (fetch, parse, normalize, match, dedup) but **does not write anything** to the database. It prints a detailed summary of what would happen:

```
[DRY RUN] icicle-creek: 8 events extracted
  NEW  "Winter Concert Series - Feb 15" (arts-culture, Icicle Creek Center)
  NEW  "Kids Art Workshop" (family, Icicle Creek Center)
  SKIP "Jazz Night" (already imported, no changes)
  UPDATE "Snowshoe Hike" — time changed 10:00→09:30 (auto-update)
  ...

[DRY RUN] No database changes made. Use --remote to write to production.
```

This means you can always safely run `make scrape --all` to preview what the scraper would do without any risk of polluting the staged events queue.

### `--remote` flag: write to production database

```bash
make scrape --all --remote
```

Connects to the **remote (production) Supabase** using credentials from `.env.local` and actually writes staged events to the database. This is the flag you add when you've previewed the dry run output and are ready to commit. After running, review the new staged events in the admin dashboard.

### `--local-db` flag: write to local Supabase

```bash
make scrape --all --local-db
```

Connects to the local Supabase instance (`http://127.0.0.1:54321` with the default local service role key) and writes to it. Useful for:
- Testing schema migrations before applying to production
- Developing new extractors without polluting the production staged events queue
- Running the full pipeline end-to-end in an isolated environment

Requires `supabase start` (Docker) to be running locally.

### Flag combinations

| Command | Fetches pages | Writes to DB | Which DB |
|---------|:---:|:---:|:---:|
| `make scrape --all` | Yes | No (dry run) | — |
| `make scrape --all --remote` | Yes | Yes | Remote (production) |
| `make scrape --all --local-db` | Yes | Yes | Local (127.0.0.1) |

---

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| HTTP fetching | `node-fetch` or built-in `fetch` | Already available in Node 18+ |
| HTML parsing | `cheerio` | Lightweight, jQuery-like API for server-side DOM parsing |
| iCal parsing | `node-ical` or `ical.js` | Parse .ics feeds |
| AI extraction | Anthropic API (Claude Haiku) | ~$0.001/event, only used as fallback |
| CLI framework | Plain Node.js script with `process.argv` parsing | Keep it simple, no framework needed |
| Config format | YAML | Human-readable, supports comments |
| YAML parsing | `js-yaml` | Standard YAML parser |
| Database | Existing Supabase (via `supabaseAdmin`) | Already configured with service role key |

### New dependencies
- `cheerio` — HTML parsing
- `node-ical` — iCal feed parsing
- `js-yaml` — YAML config parsing
- `dotenv` — Load `.env.local` for standalone script execution
- `@anthropic-ai/sdk` — AI extraction (only if not already installed)

---

## File Structure

```
scrape/
  sources.yaml           # Source site configuration
  README.md              # How to run the scraper, add new sources
src/
  lib/
    scraper/
      index.ts           # Main entry point, CLI argument parsing, pipeline orchestration
      types.ts           # Shared TypeScript types (ScrapedEvent, ProcessedEvent, etc.)
      db.ts              # Supabase client (dotenv + process.env, dry-run/remote/local modes)
      config.ts          # YAML config loader
      fetch.ts           # HTTP fetching with retry logic
      parse-ical.ts      # iCal feed parser (node-ical)
      parse-html.ts      # Site-specific HTML extractors (cheerio)
      parse-json.ts      # JSON API parser (LibCal AJAX)
      normalize.ts       # Date/time/URL/cost normalization
      filter.ts          # Geo filtering and exclusion filtering
      match.ts           # Location/org/tag matching, dedup logic
      staged.ts          # Insert into events_staged, auto-update existing events
      log.ts             # Write scrape_logs, update source_sites
```

---

## AI Extraction Prompt (for Tier 4 fallback)

When AI extraction is needed, send the cleaned page text to Claude Haiku with:

```
Extract event information from this webpage text. Return a JSON array of events.
Each event should have these fields (use null if not found):

- title: string (required)
- description: string or null
- start_date: string in YYYY-MM-DD format (required)
- end_date: string in YYYY-MM-DD format or null
- start_time: string in HH:MM 24-hour format or null
- end_time: string in HH:MM 24-hour format or null
- location: string (venue name) or null
- cost: string (e.g. "Free", "$10", "$10-$25") or null
- registration_required: boolean or null
- registration_url: string or null
- website: string (event detail page URL) or null
- image_url: string or null

Only include events that haven't already passed (today is {date}).
Only include events in or near Leavenworth, WA if this is a regional calendar.

Respond with ONLY valid JSON, no markdown.
```

---

## Cost Estimate

| Component | Cost per run | Notes |
|-----------|-------------|-------|
| HTTP fetching | $0 | Local network requests |
| iCal/JSON parsing | $0 | Deterministic code |
| HTML parsing with selectors | $0 | Deterministic code |
| AI extraction (fallback) | ~$0.001-0.005/event | Only for sources without structured data |
| Supabase writes | $0 | Within free tier |
| **Total per full scrape run** | **~$0.01-0.05** | Depends on how many sources need AI |

---

## Implementation Phases

### Phase 1: Core infrastructure and schema ✓
- [x] Add `source_title` column to `events` and `events_staged` tables (migration)
- [x] Scraper Supabase client (dotenv + process.env, supports `--remote` and `--local-db` flags)
- [x] CLI entry point with Makefile target and argument parsing (dry run by default)
- [x] Source config loading (YAML)
- [x] HTTP fetching with error handling
- [x] Scrape logging to `scrape_logs` table
- [ ] `source_sites` table seeding for initial sources
- [x] Dry-run mode (full pipeline, no DB writes, detailed output)

### Phase 2: Deterministic extractors ✓
- [x] iCal feed parser (leavenworth.org)
- [x] HTML parser with site-specific extractors (Icicle Creek, Ski Leavenworth, WRI)
- [x] JSON API parser (NCW Libraries LibCal AJAX endpoint)
- [ ] JSON-LD extractor (not needed for current sources)
- [x] Date/time normalization
- [x] Cost normalization
- [x] Geo filtering
- [x] Exclusion filtering (title keywords, location keywords, regex patterns)

### Phase 3: Matching and deduplication ✓
- [x] Location fuzzy matching against DB, fallback to source config default
- [x] Organization fuzzy matching against DB, fallback to source config default
- [x] Tag inference (keyword rules + source defaults)
- [x] Deduplication using `source_title` + `start_date` + `source_id`
- [x] Minor change auto-update logic (preserving admin-edited `title`)
- [x] Major change flagging

### Phase 4: Staged event insertion ✓
- [x] Map extracted data to `events_staged` schema (set both `title` and `source_title`)
- [x] Insert with `source_id` and extraction notes in `comments`
- [ ] Series/parent event detection (future enhancement)

### Phase 5: AI fallback
- [ ] AI extraction prompt and response parsing
- [ ] Integration into extraction pipeline as Tier 4 fallback
- [ ] Manual URL paste support (CLI: `--instagram`, `--facebook`, `--url`)

### Phase 6: Polish
- [ ] Per-source CSS selector tuning (requires testing against live sites)
- [ ] Admin UI paste field (lower priority)
- [x] Verbose/summary output formatting
- [ ] Error handling edge cases

---

## Open Questions

1. ~~**NCW Libraries iCal feed**~~: Resolved — iCal feed was broken but the LibCal AJAX API at `/ajax/calendar/list?c=20171,20179` works perfectly. Returns structured JSON per day. Leavenworth calendar ID is `20171`, Peshastin is `20179`.
2. ~~**Leavenworth.org WordPress export**~~: Resolved — `?ical=1` works and returns a full iCal feed. Currently extracting ~30 events (17 after exclusion filtering).
3. ~~**Icicle Creek selector stability**~~: Resolved — the site is fully server-rendered HTML with stable `div.event-container` structure. Extracts ~21 events reliably.
4. ~~**Source site CSS selectors**~~: Resolved — all extractors use site-specific code in `parse-html.ts` rather than YAML-configured selectors, since each site's structure is unique enough to need custom logic.
5. **Series detection heuristics**: Deferred to a future enhancement. The `parent_event_id` field is set to `null` for now.
6. **Source sites DB seeding**: The `source_sites` table needs to be populated with records matching the YAML config source names/URLs before `--remote` mode will correctly resolve source IDs for foreign key constraints.
