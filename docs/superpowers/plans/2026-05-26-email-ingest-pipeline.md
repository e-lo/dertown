# Email Ingest Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a webhook endpoint + pipeline modules that turn forwarded emails into staged events, announcements, or triggered URL scrapes — all surfacing in the existing admin staged events queue.

**Architecture:** CloudMailin routes inbound email to `POST /api/admin/email-ingest`. A pipeline service in `src/lib/email-ingest/` handles sender validation, intent detection, content extraction, AI parsing, screening, dedup, and DB writes. The API route is a thin handler; all logic lives in independently-testable lib modules.

**Tech Stack:** Astro SSR API routes, Supabase service role (`supabaseAdmin`), CloudMailin (inbound email webhook), Claude Haiku via existing `src/lib/scraper/parse-ai.ts`, Resend (error replies), `tsx` for tests.

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/lib/email-ingest/types.ts` | Shared types: `CloudMailinPayload`, `EmailIntent`, `ProcessResult` |
| `src/lib/email-ingest/command-parser.ts` | Intent detection from subject line and body URLs |
| `src/lib/email-ingest/content-extractor.ts` | Strip quoted replies, signatures, footers from email body |
| `src/lib/email-ingest/screener.ts` | Pure function: apply `ExcludeRules` to a scraped event |
| `src/lib/email-ingest/sender-auth.ts` | Check `envelope.from` against super_admin users in Supabase |
| `src/lib/email-ingest/ai-parser.ts` | Wrap `extractEventsWithAI` for plain-text email body |
| `src/lib/email-ingest/dedup.ts` | Query existing events and run `findEventDuplicateHint()` |
| `src/lib/email-ingest/scrape-url.ts` | Run the scraper pipeline on a single URL (no interactive prompts) |
| `src/lib/email-ingest/processor.ts` | Orchestrate all steps into `processInboundEmail()` |
| `src/pages/api/admin/email-ingest.ts` | Thin HTTP handler + Resend error reply |
| `src/lib/__tests__/email-ingest.test.ts` | Tests for pure logic modules |

### Modified files
| File | What changes |
|---|---|
| `src/lib/scraper/types.ts` | Add `global_exclude?: ExcludeRules \| null` to `SourcesConfig` |
| `src/lib/scraper/config.ts` | Add `globalExclude: ExcludeRules \| null` to `ScraperConfig`; parse it in `loadConfig()` |
| `scrape/sources.yaml` | Add `global_exclude: null` placeholder (admins populate without code changes) |
| `package.json` | Add `"test:email-ingest"` script |

---

## Tasks

### Task 1: Shared types

**Files:**
- Create: `src/lib/email-ingest/types.ts`

- [ ] **Step 1: Create types file**

```typescript
// src/lib/email-ingest/types.ts

export interface CloudMailinPayload {
  envelope: {
    from: string;
    to: string;
    helo_domain?: string;
  };
  headers: {
    subject?: string;
    date?: string;
    [key: string]: string | undefined;
  };
  plain?: string;
  html?: string;
  reply_plain?: string;
  attachments?: Array<{
    file_name: string;
    content_type: string;
    size: number;
  }>;
}

export type EmailIntent =
  | { type: 'scrape'; url: string }
  | { type: 'announcement'; title: string; body: string }
  | { type: 'event'; body: string };

export interface DuplicateHint {
  id: string;
  title: string | null;
  match_level: 'likely' | 'possible';
}

export type ProcessResult =
  | { status: 'rejected_sender' }
  | { status: 'screened_out'; reason: string }
  | { status: 'event_staged'; id: string; duplicateHint?: DuplicateHint }
  | { status: 'announcement_created'; id: string }
  | { status: 'scrape_queued'; url: string; count: number };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/email-ingest/types.ts
git commit -m "feat: add email-ingest shared types"
```

---

### Task 2: Command parser (TDD)

**Files:**
- Create: `src/lib/email-ingest/command-parser.ts`
- Create: `src/lib/__tests__/email-ingest.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/__tests__/email-ingest.test.ts
import { parseIntent } from '../email-ingest/command-parser';

