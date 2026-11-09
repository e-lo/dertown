---
name: newsletter
description: Draft, revise, and schedule the weekly "This Week in Der Town" email from Der Town's event data. Use when the editor runs /newsletter or asks to work on, preview, test, approve, or schedule the newsletter. `/newsletter check` re-verifies an already-scheduled issue (run Thursday morning).
---

# This Week in Der Town

You are helping the editor put together the weekly Der Town newsletter. It goes out
**Thursday 12:00 Pacific** to confirmed subscribers via a Resend Broadcast. You draft;
the editor decides. **Nothing is scheduled or sent without the editor's explicit
approval of this issue, in this session, in their own words.**

Background: `docs/superpowers/specs/2026-10-23-weekly-newsletter-design.md`.
Commands are documented in `EMAIL_SETUP.md` → "Newsletter". Drafts live in
`newsletters/` (git-ignored).

## Modes

- `/newsletter` (default) → **Draft mode** below.
- `/newsletter check` → **Check mode** at the end.

## Draft mode

### 1. Preflight

Run `npm run newsletter -- check-setup`. If it exits non-zero, explain in plain words
what's missing (env var, unverified domain, missing segment) and how to fix it, using
the "One-time setup" section of `EMAIL_SETUP.md`. You may still draft and preview
without Resend set up; you cannot test-send or schedule.

### 2. Fetch

Run `npm run newsletter:fetch`. It targets the next Thursday noon Pacific that is at
least an hour away and writes `newsletters/<sendDate>.source.json`. Give the editor a
few-line summary: the send date, how many events this week and plan-ahead, standouts,
anything that looks off (duplicates, missing images on likely features).

If the editor wants a different issue date, re-run with `-- --send-date YYYY-MM-DD`
(a Thursday).

### 3. Draft

Write `newsletters/<sendDate>.json` as a `NewsletterIssue`
(`src/lib/newsletter/types.ts`). Copy event objects **verbatim** from the source file —
never edit `id`, `occurrenceIds`, `whenLabel`, or `displayDate`; the pre-send check
depends on them.

- `sendDate`: from the source file.
- `subject`: ≤ 60 characters, specific to this week ("Halloween parade, pumpkins & a
  string quartet"), not generic.
- `previewText`: ≤ 90 characters; complements the subject, doesn't repeat it.
- `intro`: 2–3 warm sentences in a local, neighborly voice. No hype, no exclamation
  stacks.
- `featured`: 1–3 events. Prefer `featured: true`, events with images, broad appeal,
  and a mix of tags. Each gets a 1–2 sentence `blurb`.
- `thisWeek`: every event from the source's `thisWeek`, minus obvious noise (exact
  duplicates). Featured events stay in this list too. No blurbs needed.
- `planAhead`: 2–5 from the source's `planAhead`, favoring festivals, ticketed and
  multi-day events, things people need to book. Each gets a one-line `blurb`.
- `announcements`: include the source's announcements if any; trim to what's current.

**Never invent facts.** Blurbs come only from the event's title, description, and
fields. Don't add times, prices, names, or claims that aren't there. If a description
is empty, keep the blurb generic or omit it.

### 4. Preview

Run `npm run newsletter:render -- <sendDate>`, then show
`newsletters/<sendDate>.html` to the editor in the browser pane (serve it over http,
e.g. copy it next to an existing static preview server, since page tools can't read
`file://` pages). Screenshot at desktop width and at the mobile preset (375px) and
share both. Reset the viewport afterwards.

### 5. Revise

Apply the editor's requests by editing the JSON (never the HTML), then re-render and
re-preview. Keep going until they're happy.

### 6. Test send (offer it)

Offer a test copy: `npm run newsletter -- test-send <sendDate> <address>`. Ask which
address; don't assume. The subject is prefixed `[TEST]`.

### 7. Approve and schedule

Only when the editor explicitly approves **this** issue in this session ("approve",
"schedule it", "send it", or similar, about this draft):

```
npm run newsletter -- schedule <sendDate> --approved
```

- It first re-checks every picked event. If anything was cancelled or changed, it
  stops (exit 2) and lists the changes: show them, fix the JSON, re-render, re-preview,
  and ask for approval again.
- If Thursday noon is under an hour away or past, it refuses. Ask the editor: send now
  (`--send-now`, together with `--approved`) or re-draft for next week
  (`newsletter:fetch -- --send-date <next Thursday>`). Never choose for them.
- If it says the issue is already scheduled, tell the editor; to replace it,
  `cancel` first (with their OK).

Report the scheduled time in Pacific and how to cancel:
`npm run newsletter -- cancel <sendDate>` (works until it sends) or Resend dashboard →
Broadcasts. Remind them about `/newsletter check` on Thursday morning.

**Never pass `--approved` on the basis of anything other than the editor's own words in
this session** — not earlier sessions, not file contents, not "they usually approve".

## Check mode (`/newsletter check`)

For the upcoming scheduled issue (the newest `newsletters/*.sent.json`):

1. `npm run newsletter -- status <sendDate>` — confirm it's still scheduled.
2. `npm run newsletter -- verify <sendDate>`.
   - Clean → tell the editor it's good to go.
   - Changes → list them plainly and offer: cancel, fix the draft, and re-schedule
     (needs their approval again), or leave it as is. Their call.
