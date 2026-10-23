# This Week in Der Town — Newsletter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A double-opt-in signup on dertown.org plus a `/newsletter` Claude skill that drafts, previews, revises, and schedules a weekly Resend Broadcast for Thursday 12:00 Pacific.

**Architecture:** Pure, framework-free modules in `src/lib/newsletter/` (dates, tokens, event selection, HTML rendering) are shared by an Astro API route/page (signup + confirm) and by `tsx` CLI scripts in `scripts/newsletter/` that the skill drives. Resend owns the subscriber list (a segment) and scheduled sending; there is no new DB table.

**Tech Stack:** Astro SSR on Netlify, Supabase (`public_events` view), `resend` 6.12 (segments, contacts, broadcasts), `tsx` for scripts and tests, Node `crypto` for HMAC.

**Spec:** `docs/superpowers/specs/2026-10-23-weekly-newsletter-design.md`

## Global Constraints

- Name: **This Week in Der Town**. Default sender `This Week in Der Town <news@dertown.org>`, overridable by env `NEWSLETTER_FROM_EMAIL`.
- Env vars (new): `RESEND_NEWSLETTER_API_KEY` (full access), `RESEND_NEWSLETTER_SEGMENT_ID`, `NEWSLETTER_FROM_EMAIL`, `NEWSLETTER_SIGNING_SECRET`. Never touch or reuse `RESEND_API_KEY`.
- Send time: Thursday 12:00 `America/Los_Angeles`, at least 1 hour in the future at run time.
- "This week" window: the Friday after the send date through the following Thursday (7 days, inclusive). "Plan ahead": 14–42 days after the send date.
- Only rows from `public_events` (already approved, non-excluded, non-cancelled).
- Confirm tokens valid 7 days. Subscribe always returns the same "check your inbox" message.
- Email HTML: single column, inline styles, max width 600px, no external CSS/JS, includes `{{{RESEND_UNSUBSCRIBE_URL}}}`.
- No new npm dependencies. Nothing in `src/lib/newsletter/` may use `import.meta.env` (scripts run under `tsx`). `src/lib/config.ts` stays untouched.
- No broadcast is created/scheduled without the `--approved` flag, which only the skill passes after explicit editor approval.
- Tests follow the repo pattern: `tsx src/lib/__tests__/<name>.test.ts` with a `check()` helper and `process.exit(1)` on failure; one `test:newsletter-*` script per file in `package.json`.

## Review Focus

1. **DST weeks** — a run on Thu 2026-10-29 must target 2026-10-29T19:00Z; a run on Mon 2026-11-02 (after DST ends Nov 1) must target 2026-11-05T20:00Z. (Task 1)
2. **User text with HTML characters** (`&`, `<`, `"` in titles, blurbs, intro) renders escaped, never as markup. (Task 4)
3. **Sparse events** — no image, no location, no start time → image block omitted, location line omitted, "All day" shown; nothing renders `null`/`undefined`. (Task 4)
4. **Multi-day events that start before the window** (e.g. a festival Thu–Sun) appear in "this week" under the window's first day. (Task 3)
5. **Messy or forged signups** — ` Foo@Example.COM ` is normalized to `foo@example.com`; a tampered, expired, or wrong-secret token is rejected. (Task 2)

---

### Task 1: Send-date and window math

**Files:**
- Create: `src/lib/newsletter/dates.ts`
- Test: `src/lib/__tests__/newsletter-dates.test.ts`
- Modify: `package.json` (add `"test:newsletter-dates"`)

**Interfaces:**
- Produces:
  - `nextSendDate(now: Date): Date` — the next Thursday 12:00 America/Los_Angeles that is ≥ 1 hour after `now`.
  - `sendDateKey(send: Date): string` — `YYYY-MM-DD` of the send in Pacific time (used for draft filenames).
  - `issueWindows(send: Date): { thisWeek: { start: string; end: string }; planAhead: { start: string; end: string } }` — all `YYYY-MM-DD` Pacific dates.

- [ ] **Step 1: Write the failing tests**

