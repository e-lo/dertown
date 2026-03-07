# Event Scraper

Automated pipeline that scrapes event listings from local venue websites and feeds them into the staged-event review queue for admin approval.

## Quick Start

```bash
# Preview what the scraper would do (no database writes)
make scrape ARGS="--all"

# Scrape one source only
make scrape ARGS="--source icicle-creek"

# Write results to production database
make scrape ARGS="--all --remote"

# Show per-event detail
make scrape ARGS="--all --verbose"
```

## How It Works

The scraper runs a 7-step pipeline for each configured source:

1. **Fetch** — downloads the calendar page or iCal feed
2. **Parse** — extracts raw events using site-specific HTML extractors or iCal parsing
3. **Normalize & Filter** — standardizes dates/times/costs, drops past events, applies geo and exclusion filters
4. **Match** — fuzzy-matches locations, organizations, and tags against the database
5. **Deduplicate** — checks if an event already exists (by source + date + title similarity)
6. **Write** — inserts new events into `events_staged` or auto-updates existing ones with minor changes
7. **Log** — writes a scrape log entry and updates the source's `last_scraped` timestamp

New events land in `events_staged` with `status: 'pending'` and appear in the admin dashboard for review and approval.

## CLI Flags

| Flag | Description |
|------|-------------|
| `--all` | Scrape all configured sources |
| `--source <id>` | Scrape a single source by its YAML config ID |
| `--remote` | Write to the production (remote) Supabase database |
| `--local-db` | Write to the local Supabase instance (requires `supabase start`) |
| `--verbose` | Show per-event extraction detail, match results, and skip reasons |

By default (no `--remote` or `--local-db`), the scraper runs in **dry-run mode**: it fetches, parses, and matches everything but writes nothing to the database.

## Environment Setup

The scraper reads credentials from `.env.local` (same file as the Astro dev server):

```env
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

These are only needed when using `--remote`. Dry-run mode does not connect to the database. `--local-db` uses hardcoded local Supabase credentials (`http://127.0.0.1:54321`).

## Configured Sources