function runTests() {
  console.log('🧪 Testing email-ingest modules\n');
  let allTestsPassed = true;

  // --- command-parser ---

  try {
    const result = parseIntent({
      envelope: { from: 'test@example.com', to: 'events@dertown.app' },
      headers: { subject: 'Check this out' },
      plain: 'Hey look at this https://example.com/events page',
    });
    if (result.type === 'scrape' && result.url === 'https://example.com/events') {
      console.log('✅ PASS: URL in body → scrape intent\n');
    } else {
      console.log(`❌ FAIL: URL in body → scrape intent. Got: ${JSON.stringify(result)}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  try {
    const result = parseIntent({
      envelope: { from: 'test@example.com', to: 'events@dertown.app' },
      headers: { subject: 'Announcement: City Hall closed Monday' },
      plain: 'Just a heads up about the closure.',
    });
    if (result.type === 'announcement' && result.title === 'City Hall closed Monday') {
      console.log('✅ PASS: Announcement subject → announcement intent\n');
    } else {
      console.log(`❌ FAIL: Announcement subject. Got: ${JSON.stringify(result)}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  try {
    const result = parseIntent({
      envelope: { from: 'test@example.com', to: 'events@dertown.app' },
      headers: { subject: 'add announcement: Farmers market this Saturday' },
      plain: 'Come out to the market!',
    });
    if (result.type === 'announcement' && result.title === 'Farmers market this Saturday') {
      console.log('✅ PASS: "add announcement:" subject → announcement intent\n');
    } else {
      console.log(`❌ FAIL: "add announcement:" subject. Got: ${JSON.stringify(result)}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  try {
    const result = parseIntent({
      envelope: { from: 'test@example.com', to: 'events@dertown.app' },
      headers: { subject: 'FW: Community BBQ this Saturday' },
      plain: 'Come join us for a community BBQ at Enchantments Park on Saturday June 7th at noon.',
    });
    if (result.type === 'event') {
      console.log('✅ PASS: Plain email → event intent\n');
    } else {
      console.log(`❌ FAIL: Plain email → event intent. Got: ${JSON.stringify(result)}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  try {
    // URL in body takes priority over announcement subject
    const result = parseIntent({
      envelope: { from: 'test@example.com', to: 'events@dertown.app' },
      headers: { subject: 'Announcement: Check this' },
      plain: 'See https://example.com/event for details',
    });
    if (result.type === 'scrape') {
      console.log('✅ PASS: URL in body beats announcement subject\n');
    } else {
      console.log(`❌ FAIL: URL priority. Got: ${JSON.stringify(result)}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  return allTestsPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
export { runTests };
```

- [ ] **Step 2: Add test script to package.json**

Open `package.json` and add to the `"scripts"` section (alongside the other test scripts):
```json
"test:email-ingest": "tsx src/lib/__tests__/email-ingest.test.ts"
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm run test:email-ingest
```

Expected: Error or FAIL — `command-parser` module does not exist yet.

- [ ] **Step 4: Implement command-parser**

```typescript
// src/lib/email-ingest/command-parser.ts
import type { CloudMailinPayload, EmailIntent } from './types';

const ANNOUNCEMENT_RE = /^(add\s+)?announcement[:\s]/i;
const URL_RE = /https?:\/\/[^\s<>"]+/;

export function parseIntent(payload: CloudMailinPayload): EmailIntent {
  const subject = payload.headers?.subject ?? '';
  const body = payload.plain ?? '';

  // Priority 1: URL in body → scrape
  const urlMatch = URL_RE.exec(body);
  if (urlMatch) {
    return { type: 'scrape', url: urlMatch[0] };
  }

  // Priority 2: Announcement-style subject
  if (ANNOUNCEMENT_RE.test(subject)) {
    const title = subject.replace(ANNOUNCEMENT_RE, '').trim();
    return { type: 'announcement', title, body };
  }

  // Priority 3: Plain event description
  return { type: 'event', body };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test:email-ingest
```

Expected: All 5 command-parser tests pass (`✅ PASS`), process exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/email-ingest/command-parser.ts src/lib/__tests__/email-ingest.test.ts package.json
git commit -m "feat: add email-ingest command parser with tests"
```

---

### Task 3: Content extractor (TDD)

**Files:**
- Create: `src/lib/email-ingest/content-extractor.ts`
- Modify: `src/lib/__tests__/email-ingest.test.ts`

- [ ] **Step 1: Add failing tests to the test file**

Append these tests to `runTests()` in `src/lib/__tests__/email-ingest.test.ts`, before the `return allTestsPassed` line:

First add the import at the top of the file:
```typescript
import { extractBody } from '../email-ingest/content-extractor';
```

Then add inside `runTests()`:
```typescript
  // --- content-extractor ---

  try {
    const input = `Here is the event info.
Join us Saturday at noon.

> On Mon, May 26, 2026 at 10:00 AM, Alice wrote:
> Hey can you add this?

--
Sent from my iPhone`;
    const result = extractBody(input);
    const hasContent = result.includes('Here is the event info');
    const noQuotes = !result.includes('> On Mon');
    const noSignature = !result.includes('Sent from my iPhone');
    if (hasContent && noQuotes && noSignature) {
      console.log('✅ PASS: extractBody strips quoted lines and signature\n');
    } else {
      console.log(`❌ FAIL: extractBody. Got:\n${result}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  try {
    const input = `Community meeting Thursday at 7pm at City Hall.

Unsubscribe from this list | View in browser`;
    const result = extractBody(input);
    const hasContent = result.includes('Community meeting');
    const noFooter = !result.includes('Unsubscribe');
    if (hasContent && noFooter) {
      console.log('✅ PASS: extractBody strips footer patterns\n');
    } else {
      console.log(`❌ FAIL: extractBody footer. Got:\n${result}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  try {
    const input = `Plain email with no footer or quotes.`;
    const result = extractBody(input);
    if (result === 'Plain email with no footer or quotes.') {
      console.log('✅ PASS: extractBody passes clean text through unchanged\n');
    } else {
      console.log(`❌ FAIL: extractBody clean text. Got: "${result}"\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:email-ingest
```

Expected: Error — `content-extractor` module does not exist yet.

- [ ] **Step 3: Implement content-extractor**

```typescript
// src/lib/email-ingest/content-extractor.ts

const QUOTE_LINE_RE = /^>+/;
const SIGNATURE_DELIMITER_RE = /^--\s*$/;
const FOOTER_PATTERNS = [
  /^sent from my/i,
  /^get outlook for/i,
  /^unsubscribe/i,
  /^to unsubscribe/i,
  /^you received this/i,
  /^this email was sent/i,
  /^view in browser/i,
];

export function extractBody(rawText: string): string {
  const lines = rawText.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Stop at email signature delimiter ("-- " on its own line)
    if (SIGNATURE_DELIMITER_RE.test(trimmed)) break;

    // Skip quoted reply lines
    if (QUOTE_LINE_RE.test(trimmed)) continue;

    // Stop at common footer patterns
    if (FOOTER_PATTERNS.some((re) => re.test(trimmed))) break;

    result.push(line);
  }

  return result.join('\n').trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:email-ingest
```

Expected: All command-parser and content-extractor tests pass (`✅ PASS`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/email-ingest/content-extractor.ts src/lib/__tests__/email-ingest.test.ts
git commit -m "feat: add email-ingest content extractor with tests"
```

---

### Task 4: Global exclude rules + screener (TDD)

**Files:**
- Create: `src/lib/email-ingest/screener.ts`
- Modify: `src/lib/scraper/types.ts`
- Modify: `src/lib/scraper/config.ts`
- Modify: `scrape/sources.yaml`
- Modify: `src/lib/__tests__/email-ingest.test.ts`

- [ ] **Step 1: Add `global_exclude` to `SourcesConfig` in `src/lib/scraper/types.ts`**

Find the `SourcesConfig` interface (currently at line 106) and add the new field:

```typescript
// BEFORE:
export interface SourcesConfig {
  sources: SourceConfig[];
  tag_keywords?: Record<string, string[]>;
  venue_tags?: VenueTagRule[];
  description_max_chars?: number;
}

// AFTER:
export interface SourcesConfig {
  sources: SourceConfig[];
  tag_keywords?: Record<string, string[]>;
  venue_tags?: VenueTagRule[];
  description_max_chars?: number;
  global_exclude?: ExcludeRules | null;
}
```

- [ ] **Step 2: Add `globalExclude` to `ScraperConfig` and parse it in `src/lib/scraper/config.ts`**

In `config.ts`, update the `ScraperConfig` interface and `loadConfig()` return value:

```typescript
// BEFORE:
export interface ScraperConfig {
  sources: SourceConfig[];
  tagKeywords: Record<string, string[]>;
  venueTags: VenueTagRule[];
  descriptionMaxChars: number;
}

// AFTER:
export interface ScraperConfig {
  sources: SourceConfig[];
  tagKeywords: Record<string, string[]>;
  venueTags: VenueTagRule[];
  descriptionMaxChars: number;
  globalExclude: import('./types').ExcludeRules | null;
}
```

In the `return` at the end of `loadConfig()`:
```typescript
// BEFORE:
  return {
    sources: parsed.sources,
    tagKeywords: parsed.tag_keywords || {},
    venueTags: parsed.venue_tags || [],
    descriptionMaxChars,
  };

// AFTER:
  return {
    sources: parsed.sources,
    tagKeywords: parsed.tag_keywords || {},
    venueTags: parsed.venue_tags || [],
    descriptionMaxChars,
    globalExclude: parsed.global_exclude ?? null,
  };
```

- [ ] **Step 3: Add `global_exclude` placeholder to `scrape/sources.yaml`**

Add at the very top of `scrape/sources.yaml`, before the existing `description_max_chars` line:

```yaml
# Global exclusion rules applied to all email-ingest events.
# Add title_keywords, location_keywords, or title_patterns here.
global_exclude: null

```

- [ ] **Step 4: Add failing screener tests to the test file**

Add import at the top of `src/lib/__tests__/email-ingest.test.ts`:
```typescript
import { screenEvent } from '../email-ingest/screener';
import type { ExcludeRules } from '../scraper/types';
```

Add inside `runTests()` before `return allTestsPassed`:
```typescript
  // --- screener ---

  try {
    const rules: ExcludeRules = { title_keywords: [' camp', 'group lessons'] };
    const result = screenEvent({ title: 'Summer Strings Camp', location_name: null }, rules);
    if (!result.pass) {
      console.log('✅ PASS: screenEvent blocks event matching title_keywords\n');
    } else {
      console.log(`❌ FAIL: screenEvent should have blocked "Summer Strings Camp"\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  try {
    const rules: ExcludeRules = { title_keywords: [' camp'] };
    const result = screenEvent({ title: 'Community BBQ', location_name: null }, rules);
    if (result.pass) {
      console.log('✅ PASS: screenEvent passes event not matching any rule\n');
    } else {
      console.log(`❌ FAIL: screenEvent blocked "Community BBQ" incorrectly\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  try {
    const result = screenEvent({ title: 'Any Event', location_name: null }, null);
    if (result.pass) {
      console.log('✅ PASS: screenEvent passes when rules are null\n');
    } else {
      console.log(`❌ FAIL: screenEvent should pass with null rules\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }
```

- [ ] **Step 5: Run test to verify it fails**

```bash
npm run test:email-ingest
```

Expected: Error — `screener` module does not exist yet.

- [ ] **Step 6: Implement screener**

```typescript
// src/lib/email-ingest/screener.ts
import { shouldExclude } from '../scraper/filter';
import type { ScrapedEvent, ExcludeRules } from '../scraper/types';

export function screenEvent(
  event: Pick<ScrapedEvent, 'title' | 'location_name'>,
  rules: ExcludeRules | null
): { pass: boolean; reason?: string } {
  if (!rules) return { pass: true };

  const excluded = shouldExclude(event as ScrapedEvent, rules, false);
  return excluded ? { pass: false, reason: 'Matched global exclusion rule' } : { pass: true };
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
npm run test:email-ingest
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/email-ingest/screener.ts src/lib/scraper/types.ts src/lib/scraper/config.ts scrape/sources.yaml src/lib/__tests__/email-ingest.test.ts
git commit -m "feat: add screener, extend sources.yaml with global_exclude"
```

---

### Task 5: Sender auth

**Files:**
- Create: `src/lib/email-ingest/sender-auth.ts`

No unit tests — requires live Supabase. Verify manually after the full pipeline is wired (Task 10).

- [ ] **Step 1: Implement sender-auth**

```typescript
// src/lib/email-ingest/sender-auth.ts
import { supabaseAdmin } from '@/lib/supabase';

export async function isSuperAdminEmail(email: string): Promise<boolean> {
  // Look up all auth users (admin user counts are small, typically < 100)
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data) return false;

  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) return false;

  // Check user_permissions.is_admin (same logic as session.ts checkAdminAccess)
  const { data: perm } = await supabaseAdmin
    .from('user_permissions')
    .select('is_admin')
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .single();

  return !!perm;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/email-ingest/sender-auth.ts
git commit -m "feat: add email-ingest sender auth"
```

---

### Task 6: AI parser for email text

**Files:**
- Create: `src/lib/email-ingest/ai-parser.ts`

No unit tests — calls live AI API. Integration-tested in Task 10.

- [ ] **Step 1: Implement ai-parser**

The simplest approach is to wrap `extractEventsWithAI` from `parse-ai.ts` by encoding the email text as minimal HTML. `htmlToCleanText` will strip the tags and pass the text through unchanged.

```typescript
// src/lib/email-ingest/ai-parser.ts
import { extractEventsWithAI } from '../scraper/parse-ai';
import type { ScrapedEvent } from '../scraper/types';

export async function parseEventsFromEmail(cleanBody: string): Promise<ScrapedEvent[]> {
  // Wrap in minimal HTML so htmlToCleanText() can process it (returns text unchanged)
  const fakeHtml = `<html><body>${cleanBody}</body></html>`;
  return extractEventsWithAI(fakeHtml, 'email-ingest', 12000, false);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/email-ingest/ai-parser.ts
git commit -m "feat: add email-ingest AI parser (wraps parse-ai.ts)"
```

---

### Task 7: Dedup helper

**Files:**
- Create: `src/lib/email-ingest/dedup.ts`

No unit tests — calls live DB. Integration-tested in Task 10.

- [ ] **Step 1: Implement dedup**

```typescript
// src/lib/email-ingest/dedup.ts
import { supabaseAdmin } from '@/lib/supabase';
import { findEventDuplicateHint } from '../event-duplicate';
import type { EventDuplicateHint } from '../event-duplicate';
import type { ScrapedEvent } from '../scraper/types';

export async function checkDuplicate(event: ScrapedEvent): Promise<EventDuplicateHint | null> {
  const { data: existingEvents } = await supabaseAdmin
    .from('events')
    .select('id, title, start_date, start_time, location_id, organization_id, source_id')
    .not('status', 'eq', 'archived');

  if (!existingEvents || existingEvents.length === 0) return null;

  return findEventDuplicateHint(
    {
      id: '',
      title: event.title,
      start_date: event.start_date,
      start_time: event.start_time ?? null,
    },
    existingEvents
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/email-ingest/dedup.ts
git commit -m "feat: add email-ingest dedup helper"
```

---

### Task 8: Scrape-URL pipeline helper

**Files:**
- Create: `src/lib/email-ingest/scrape-url.ts`

This is used for the `scrape` intent: fetch a URL, run the full scraper pipeline (without interactive prompts), write results to `events_staged`. Used by the processor.

- [ ] **Step 1: Implement scrape-url**

```typescript
// src/lib/email-ingest/scrape-url.ts
import { supabaseAdmin } from '@/lib/supabase';
import { fetchPage } from '../scraper/fetch';
import { extractEventsWithAI } from '../scraper/parse-ai';
import { normalizeEvent, isPastEvent } from '../scraper/normalize';
import { clampDescription } from '../scraper/description';
import { matchEvents, loadReferenceData } from '../scraper/match';
import { writeProcessedEvents } from '../scraper/staged';
import { loadConfig } from '../scraper/config';
import type { SourceConfig, ScrapedEvent } from '../scraper/types';

export async function scrapeUrlForEmail(url: string): Promise<number> {
  const config = loadConfig();

  // Fetch and AI-extract events from the URL
  const html = await fetchPage(url);
  const rawEvents = await extractEventsWithAI(html, url, config.descriptionMaxChars, false);

  // Normalize and filter past events
  const events: ScrapedEvent[] = [];
  for (const raw of rawEvents) {
    const ev = normalizeEvent(raw);
    ev.description = clampDescription(ev.description, config.descriptionMaxChars);
    if (!isPastEvent(ev)) events.push(ev);
  }

  if (events.length === 0) return 0;

  // Build a synthetic source config (no per-source exclusion rules for email-ingest)
  const syntheticSource: SourceConfig = {
    id: 'email-ingest',
    name: 'Email Ingest',
    url,
    type: 'html',
    default_organization: null,
    default_location: null,
    default_tag: null,
  };

  // Match events against locations, orgs, tags in DB
  const ref = await loadReferenceData(supabaseAdmin).catch(() => null);
  const processed = matchEvents(
    events,
    syntheticSource,
    ref,
    config.tagKeywords,
    config.venueTags,
    false
  );

  // Write to events_staged
  const { inserted } = await writeProcessedEvents(supabaseAdmin, processed, syntheticSource, false);
  return inserted;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/email-ingest/scrape-url.ts
git commit -m "feat: add scrape-url helper for email-ingest scrape intent"
```

---

### Task 9: Processor

**Files:**
- Create: `src/lib/email-ingest/processor.ts`

- [ ] **Step 1: Implement processor**

```typescript
// src/lib/email-ingest/processor.ts
import { supabaseAdmin } from '@/lib/supabase';
import { isSuperAdminEmail } from './sender-auth';
import { parseIntent } from './command-parser';
import { extractBody } from './content-extractor';
import { screenEvent } from './screener';
import { parseEventsFromEmail } from './ai-parser';
import { checkDuplicate } from './dedup';
import { scrapeUrlForEmail } from './scrape-url';
import { matchEvents, loadReferenceData } from '../scraper/match';
import { loadConfig } from '../scraper/config';
import type { CloudMailinPayload, ProcessResult } from './types';
import type { SourceConfig, VenueTagRule } from '../scraper/types';

export async function processInboundEmail(payload: CloudMailinPayload): Promise<ProcessResult> {
  const senderEmail = payload.envelope.from;

  // Step 1: Validate sender is a super_admin
  const isAuthorized = await isSuperAdminEmail(senderEmail);
  if (!isAuthorized) return { status: 'rejected_sender' };

  // Step 2: Detect intent
  const intent = parseIntent(payload);

  // Step 3: Branch by intent

  if (intent.type === 'scrape') {
    const count = await scrapeUrlForEmail(intent.url);
    return { status: 'scrape_queued', url: intent.url, count };
  }

  if (intent.type === 'announcement') {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabaseAdmin
      .from('announcements_staged')
      .insert({
        title: intent.title,
        message: extractBody(intent.body),
        status: 'pending',
        comments: `Received via email ingest from ${senderEmail} on ${today}`,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create staged announcement: ${error.message}`);
    return { status: 'announcement_created', id: data.id };
  }

  // intent.type === 'event'
  const cleanBody = extractBody(intent.body);

  // Step 4: AI extraction
  const events = await parseEventsFromEmail(cleanBody);
  if (events.length === 0) {
    throw new Error('No events could be extracted from the email');
  }

  // Use the first (most prominent) extracted event
  const event = events[0];

  // Load config once — used for screening and matching (graceful fallback if file unavailable)
  let globalExclude = null;
  let tagKeywords: Record<string, string[]> = {};
  let venueTags: VenueTagRule[] = [];
  try {
    const config = loadConfig();
    globalExclude = config.globalExclude;
    tagKeywords = config.tagKeywords;
    venueTags = config.venueTags;
  } catch {
    // scrape/sources.yaml unavailable — screening and tag matching will be skipped
  }

  // Step 5: Screen against global exclusion rules
  const screen = screenEvent(event, globalExclude);
  if (!screen.pass) return { status: 'screened_out', reason: screen.reason! };

  // Step 6: Check for duplicates
  const duplicateHint = await checkDuplicate(event);

  // Step 7: Match event against locations/orgs/tags and write to events_staged
  const ref = await loadReferenceData(supabaseAdmin).catch(() => null);

  const syntheticSource: SourceConfig = {
    id: 'email-ingest',
    name: 'Email Ingest',
    url: `mailto:${senderEmail}`,
    type: 'html',
    default_organization: null,
    default_location: null,
    default_tag: null,
  };

  const processed = matchEvents([event], syntheticSource, ref, tagKeywords, venueTags, false);
  if (processed.length === 0) throw new Error('Event matching returned no results');

  const ev = processed[0];
  const today = new Date().toISOString().split('T')[0];
  const notes = [`Received via email ingest from ${senderEmail} on ${today}`];
  if (!ev.location_id && ev.location_added) notes.push(`Location not matched: "${ev.location_added}"`);
  if (!ev.organization_id && ev.organization_added) notes.push(`Organization not matched: "${ev.organization_added}"`);

  const { data: row, error } = await supabaseAdmin
    .from('events_staged')
    .insert({
      title: ev.scraped.title,
      source_title: ev.scraped.title,
      description: ev.scraped.description,
      start_date: ev.scraped.start_date,
      end_date: ev.scraped.end_date,
      start_time: ev.scraped.start_time,
      end_time: ev.scraped.end_time,
      cost: ev.scraped.cost,
      website: ev.scraped.website,
      registration_link: ev.scraped.registration_url,
      registration: ev.scraped.registration_required ?? false,
      external_image_url: ev.scraped.image_url,
      location_id: ev.location_id,
      location_added: ev.location_id ? null : ev.location_added,
      organization_id: ev.organization_id,
      organization_added: ev.organization_id ? null : ev.organization_added,
      primary_tag_id: ev.primary_tag_id,
      source_id: null,
      status: 'pending',
      submitted_at: new Date().toISOString(),
      comments: notes.join('\n'),
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create staged event: ${error.message}`);

  return {
    status: 'event_staged',
    id: row.id,
    ...(duplicateHint
      ? { duplicateHint: { id: duplicateHint.id, title: duplicateHint.title, match_level: duplicateHint.match_level } }
      : {}),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/email-ingest/processor.ts
git commit -m "feat: add email-ingest processor"
```

---

### Task 10: API route + wire-up

**Files:**
- Create: `src/pages/api/admin/email-ingest.ts`

- [ ] **Step 1: Implement the API route**

Security note: CloudMailin's endpoint URL is itself a secret (only CloudMailin knows it). The primary security gate is sender auth in `processInboundEmail()` — only super_admin emails proceed. The optional `CLOUDMAILIN_SECRET` env var adds a second check if set.

```typescript
// src/pages/api/admin/email-ingest.ts
import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { jsonResponse, jsonError } from '@/lib/api-utils';
import { processInboundEmail } from '@/lib/email-ingest/processor';
import type { CloudMailinPayload } from '@/lib/email-ingest/types';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  // Optional: validate CloudMailin shared secret if CLOUDMAILIN_SECRET is set
  const expectedSecret = import.meta.env.CLOUDMAILIN_SECRET;
  if (expectedSecret) {
    const providedSecret = request.headers.get('x-cloudmailin-secret');
    if (providedSecret !== expectedSecret) {
      return jsonError('Unauthorized', 401);
    }
  }

  let payload: CloudMailinPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  const senderEmail = payload.envelope?.from;
  if (!senderEmail) return jsonError('Missing envelope.from', 400);

  try {
    const result = await processInboundEmail(payload);

    // Silent 200 for unauthorized senders — don't reveal endpoint existence
    if (result.status === 'rejected_sender') {
      return jsonResponse({ ok: true });
    }

    console.log(`[email-ingest] Processed from ${senderEmail}: ${result.status}`);
    return jsonResponse({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[email-ingest] Error processing email from ${senderEmail}:`, message);

    // Send error reply to sender via Resend
    const resendKey = import.meta.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        const fromAddress = import.meta.env.RESEND_FROM_EMAIL || 'Der Town <onboarding@resend.dev>';
        await resend.emails.send({
          from: fromAddress,
          to: [senderEmail],
          subject: 'Could not process your forwarded email',
          text: `Hi,\n\nWe received your email but could not process it:\n\n${message}\n\nPlease try again or add the event manually at dertown.app/admin.\n`,
        });
      } catch (resendErr) {
        console.error('[email-ingest] Failed to send error reply:', resendErr);
      }
    }

    return jsonResponse({ ok: false, error: message }, 500);
  }
};
```

- [ ] **Step 2: Run all email-ingest tests to verify nothing is broken**

```bash
npm run test:email-ingest
```

Expected: All tests pass.

- [ ] **Step 3: Verify TypeScript compiles with no errors**

```bash
npx tsc --noEmit
```

Expected: No errors. Fix any type errors before committing.

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/admin/email-ingest.ts
git commit -m "feat: add email-ingest API route (POST /api/admin/email-ingest)"
```

---

## CloudMailin Setup (one-time, manual)

These steps are done by a human outside of code:

1. Create a CloudMailin account at cloudmailin.com
2. Get your inbound email address (e.g. `abc123@cloudmailin.net`)
3. On DNSimple: add an MX record on `events.<domain>` pointing to CloudMailin's MX servers (listed in your CloudMailin account)
4. In CloudMailin: set the POST target to `https://<domain>/api/admin/email-ingest`
5. Choose "JSON Format" for the webhook body
6. Copy the CloudMailin shared secret (if offered) to `CLOUDMAILIN_SECRET` env var in Netlify (optional but recommended)
7. Test by forwarding an email to `events@<domain>` — check the Netlify function log for `[email-ingest]` lines

---

## Manual Verification Checklist

After all tasks complete, verify end-to-end:

1. **Event extraction**: Forward a plain-text event description to the ingest address from a super_admin email. Confirm a row appears in `events_staged` with `status='pending'`.

2. **Announcement**: Forward an email with subject `Announcement: Test notice`. Confirm a row appears in `announcements_staged`.

3. **URL scrape**: Forward an email whose body contains `https://icicle.org/events`. Confirm `events_staged` rows are created (or zero rows if no upcoming events found on that page).

4. **Unauthorized sender**: Forward from a non-admin email. Confirm no rows are created and the response is a silent 200.

5. **Dedup hint**: Forward an event matching an existing event title + date. Confirm the staged row has a `likely_duplicate_id` set (visible in Supabase dashboard or via the admin staging queue).

6. **Error reply**: Forward an email with no extractable event (e.g. blank body). Confirm Resend sends an error reply to the sender.
