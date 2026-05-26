# Email Ingest Pipeline — Design

**Date:** 2026-05-26
**Status:** Approved

## Problem

Admins want to forward emails (event announcements, city hall newsletters, etc.) to a single address and have the system automatically parse them into draft events or announcements for review. Admins also want to forward an Instagram post URL to trigger the existing URL scraper. All results land in the existing staged events queue — no new review UI needed.

## Inbound Email Service

**CloudMailin** (not Mailgun) — purpose-built for inbound→webhook delivery, no outbound configuration required, simple MX setup, free tier covers low-volume admin use. Resend remains the outbound-only service for password resets and edit notifications.

One-time setup:
1. Create CloudMailin account; receive an inbound address
2. Add MX record on DNSimple pointing `events.<domain>` → CloudMailin's MX servers
3. Configure CloudMailin to POST JSON to `https://<domain>/api/admin/email-ingest`
4. Copy the CloudMailin shared secret to `CLOUDMAILIN_SECRET` env var in Netlify

## Data Flow

```
Email arrives at events@<domain>
        ↓
CloudMailin POSTs JSON payload to POST /api/admin/email-ingest
        ↓
  1. Validate CloudMailin signature header (CLOUDMAILIN_SECRET)
  2. Sender auth — check envelope.from against super_admin profiles in Supabase
     → unknown sender: return 200 silently (do not reveal endpoint)
  3. Command parser — detect intent from subject line and body URLs
  4. Content extractor — strip quoted replies, signatures, and footers
  5. Branch by intent:

     [scrape]       → extract URL from body, call existing scraper pipeline
     [announcement] → write to announcements table
     [event]        → ai-parser → screener → dedup → write events_staged

  6. On error: send reply via Resend to original sender with brief failure summary
     On success: no reply
```

## Intent Detection

Evaluated in priority order:

| Priority | Condition | Intent |
|---|---|---|
| 1 | Body contains a `https://` URL | `scrape` |
| 2 | Subject matches `^(add )?announcement[:\s]` (case-insensitive) | `announcement` |
| 3 | Otherwise | `event` |

The Instagram mobile workflow is covered by the `scrape` intent: admin forwards a post URL → body contains `https://instagram.com/...` → existing `--url` scraper path handles it.

## File Structure

```
src/pages/api/admin/email-ingest.ts     ← thin webhook handler (auth + call processor)
src/lib/email-ingest/
  processor.ts          ← orchestrates all steps, returns typed ProcessResult
  sender-auth.ts        ← validates envelope.from against super_admin profiles
  command-parser.ts     ← intent detection from subject line and body URLs
  content-extractor.ts  ← strips quoted text, signatures, email footers
  ai-parser.ts          ← adapts parse-ai.ts for plain-text email input
  screener.ts           ← applies scrape/sources.yaml exclusion keyword rules
  dedup.ts              ← wraps findEventDuplicateHint() against existing events
```

The webhook route calls `processInboundEmail(payload)` and handles only the HTTP response. All logic lives in lib modules for independent testability.

## Module Details

### `processor.ts`

Orchestrates the pipeline steps in order. Returns a discriminated union:
```ts
type ProcessResult =
  | { status: 'scrape_queued'; url: string }
  | { status: 'announcement_created'; id: string }
  | { status: 'event_staged'; id: string; duplicateHint?: string }
  | { status: 'rejected_sender' }
  | { status: 'screened_out'; reason: string }
```

### `sender-auth.ts`

Queries Supabase for a super_admin user matching `envelope.from`. Returns boolean. Unknown senders get a silent 200 — the endpoint does not reveal its existence or behavior to unauthorized senders.

> **Implementation note:** Verify the exact table and column that stores `role = 'super_admin'` (likely `profiles.role` or `auth.users.user_metadata`) before writing the query.

### `command-parser.ts`

- Extracts first `https://` URL from body (if any) → `scrape` intent
- Checks subject against announcement regex → `announcement` intent
- Returns `{ intent, url?, announcementText? }`

### `content-extractor.ts`

Strips:
- Quoted reply lines (lines beginning with `>`)
- Common footer patterns ("Sent from my iPhone", "-- ", unsubscribe blocks)
- Excess blank lines

Returns clean plain text for the AI parser.

### `ai-parser.ts`

Wraps `src/lib/scraper/parse-ai.ts` (existing Claude Haiku extraction). That module currently takes HTML from scraped URLs; this wrapper feeds it cleaned email body text with a prompt note that the input is a forwarded email. Returns partial event fields (same shape as the scraper output).

### `screener.ts`

Loads `scrape/sources.yaml` exclusion rules (the same keyword lists used by the scraper) and checks the AI-extracted title and description against them. Returns `{ pass: boolean; reason?: string }`. Screened-out events are not staged.

### `dedup.ts`

Calls `findEventDuplicateHint()` from `src/lib/event-duplicate.ts` against existing events. If score ≥ LIKELY threshold, attaches `likely_duplicate_id` to the staged row — same behavior as the scraper.

## What Gets Written

### Event intent → `events_staged`

| Field | Value |
|---|---|
| `status` | `'pending'` |
| `source_id` | `null` |
| `comments` | `"Received via email ingest from <sender> on <date>"` |
| `likely_duplicate_id` | set if dedup score ≥ threshold |
| All event fields | from AI parser output |

### Announcement intent → `announcements`

| Field | Value |
|---|---|
| `title` | subject line with "announcement:" prefix stripped |
| body content | from content-extracted email body |
| `status` | `'pending'` |

> **Implementation note:** Verify the `announcements` table schema (column names, required fields, any constraints) before writing the insert logic.

### Scrape intent

Calls the existing scraper with the extracted URL. No new DB writes in the ingest layer — the scraper pipeline handles everything as if `--url <url>` were passed directly.

> **Implementation note:** If the extracted URL is an Instagram URL (`instagram.com`), the scraper may need the `--instagram` flag rather than `--url`. Verify which scraper entry point handles Instagram URLs before wiring this up.

## Error Handling

| Scenario | Behavior |
|---|---|
| Invalid CloudMailin signature | 400, no reply |
| Unknown sender (not super_admin) | 200, no reply, silent discard |
| AI parser returns no usable fields | Error reply via Resend; nothing staged |
| Screener rejects content | No staging, no reply (silent) |
| Unhandled exception | 500, error reply via Resend to sender |

Error replies are plain-text, sent from the existing Resend sender address, and include a brief human-readable summary of what failed.

## No New Admin UI

Email-ingest events surface in the existing staged events queue alongside scraper-sourced events. Admins review, approve, or reject them using the same flow as today. The `comments` field notes the email origin.

## Environment Variables

| Variable | Purpose |
|---|---|
| `CLOUDMAILIN_SECRET` | Validates CloudMailin webhook signature on every request |
| (existing) `SUPABASE_SERVICE_ROLE_KEY` | DB writes via service role |
| (existing) `RESEND_API_KEY` | Error reply emails |
| (existing) `ANTHROPIC_API_KEY` | Claude Haiku AI extraction |