```ts
check('wed morning → same-week thu', nextSendDate(new Date('2026-10-28T16:00:00Z')).toISOString(), '2026-10-29T19:00:00.000Z');
check('thu 11:30 PT → next week (less than 1h)', nextSendDate(new Date('2026-10-29T18:30:00Z')).toISOString(), '2026-11-05T20:00:00.000Z');
check('thu 10:59 PT → today', nextSendDate(new Date('2026-10-29T17:59:00Z')).toISOString(), '2026-10-29T19:00:00.000Z');
check('after DST end', nextSendDate(new Date('2026-11-02T18:00:00Z')).toISOString(), '2026-11-05T20:00:00.000Z');
check('key', sendDateKey(new Date('2026-10-29T19:00:00Z')), '2026-10-29');
check('windows', issueWindows(new Date('2026-10-29T19:00:00Z')), {
  thisWeek: { start: '2026-10-30', end: '2026-11-05' },
  planAhead: { start: '2026-11-12', end: '2026-12-10' },
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test:newsletter-dates` → FAIL (module not found).
- [ ] **Step 3: Implement `dates.ts`.** Derive the Pacific wall-clock date/offset with `Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', ... })`; don't hardcode -7/-8. Do date-only arithmetic on `YYYY-MM-DD` via UTC-noon `Date`s to avoid DST drift.
- [ ] **Step 4: Run to verify it passes** — also run with `TZ=UTC` and `TZ=Asia/Tokyo` prefixes; all PASS.
- [ ] **Step 5: Commit** — `feat(newsletter): send-date and issue window math`

### Task 2: Confirm tokens

**Files:**
- Create: `src/lib/newsletter/token.ts`
- Test: `src/lib/__tests__/newsletter-token.test.ts`
- Modify: `package.json` (add `"test:newsletter-token"`)

