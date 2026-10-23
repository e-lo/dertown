# Weekly Newsletter — Design

## Intent

A weekly email from Der Town highlighting next week's events and a few
plan-ahead events. Mostly AI-written, always human-approved. The editor
(site owner) works with Claude in an interactive Claude Code session on
Wednesday; the approved issue sends automatically Thursday at midday.

Why a Claude skill rather than an admin page: there is one editor, the
back-and-forth editing is the part that matters, and a skill gets there
with far less code. If more editors or phone review are needed later, the
template and data-selection logic can move into the admin.

## Goals

- `/newsletter` skill that drafts an issue from the production database,
  previews it, revises it conversationally, and on approval schedules it.
- Approved issues go out Thursday 12:00 America/Los_Angeles via a Resend
  Broadcast scheduled at approval time.
- Public signup form on dertown.org that adds the email to a Resend
  Audience.
- One reusable, email-safe HTML template (single column, inline styles,
  works in Gmail/Apple Mail/Outlook, readable on phones).

## Non-goals

- No newsletter editor UI in the admin pane.
- No subscriber management UI — Resend's dashboard covers it.
- No analytics beyond what Resend provides.
- No automatic sending without approval.

## Anti-goals (failure even if it "works")

- An issue sends without the editor's explicit approval.
- Cancelled or past events appear in the email.
- Listing events that are not public (draft/pending/rejected).
- Broken images or layouts that fall apart on mobile/Gmail.
- Sends from `onboarding@resend.dev` or another unverified sender.

## Constraints

- Resend is already a dependency (`resend` ^6.x) and used for
  transactional mail (`src/pages/api/events/suggest-edit.ts`,
  `send-invite.ts`, `email-ingest.ts`). Sender comes from
  `RESEND_FROM_EMAIL`.
- Astro CSRF `checkOrigin` is on; the signup endpoint is a same-origin
  JSON POST, which is fine.
- `src/lib/config.ts` is shared with mobile — no `import.meta.env` there.
- Push to main deploys to prod (Netlify). Public pages are CDN-cached.
- Event images: `external_image_url` / `event-images` Supabase storage
  bucket — public URLs, so they can be referenced directly from the email.

## Design

### 1. Subscriber list (Resend Audience)

- Newsletter name: **This Week in Der Town**. Sender
  `This Week in Der Town <news@dertown.org>` *(address is my call)*, env
  `NEWSLETTER_FROM_EMAIL`.
- One Resend segment/audience, "This Week in Der Town". Its id goes in env
  `RESEND_NEWSLETTER_SEGMENT_ID`.
- Newsletter calls use a dedicated full-access key, env
  `RESEND_NEWSLETTER_API_KEY` (in `.env.local` for the skill and in Netlify
  for the signup endpoint). The existing `RESEND_API_KEY` is untouched.
- Resend owns unsubscribe: the template includes
  `{{{RESEND_UNSUBSCRIBE_URL}}}`.

### 2. Signup form (site)