| ID | Source | Type | Events |
|----|--------|------|--------|
| `icicle-creek` | [Icicle Creek Center](https://icicle.org/find-events/) | HTML | Concerts, workshops, performances |
| `leavenworth-org` | [Leavenworth.org](https://leavenworth.org/calendar/) | iCal | Community-wide calendar |
| `ski-leavenworth` | [Ski Leavenworth](https://skileavenworth.com/events) | HTML | Ski races, winter sports |
| `wenatchee-river-institute` | [WRI](https://wenatcheeriverinstitute.org/event-calendar.html) | HTML | Nature programs, hikes |
| `ncw-libraries` | [NCW Libraries](https://ncwlibraries.libcal.com/calendar/leavenworth) | JSON API | Leavenworth + Peshastin library events |

Source configurations live in [`scrape/sources.yaml`](sources.yaml).

## Adding a New Source

### 1. Add the source configuration to `sources.yaml`

```yaml
- id: "my-new-source"              # unique slug, used with --source flag
  name: "My New Source"             # display name in output
  url: "https://example.com/events" # calendar page URL
  type: "html"                      # "html", "ical", or "json-api"
  ical_url: null                    # set this for iCal sources
  api_url: null                     # set this for json-api sources
  api_cal_ids: null                 # calendar IDs for json-api (e.g. "20171,20179")
  selectors: {}                     # unused (extractors are code-based)
  geo_filter: null                  # set if source covers a wide region
  default_organization: "Org Name"  # fallback org if no match found
  default_location: "Venue Name"    # fallback location if no match found
  default_tag: "arts-culture"       # fallback tag name (must match a tag in DB)
  exclude: null                     # exclusion rules (see below)
  series_parent_rules: null         # optional keyword -> existing staged series parent mapping
```

`series_parent_rules` helps route new scraped occurrences into a series you already created in `events_staged`:

```yaml
series_parent_rules:
  - title_keywords: ["storybook theater", "storybook theatre"]
    parent_title: "Storybook Theater"
  - title_keywords: ["community yoga"]
    parent_title: "Community Yoga at the Library"
```

Behavior:
- Keywords are matched case-insensitively against the scraped title.
- First matching rule wins.
- `parent_title` can match either:
  - an existing approved top-level event (preferred), or
  - a pending top-level staged event.
- If the match is an approved parent, the scraper stores a marker in staged comments and sets `parent_event_id` during approval.
- If no matching parent exists, the scraper logs a warning and proceeds without linking.

### 2. Write an extractor (if type is `html`)

iCal and `json-api` (LibCal) sources work automatically. For HTML sources, add an extractor function in `src/lib/scraper/parse-html.ts`:

```typescript
// 1. Add to the EXTRACTORS registry at the top of the file
const EXTRACTORS: Record<string, Extractor> = {
  'icicle-creek': extractIcicleCreek,
  'ski-leavenworth': extractSkiLeavenworth,
  'wenatchee-river-institute': extractWRI,
  'my-new-source': extractMyNewSource,   // <-- add this
};

// 2. Write the extractor function
function extractMyNewSource(html: string, _source: SourceConfig): ScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];

  // Use browser DevTools or view-source to find the right selectors.
  // Each extractor pulls the same ScrapedEvent shape:
  $('selector-for-each-event').each((_i, el) => {
    const title = $(el).find('.title-selector').text().trim();
    if (!title) return;

    events.push({
      title,
      description: $(el).find('.desc').text().trim() || null,
      start_date: '2026-03-01',  // parse from page, must be YYYY-MM-DD
      end_date: null,
      start_time: null,           // HH:MM 24-hour format
      end_time: null,
      location_name: null,        // raw venue name, or null to use source default
      cost: null,
      registration_required: null,
      registration_url: null,
      website: null,              // event detail page URL
      image_url: null,
    });
  });

  return events;
}
```

### 3. Add the source to the `source_sites` database table

The scraper matches YAML config IDs to database records by name or URL. For `--remote` mode to work, the source must exist in the `source_sites` table:

```sql
INSERT INTO source_sites (name, url)
VALUES ('My New Source', 'https://example.com/events');
```

You can do this via the Supabase dashboard SQL editor or by adding a migration.

### 4. Test the new source

```bash
# Dry run — check that extraction works
make scrape ARGS="--source my-new-source --verbose"

# Verify output:
#   - Events are being found (check "X events found")
#   - Dates/times parse correctly
#   - Titles look clean (no HTML artifacts or extra whitespace)
#   - Filters exclude the right events (if configured)

# When satisfied, write to production
make scrape ARGS="--source my-new-source --remote"
```

## Configuring Filters

### Exclusion rules

Skip events by title keywords, location keywords, or regex patterns:

```yaml
exclude:
  title_keywords: ["live music:", "karaoke", "trivia night"]
  location_keywords: ["visconti's"]
  title_patterns: ["^DJ .+ at .+$"]
```

All matching is case-insensitive. An event is excluded if it matches **any** rule.

### Geo filter

For sources that cover a wide geographic area, filter to local events:

```yaml
geo_filter:
  location_keywords: ["leavenworth", "peshastin"]
```

Events are kept only if their location name, title, or description contains one of the keywords. Events with no location data are kept (benefit of the doubt).

## Troubleshooting

**"fetch OK, no extractor yet"** — The source is configured with `type: "html"` but has no matching extractor function in `parse-html.ts`. Either add an extractor or switch to `type: "ical"` with an `ical_url`.

**Events not matching locations/orgs** — The fuzzy matcher requires ~75% string similarity. Check that location/org names in the database are close to what the source uses. You can also set `default_location` and `default_organization` in the YAML config as fallbacks.

**JWSInvalidSignature errors with `--remote`** — The `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is invalid or expired. Get the current key from your Supabase project dashboard under Settings > API.

**NCW Libraries returns 0 events** — Check that the `api_url` and `api_cal_ids` in `sources.yaml` are correct. The Leavenworth calendar ID is `20171` and Peshastin is `20179`. You can find calendar IDs by inspecting the page source at `ncwlibraries.libcal.com/calendar/<branch>` and looking for `baseCalendarId`.

## File Structure

```
scrape/
  sources.yaml              # Source site configuration (version-controlled)
  README.md                 # This file
src/lib/scraper/
  index.ts                  # CLI entry point, arg parsing, main pipeline
  types.ts                  # Shared TypeScript types
  db.ts                     # Supabase client (dotenv + process.env)
  config.ts                 # YAML config loader
  fetch.ts                  # HTTP fetching with retry logic
  parse-ical.ts             # iCal feed parser (node-ical)
  parse-html.ts             # HTML extractors per source (cheerio)
  parse-json.ts             # JSON API parser (LibCal AJAX)
  normalize.ts              # Date/time/URL/cost normalization
  filter.ts                 # Geo and exclusion filtering
  match.ts                  # Location/org/tag matching, deduplication
  staged.ts                 # Insert into events_staged, auto-update existing
  log.ts                    # Write scrape_logs, update source_sites
```