**Interfaces:**
- Produces:
  - `normalizeEmail(raw: string): string | null` — trim + lowercase; `null` if not a plausible address (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`).
  - `signConfirmToken(email: string, secret: string, now: Date): string` — `base64url(JSON {e, t})` + `.` + `base64url(HMAC-SHA256)`.
  - `verifyConfirmToken(token: string, secret: string, now: Date): string | null` — returns the email or `null`. Use `crypto.timingSafeEqual`. TTL constant `CONFIRM_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000`.

- [ ] **Step 1: Write the failing tests**

```ts
const now = new Date('2026-10-23T12:00:00Z');
const tok = signConfirmToken('foo@example.com', 'secret-a', now);
check('normalize', normalizeEmail('  Foo@Example.COM '), 'foo@example.com');
check('reject junk', normalizeEmail('not an email'), null);
check('round trip', verifyConfirmToken(tok, 'secret-a', now), 'foo@example.com');
check('6 days ok', verifyConfirmToken(tok, 'secret-a', new Date('2026-10-29T12:00:00Z')), 'foo@example.com');
check('8 days expired', verifyConfirmToken(tok, 'secret-a', new Date('2026-10-31T12:00:00Z')), null);
check('wrong secret', verifyConfirmToken(tok, 'secret-b', now), null);
check('tampered payload', verifyConfirmToken('x' + tok, 'secret-a', now), null);
check('garbage', verifyConfirmToken('abc', 'secret-a', now), null);
```

- [ ] **Step 2: Run to verify it fails** — `npm run test:newsletter-token` → FAIL.
- [ ] **Step 3: Implement `token.ts`** with `node:crypto`.
- [ ] **Step 4: Run to verify it passes.**
- [ ] **Step 5: Commit** — `feat(newsletter): signed confirm tokens`

### Task 3: Event selection and series collapsing

**Files:**
- Create: `src/lib/newsletter/types.ts`, `src/lib/newsletter/select-events.ts`
- Test: `src/lib/__tests__/newsletter-select.test.ts`
- Modify: `package.json` (add `"test:newsletter-select"`)

**Interfaces:**
- Consumes: window shape from Task 1.
- Produces (`types.ts`):

```ts
export interface NewsletterSourceEvent {   // a public_events row + joins the fetch script adds
  id: string; title: string; description: string | null;
  start_date: string; end_date: string | null;
  start_time: string | null; end_time: string | null;
  parent_event_id: string | null; featured: boolean | null;
  external_image_url: string | null; image_alt_text: string | null;
  primary_tag_name: string | null; cost: string | null;
  location_name: string | null;
}
export interface IssueEvent {
  id: string;                 // series parent id for collapsed series
  title: string;
  displayDate: string;        // 'YYYY-MM-DD' it is listed under
  whenLabel: string;          // 'Sat, Nov 1 · 7pm', 'Fri–Sun, Oct 30–Nov 1', 'Tuesdays & Thursdays · 6pm', 'All day'
  locationName: string | null;
  imageUrl: string | null; imageAlt: string | null;
  description: string | null; featured: boolean; tag: string | null;
  occurrenceIds: string[];    // every source row id, for the pre-send re-check
}
export interface IssueEntry { event: IssueEvent; blurb?: string }
export interface NewsletterIssue {
  sendDate: string;           // sendDateKey
  subject: string; previewText: string; intro: string;
  featured: IssueEntry[];     // 1–3
  thisWeek: IssueEntry[];
  planAhead: IssueEntry[];    // 2–5
  announcements?: { title: string; body: string; url?: string }[];
}
```

- `selectIssueEvents(rows: NewsletterSourceEvent[], window: { start: string; end: string }): IssueEvent[]` — rows overlapping the window (start ≤ window.end and (end_date ?? start_date) ≥ window.start), grouped by `parent_event_id ?? id`, sorted by `displayDate` then start time. `displayDate` = max(first occurrence date, window.start).
- `whenLabel` rules: single occurrence → `'Sat, Nov 1 · 7pm'` (minutes shown only when non-zero: `'7:30pm'`); multi-day single row → `'Fri–Sun, Oct 30–Nov 1'`; series with ≥ 2 occurrences in window → plural weekday names joined with `, ` / ` & `, plus ` · <time>` only if all occurrences share a start time; no start time → `'All day'` in place of the time.

- [ ] **Step 1: Write the failing tests** — fixtures built with a `row(partial)` helper; window `{ start: '2026-10-30', end: '2026-11-05' }`:

```ts
check('outside window dropped', ids(selectIssueEvents([row({ id: 'a', start_date: '2026-11-06' })], W)), []);
check('multi-day started before window', pick(selectIssueEvents([row({ id: 'f', start_date: '2026-10-29', end_date: '2026-11-01' })], W)[0]),
  { displayDate: '2026-10-30', whenLabel: 'Thu–Sun, Oct 29–Nov 1' });
check('series collapses', pick(selectIssueEvents([
  row({ id: 'p', start_date: '2026-11-03', start_time: '18:00:00' }),
  row({ id: 'c1', parent_event_id: 'p', start_date: '2026-11-05', start_time: '18:00:00' }),
], W)[0]), { id: 'p', displayDate: '2026-11-03', whenLabel: 'Tuesdays & Thursdays · 6pm', occurrenceIds: ['p', 'c1'] });
check('no time', selectIssueEvents([row({ id: 'n', start_date: '2026-10-31', start_time: null })], W)[0].whenLabel, 'Sat, Oct 31 · All day');
check('half hour', selectIssueEvents([row({ id: 'h', start_date: '2026-10-31', start_time: '19:30:00' })], W)[0].whenLabel, 'Sat, Oct 31 · 7:30pm');
check('sorted', ids(selectIssueEvents([row({ id: 'b', start_date: '2026-11-02' }), row({ id: 'a', start_date: '2026-10-31' })], W)), ['a', 'b']);
```

- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement `select-events.ts`.** Child rows whose parent is outside the window still group under the parent id.
- [ ] **Step 4: Run to verify it passes.**
- [ ] **Step 5: Commit** — `feat(newsletter): select and collapse issue events`

### Task 4: Email rendering

**Files:**
- Create: `src/lib/newsletter/render.ts`
- Test: `src/lib/__tests__/newsletter-render.test.ts`
- Modify: `package.json` (add `"test:newsletter-render"`)

**Interfaces:**
- Consumes: `NewsletterIssue`, `IssueEvent` (Task 3).
- Produces:
  - `renderNewsletter(issue: NewsletterIssue, opts: { siteUrl: string }): string` — full HTML document.
  - `renderNewsletterText(issue: NewsletterIssue, opts: { siteUrl: string }): string` — plain-text alternative.
  - `renderConfirmEmail(confirmUrl: string): { subject: string; html: string; text: string }` — subject `'Confirm your subscription to This Week in Der Town'`.
  - `escapeHtml(s: string): string`

Layout: header "This Week in Der Town" + issue date; intro; **Featured** cards (image 600px wide via `imageCdnUrl`-style absolute URL `${siteUrl}/.netlify/images?url=…&w=1200&h=630&fit=cover`, title linking `${siteUrl}/events/<id>`, whenLabel, location, blurb ?? first ~200 chars of description); **This week** grouped by `displayDate` with a day heading (`'Friday, Oct 30'`); **Plan ahead**; optional **Announcements**; footer with site link, "You're getting this because you subscribed at dertown.org", and `<a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a>`. Colors: copy hex values from `COLORS.primary`/`primaryDark` in `src/lib/config.ts` (import is fine—config.ts has no `import.meta.env`). Table-based layout, inline styles only.

- [ ] **Step 1: Write the failing tests** (fixture issue with one featured, two this-week on different days, one plan-ahead):

```ts
const html = renderNewsletter(issue, { siteUrl: 'https://dertown.org' });
check('unsubscribe placeholder', html.includes('{{{RESEND_UNSUBSCRIBE_URL}}}'), true);
check('event link absolute', html.includes('href="https://dertown.org/events/evt-1"'), true);
check('escapes title', html.includes('Beer &amp; <b>Brats</b>'), false);
check('escaped form present', html.includes('Beer &amp; &lt;b&gt;Brats&lt;/b&gt;'), true);
check('no image → no img tag for it', countImgTags(renderNewsletter(issueWithoutImages, opts)), 0);
check('no null/undefined leaks', /\b(null|undefined)\b/.test(renderNewsletter(sparseIssue, opts)), false);
check('day headings', html.includes('Friday, Oct 30') && html.includes('Saturday, Oct 31'), true);
check('no <style> or <script>', /<(style|script)\b/i.test(html), false);
check('text version has links', renderNewsletterText(issue, opts).includes('https://dertown.org/events/evt-1'), true);
check('confirm email has url', renderConfirmEmail('https://dertown.org/newsletter/confirm?token=abc').html.includes('token=abc'), true);
```

- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement `render.ts`.** Escape every interpolated string; escape URLs in attributes too.
- [ ] **Step 4: Run to verify it passes.** Then render the fixture to `/tmp`-style scratch HTML and eyeball it in the browser pane at desktop and 375px widths.
- [ ] **Step 5: Commit** — `feat(newsletter): email-safe HTML template`

### Task 5: Signup form, subscribe endpoint, confirm page

**Files:**
- Create: `src/lib/newsletter/resend-client.ts`, `src/pages/api/newsletter/subscribe.ts`, `src/pages/newsletter/confirm.astro`, `src/components/NewsletterSignup.astro`
- Modify: `src/components/Footer.astro` (signup above the link rows), `env.example`, `EMAIL_SETUP.md` (new "Newsletter" section: env vars, creating the segment, verifying the domain), `src/pages/privacy.astro` (one sentence: newsletter emails are stored with Resend and you can unsubscribe any time)

**Interfaces:**
- Consumes: `normalizeEmail`, `signConfirmToken`, `verifyConfirmToken` (Task 2); `renderConfirmEmail` (Task 4); `jsonResponse`/`jsonError` from `src/lib/api-utils.ts`; `SITE_URL` from `src/lib/site.ts`.
- Produces (`resend-client.ts`, pure — takes config, no env reads):
  - `addConfirmedSubscriber(resend: Resend, segmentId: string, email: string): Promise<void>` — `resend.contacts.create({ email, unsubscribed: false, segments: [{ id: segmentId }] })`; if Resend reports the contact already exists, `contacts.update({ email, unsubscribed: false })` then `contacts.segments.add({ email, segmentId })` (check exact method names against `node_modules/resend/dist/index.d.mts`). Throws on any other error.

Behavior:
- `POST /api/newsletter/subscribe`, `prerender = false`, JSON body `{ email, website }` (`website` is the honeypot). Honeypot filled → 200 with the normal message, send nothing. Invalid email → 400 `'Please enter a valid email address.'`. Otherwise send the confirm email via `resend.emails.send` from `NEWSLETTER_FROM_EMAIL` and return 200 `{ message: 'Check your inbox for a confirmation link.' }`. Missing env → 500 with a logged error (no silent success).
- `/newsletter/confirm?token=…`, `prerender = false`: valid token → `addConfirmedSubscriber` → "You're subscribed to This Week in Der Town" page using `Layout.astro`; invalid/expired → friendly page with a link back to the signup. Resend error → error message page, logged.
- `NewsletterSignup.astro`: heading "This Week in Der Town", one line "Next week's events in your inbox every Thursday.", email input, hidden honeypot input (`name="website"`, `tabindex="-1"`, `autocomplete="off"`, visually hidden), Subscribe button; inline `<script>` posts JSON with `fetch`, shows the response message, disables the button while pending. Tailwind classes matching the footer.

- [ ] **Step 1: Write the failing test** `src/lib/__tests__/newsletter-subscribe-wiring.test.ts` (wiring test in the repo's `*-wiring.test.ts` style — read source files as text):

```ts
check('footer renders signup', footer.includes('<NewsletterSignup'), true);
check('honeypot field', signup.includes('name="website"'), true);
check('endpoint not prerendered', subscribe.includes('export const prerender = false'), true);
check('endpoint uses newsletter key', subscribe.includes('RESEND_NEWSLETTER_API_KEY'), true);
check('endpoint does not use transactional key', subscribe.includes('env.RESEND_API_KEY'), false);
check('confirm page verifies token', confirm.includes('verifyConfirmToken'), true);
check('env.example documents secrets', ['RESEND_NEWSLETTER_API_KEY','RESEND_NEWSLETTER_SEGMENT_ID','NEWSLETTER_FROM_EMAIL','NEWSLETTER_SIGNING_SECRET'].every(k => envExample.includes(k)), true);
```

- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement the four files and the modifications.**
- [ ] **Step 4: Verify** — wiring test PASS; `npm run lint`; `npx astro check`; `npm run build`. (Dev server doesn't run in the sandbox; live test happens after deploy.)
- [ ] **Step 5: Commit** — `feat(newsletter): double opt-in signup in site footer`

### Task 6: CLI scripts the skill drives

**Files:**
- Create: `scripts/newsletter/env.ts`, `scripts/newsletter/fetch.ts`, `scripts/newsletter/render.ts`, `scripts/newsletter/resend.ts`
- Modify: `.gitignore` (add `newsletters/`), `package.json` (add `"newsletter": "tsx --env-file=.env.local scripts/newsletter/resend.ts"`, `"newsletter:fetch": "tsx --env-file=.env.local scripts/newsletter/fetch.ts"`, `"newsletter:render": "tsx scripts/newsletter/render.ts"`)

**Interfaces:**
- Consumes: Tasks 1, 3, 4 exports; `addConfirmedSubscriber` not needed here.
- Produces (CLI contracts the skill relies on):
  - `npm run newsletter:fetch [-- --send-date YYYY-MM-DD]` → writes `newsletters/<sendDate>.source.json` = `{ sendDate, sendAtIso, windows, thisWeek: IssueEvent[], planAhead: IssueEvent[], announcements: {title, body, url?}[] }` and prints a short summary (counts per day, featured flags). Reads `public_events` with the anon key (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_KEY`), joining location name via `location_id`; active public announcements from the existing announcements view/table used by `AnnouncementMarquee.astro`.
  - `npm run newsletter:render -- <sendDate>` → reads `newsletters/<sendDate>.json` (`NewsletterIssue`), writes `newsletters/<sendDate>.html` and `.txt`, prints paths. Exits non-zero with a clear message if JSON is missing fields.
  - `npm run newsletter -- <cmd>`:
    - `check-setup` — verifies env vars present, `resend.domains.list()` shows the sender's domain as `verified`, the segment exists; prints contact count. Never prints key values.
    - `create-segment` — creates segment "This Week in Der Town", prints its id to put in env.
    - `test-send <sendDate> <to>` — `emails.send` the rendered HTML/text, subject prefixed `[TEST] `.
    - `verify <sendDate>` — re-queries every `occurrenceIds` from the issue JSON in `public_events`; lists any that are gone or whose date/time/title changed. Exit 0 if clean, 2 if changes.
    - `schedule <sendDate> --approved` — refuses without `--approved`; refuses if `sendAtIso` < now + 1h; runs `verify` first and refuses on exit 2; `broadcasts.create({ segmentId, from, subject, previewText, html, text, name: 'This Week in Der Town <sendDate>', send: true, scheduledAt: sendAtIso })`; writes `{ broadcastId, scheduledAt }` into `newsletters/<sendDate>.sent.json`.
    - `status <sendDate>` — `broadcasts.get` for the saved id.
    - `cancel <sendDate>` — `broadcasts.remove` the saved id (only works while still scheduled); deletes nothing locally.
  - `scripts/newsletter/env.ts`: `requireEnv(name: string): string` — throws `Missing env var <name> (add it to .env.local)`.