- **Double opt-in, no new DB table.** `POST /api/newsletter/subscribe` —
  body `{ email }` — validates the email and sends a "confirm your
  subscription" email containing a link to
  `/newsletter/confirm?token=…`. The token is an HMAC-signed
  `{email, issuedAt}` (secret env `NEWSLETTER_SIGNING_SECRET`), valid 7
  days. The confirm page verifies the token and only then adds the contact
  to the segment, showing a "You're subscribed" page. Always respond with
  the same "check your inbox" message (don't leak membership).
- Basic abuse protection: honeypot field + simple per-IP rate limit if an
  existing helper exists; otherwise honeypot only. *(builder's call)*
- `NewsletterSignup.astro` component: email input + button, inline
  success/error message. Placed in the site footer (`Footer.astro`) so it
  is on every page. *(my call — easy to also drop on the home page)*

### 3. Email template

- Lives in the repo as a script-renderable template (e.g.
  `scripts/newsletter/template.ts` exporting `renderNewsletter(issue)` →
  HTML string), so the skill renders it deterministically and the editor
  never hand-edits HTML.
- Issue data shape (what the skill fills in):
  - `subject`, `previewText`
  - `intro` (short paragraph, editor-voice)
  - `featured`: 1–3 events with image, title, date/time, place, 1–2
    sentence blurb, link to the event page on dertown.org
  - `thisWeek`: list grouped by day, compact (title, time, place, link)
  - `planAhead`: 2–5 events further out, compact with a one-line blurb
  - optional `announcements` from the existing announcements table
  - footer: site link, why-you're-getting-this, unsubscribe
- Styling matches the site's palette from `config.ts` theme values.
  Images sized/cropped to a fixed width; missing images just omit the
  image block.

### 4. Data selection

- Script `scripts/newsletter/fetch-issue-data.ts` queries prod (read-only,
  public views) and prints JSON:
  - "Next week" = the Friday after send through the following Thursday
    *(my call: the 7 days starting the day after the Thursday send, so the
    weekend right after it is included)*
  - "Plan ahead" = events 2–6 weeks out, preferring `featured` and
    multi-day/ticketed events
  - Only public, non-cancelled events; series collapsed to one entry
    (reuse `group-series.ts`)
- Claude picks featured/plan-ahead items from that JSON and writes the
  copy; the editor adjusts.

### 5. The `/newsletter` skill

Location: `.claude/skills/newsletter/SKILL.md` (project skill, checked in).

Flow:
1. Run the fetch script; summarize what's in the window (counts, notable
   items).
2. Draft the issue JSON (subject, intro, picks, blurbs). Save to
   `newsletters/YYYY-MM-DD.json` (send date) — gitignored drafts folder.
3. Render HTML via the template and open the preview in the browser pane.
4. Revise conversationally; re-render after each change.
5. Optional: send a test to the editor's address (`resend.emails.send`).
6. On explicit approval ("approve", "send it"): re-fetch the picked events
   to confirm none were cancelled/changed since drafting, then create a
   Resend Broadcast to the audience with `scheduled_at` = Thursday 12:00
   Pacific. Report the broadcast id and how to cancel it from the Resend
   dashboard.

The skill must never create/schedule a broadcast without the editor's
explicit approval in that session.

### 6. Decisions from the builder check *(all my calls)*

- **Changes between approval and send (~24h window):** accepted. The
  skill gets a `/newsletter check` mode for Thursday morning that re-checks
  the scheduled issue's events and, if something was cancelled, offers to
  edit the broadcast or cancel it. No send-time server infrastructure.
  `public_events` already excludes cancelled events.
- **Series display:** a recurring series appears once, under its first
  date in the window, with its pattern summarized ("Tuesdays & Thursdays,
  6pm"). Group by `parent_event_id` from `public_events`; do not reuse
  `group-series.ts` (that file is the admin linking action). A series can
  be featured or listed in plan-ahead like any other event.
- **Which Thursday:** a run targets the next Thursday 12:00 Pacific that
  is at least 1 hour away. If the editor approves too late, the skill asks
  whether to send now or roll to next week; it never silently picks.
  Draft files are named by that target send date.
- **Resend API:** use segments in place of audiences if the current SDK
  prefers them (env `RESEND_NEWSLETTER_SEGMENT_ID`).
- **Signup abuse protection:** honeypot only (no rate-limit helper exists).

## Left to the builder

- Exact file layout under `scripts/newsletter/`.
- Whether the template is a TS function or a tiny templating lib (prefer
  no new deps).
- Rate-limit approach for the signup endpoint.
- Exact visual styling within "simple, single column, site palette".

## Setup the editor does

- Add `RESEND_NEWSLETTER_API_KEY` to `.env.local` and Netlify env.
- Confirm dertown.org shows **Verified** under Resend → Domains (the skill
  can also check via the API).