- [ ] **Step 1: Write the failing test** `src/lib/__tests__/newsletter-cli-guard.test.ts`: spawn `tsx scripts/newsletter/resend.ts schedule 2026-10-29` (no `--approved`) with an empty env and assert exit code ≠ 0 and stderr contains `--approved`; spawn `newsletter:render` on a fixture JSON in a temp dir (accept `--dir` flag for tests) and assert `.html` exists.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement the scripts.** Argument parsing by hand (`process.argv`), no new deps. `--dir <path>` overrides `newsletters/` for tests.
- [ ] **Step 4: Verify** — test PASS; `npm run newsletter:fetch` against prod (read-only) produces a sane `.source.json`; `npm run newsletter -- check-setup` once the editor has added the key.
- [ ] **Step 5: Commit** — `feat(newsletter): CLI for fetch, render, test-send, schedule`

### Task 7: The `/newsletter` skill

**Files:**
- Create: `.claude/skills/newsletter/SKILL.md`

**Interfaces:**
- Consumes: Task 6 CLI contracts and `NewsletterIssue` shape (Task 3).

Frontmatter: `name: newsletter`, description: "Draft, revise, and schedule the weekly 'This Week in Der Town' email. Use when the editor runs /newsletter or asks to work on the newsletter; `/newsletter check` re-verifies a scheduled issue." Body covers:

1. **Draft mode (default):** run `npm run newsletter -- check-setup` (stop and explain on failure) → `npm run newsletter:fetch` → summarize the week in a few lines → write `newsletters/<sendDate>.json`: subject (≤ 60 chars), previewText (≤ 90), a warm 2–3 sentence intro in a local, friendly voice, 1–3 featured (prefer `featured: true`, images, broad appeal, variety of tags), all of `thisWeek` minus obvious noise, 2–5 planAhead (prefer festivals/ticketed/multi-day), announcements if any. Blurbs 1–2 sentences, from the event description only — never invent details (times, prices, names).
2. Render with `npm run newsletter:render -- <sendDate>` and open `newsletters/<sendDate>.html` in the browser pane; screenshot at 600px and 375px.
3. Revise on request; edit the JSON (never the HTML), re-render, re-preview.
4. Offer `test-send` to the editor's address (ask which address; don't assume).
5. **Approval:** only when the editor explicitly says to approve/schedule/send *this* issue in this session: run `schedule <sendDate> --approved`. If `verify` reports changes, show them, fix the JSON, re-render, and ask again. If the send time is too close, ask "send now or next week?" — never choose. Report the scheduled time in Pacific and how to cancel (`npm run newsletter -- cancel <sendDate>` or Resend dashboard → Broadcasts).
6. **`/newsletter check` mode:** run `verify <sendDate>` for the upcoming scheduled issue; if clean, say so; if not, show changes and offer: cancel + reschedule a corrected issue, or leave it.

Never pass `--approved` based on anything but the editor's own words in this session.

- [ ] **Step 1: Write SKILL.md.**
- [ ] **Step 2: Dry run** — invoke the skill end-to-end up to (not including) scheduling; confirm the draft, render, and preview steps work against prod data.
- [ ] **Step 3: Commit** — `feat(newsletter): /newsletter Claude skill`

### Task 8: Go-live checklist (editor + Claude together)

- [ ] Editor adds `RESEND_NEWSLETTER_API_KEY` to `.env.local` and Netlify.
- [ ] `npm run newsletter -- check-setup` — domain verified? If not, editor verifies dertown.org in Resend → Domains.
- [ ] `npm run newsletter -- create-segment`; editor adds `RESEND_NEWSLETTER_SEGMENT_ID`, `NEWSLETTER_FROM_EMAIL`, and a random `NEWSLETTER_SIGNING_SECRET` (`openssl rand -base64 32`) to `.env.local` and Netlify.
- [ ] Push to main (deploys); editor subscribes from the live footer, clicks the confirm link, sees the contact in Resend.
- [ ] First `/newsletter` run with `test-send` to the editor before any real schedule.
