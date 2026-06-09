# Kid Activities — Product Requirements (Consolidated)

> **Canonical spec.** This document supersedes:
> - `KID_ACTIVITY_CALENDAR_EVENTS.md` — stale; describes a renamed `kid_activities`
>   table and marks a calendar engine "✅ complete" that is actually unwired stubs.
> - `docs/superpowers/plans/2026-06-08-kid-activities-admin-crud.md` — delivered; basic
>   admin CRUD only.

---

## Context — why this exists

Three artifacts disagreed about what the Kid Activities feature is:

1. **`KID_ACTIVITY_CALENDAR_EVENTS.md`** — an ambitious design for a `kid_activities`
   table with a full calendar engine (`activity_events`, `recurrence_patterns`,
   `event_exceptions`, `calendar_exceptions`) marked ✅ COMPLETE.
2. **`docs/superpowers/plans/2026-06-08-kid-activities-admin-crud.md`** — delivered basic
   admin CRUD on the `activities` table; treated all scheduling as out-of-scope stubs.
3. **The live schema** — table is `activities` (not `kid_activities`); a May-2026 migration
   added `program_format` (`camp|league|lesson|class|session`) that *neither* doc reconciles;
   the calendar tables exist but are wired to nothing (admin buttons just `alert()`).

On top of this, the AI importer created **every camp-week as its own top-level PROGRAM**,
producing an unusable activity list.

**Three discrepancies this PRD resolves:**
- **Naming:** the table is `activities`. The old doc's `kid_activities` is dead.
- **`program_format` vs `activity_hierarchy_type`:** "session" collides between them.
  Resolved below — format is a *template* on the top-level offering; SESSION stays a tier only.
- **Calendar layer:** the RRULE/recurrence/exceptions engine is abandoned in favor of the
  **materialized event-series pattern already used by regular events**.

**Intended outcome:** a clean data model + admin authoring + public discovery that satisfies
two concrete parent workflows:
- **A — "anything soccer for my kid born in 2016, and let me subscribe."** Cross-program
  discovery by activity type + age/grade, a program summary showing days/dates without
  drill-down, and a subscribable calendar feed.
- **B — "something for my kid to do the week of July 17th."** A date-window filter that
  returns camp *weeks* (SESSIONs) whose dates intersect that window, grouped under their camp.

---

## Decisions

| Decision | Resolution |
|---|---|
| Storage | **One `activities` table** (adjacency list via `parent_activity_id`). `program_format` is a structural template, not a free tag. No per-format tables (shared column surface too large; discovery needs cross-type queries). |
| `program_format` enum | **`camp · league · class · workshop`**. Drop `session` (collides with the SESSION tier). Merge `lesson` → `class`. |
| Camp structure | **1 PROGRAM → 1 SESSION per week.** (Fixes the AI-import mess.) |
| Registration | **Program default + per-SESSION override** (resolve by walking up ancestors, like effective-location). |
| Scheduling | **Materialized dated occurrences** (event-series style), *not* RRULE. Generate concrete rows; edit/delete individually. |
| Reminders | **Subscribable iCal/webcal feeds** (mimic events). No server-side follow table for v1. Push notifications deferred to mobile. |
| Age input | Accept **birth year (→ computed age) and grade**; both map to existing `min/max_age` + `min/max_grade`. |

---

## Data model — the template-per-format rule

`activity_hierarchy_type` stays `PROGRAM | SESSION | CLASS_TYPE | CLASS_INSTANCE`.
The **top-level row is always a PROGRAM**; depth below it is determined by `program_format`:

| `program_format` | Shape | Example |
|---|---|---|
| **workshop** | PROGRAM only — **parentless leaf** with its own occurrence date(s) | "Watercolor Workshop, Jul 12" |
| **camp** | PROGRAM → **SESSION per week** (each week: own dates + optional registration override) | "Summer Soccer Camp" → "Week of Jul 14", "Week of Jul 21"… |
| **class** | PROGRAM → CLASS_TYPE → CLASS_INSTANCE (time slot) | "Apple Gymnastics" → "Apple Buds (3-5)" → "Mon 3-4pm" |
| **league** | PROGRAM → SESSION (season) → CLASS_TYPE (division) → CLASS_INSTANCE (team) | "Leavenworth Soccer Club" → "Fall 2026" → "U10 Boys" → "Red Team" |

Format drives three things: (1) the admin "add child" affordances, (2) the AI importer's
target shape, (3) how the public page summarizes the program. This is what keeps the data
legible without splitting tables — and what prevents a repeat of the 12-sibling-PROGRAM mess.

**Inheritance resolvers** (generalize the existing `get_effective_location` /
`get_activity_ancestors` pattern in `src/pages/api/admin/kid-activities/[id]/effective-location.ts`):
- *effective location* — already built.
- *effective registration* — new: a SESSION/CLASS_INSTANCE inherits `registration_*` from its
  PROGRAM unless it sets its own.

---

## Scheduling — reuse the event-series mechanism

Mirror regular events exactly. Reference implementation:
- Generator UI: `src/pages/admin/series.astro` ("Add Occurrences": weekly = start + N / by weekday
  range / custom dates).
- Bulk insert: `src/pages/api/admin/events/bulk-create.ts`; bulk edit: `bulk-update.ts`.

For activities, generate **`activity_events` rows with `event_type='ONE_OFF'`** (the table's
CHECK constraint already supports dated ONE_OFF rows with no recurrence pattern). Each occurrence
is an independent, editable/deletable row. **No RRULE expansion at read time.**
- Simple camps may rely on the SESSION's own `start_date`/`end_date` and skip per-day occurrences.
- Recurring classes (MWF) and leagues (practices/games) use generated occurrences.
- `recurrence_patterns` + `event_exceptions` tables become **dormant/deprecated** (left in place,
  not relied upon).

The current stub `src/pages/api/admin/kid-activities/[id]/activity-events.ts` (returns `{events:[]}`)
becomes the real occurrence CRUD + bulk-generate endpoint.

---

## Public discovery (families page)

Implements the 5 filter dimensions from the original UX doc + the two acceptance workflows.
Reuse existing components: `ActivityFilters.astro`, `ActivityCard.astro`, `ScheduleView.astro`,
`ProgramView.astro`, `ViewToggle.astro`; query the `public_activities` view + occurrences.

1. **Specific program** — name search.
2. **Activity type** — sports/arts/music/dance/academic/recreation/other.
3. **Age / grade** — birth-year (→age) and grade, filtered against `min/max_age`, `min/max_grade` with inheritance.
4. **Month/season + date window** — "week of Jul 17" intersects SESSION date ranges / occurrence dates.
5. **Day of week** — derived from occurrence datetimes (e.g. "Wednesday afternoons").

- **Permalinks:** filter state lives in URL query params (bookmarkable/shareable).
- **Program summary (no drill-down):** a program lists its sessions / class-types / instances
  with days + dates inline.
- **Program detail page:** full drill-down per program.

---

## Subscription / reminders — calendar feeds

Mimic the events iCal pattern. Reference: `src/pages/api/organizations/[id]/ical.ts`,
`src/pages/api/locations/[id]/ical.ts`.

- New iCal/webcal endpoints for (a) a single program and (b) a filtered search (same query params
  as the permalink). Feed contains **registration open/close dates and session/occurrence dates** as
  VEVENTs, with VALARM reminders.
- "Add to calendar / Subscribe" buttons (Google / Apple / Samsung via webcal) on program + filtered views.
- **Stateless** — feed URL encodes the filter; no follow/subscription table needed for v1.
- **Deferred:** mobile push (the `push_tokens` table exists; no sender yet) and personal-schedule import.

---

## AI import cleanup

1. **Fix the importer** (`src/pages/api/admin/activity-import.ts`) to emit the correct
   per-format hierarchy — a multi-week camp produces **1 PROGRAM + N weekly SESSIONs**, never N PROGRAMs.
2. **Purge the existing bad drafts:** they are `status='pending'`; use the existing
   "Delete All Pending" bulk action, then re-import with the fixed importer.
   (Re-import is simpler and safer than reparenting the orphan siblings in place.)

---

## Critical files

**Schema / types**
- `supabase/migrations/<new>_*.sql` — update `program_format` CHECK to `camp|league|class|workshop`;
  migrate existing `lesson`→`class` and `session`→(reclassify); add effective-registration resolver fn.
- `src/types/database.ts` — regenerate.

**Admin authoring**
- `src/pages/admin/kid-activities.astro` — format-aware templates; wire the already-stubbed
  Add Session / Add Class Type / Add Class Instance + occurrence generator.
- `src/pages/api/admin/kid-activities/[id]/activity-events.ts` — stub → real occurrence CRUD + bulk generate.
- `src/pages/api/admin/kid-activities/[id]/` — effective-registration endpoint (mirror effective-location).
- `src/pages/api/admin/activity-import.ts` — per-format hierarchy mapping.

**Public discovery + feeds**
- `src/pages/families/{camps,programs,activities}.astro` + the Activity* components.
- `src/pages/api/kid-activities/[id]/ical.ts` + a search-feed iCal endpoint (mirror org/location iCal).

**Reuse (do not reinvent)**
- Series generation: `src/pages/admin/series.astro`, `api/admin/events/bulk-create.ts`, `bulk-update.ts`.
- iCal: `api/organizations/[id]/ical.ts`, `api/locations/[id]/ical.ts`.
- Inheritance: `get_activity_ancestors`, `get_effective_location` (live in the DB; used by effective-location.ts).
- Public read model: `public_activities` view.

---

## Suggested phasing

- **P0 — Schema reconciliation:** program_format enum migration + type regen + supersede the two docs.
- **P1 — Admin completeness:** format templates, occurrence generator (event-series), effective-registration.
- **P2 — Importer + data cleanup:** fix importer shape; purge pending; re-import.
- **P3 — Public discovery:** 5 filters + permalinks + program summary + detail page.
- **P4 — Calendar subscription:** program + search iCal feeds; add-to-calendar buttons.
- **Deferred:** mobile push, personal-schedule import, advanced recurrence/exceptions.

---

## Verification (acceptance)

**Workflow A — soccer, born 2016, subscribe**
- Public page: filter `type=sports` + age 9 (or grade 4) → returns matching activities across
  *multiple* programs.
- Open a program → its sessions/instances show days + dates inline (no drill-down needed).
- Click Subscribe → iCal feed downloads and validates in Google/Apple Calendar; registration
  open/close appears as calendar events with alarms.

**Workflow B — week of July 17**
- Date-window filter for Jul 13–19 → camp SESSIONs whose dates intersect that week appear,
  grouped under their parent camp PROGRAM. No standalone camp-week PROGRAMs in results.

**Admin**
- Create one of each format via templates; verify hierarchy depth matches the table above.
- Generate weekly occurrences for a class (e.g. every Mon Sep→Jun); delete a single occurrence;
  confirm others unaffected.
- Set a per-week registration override on a camp SESSION; confirm it overrides the PROGRAM default.

**Importer / data**
- Import a multi-week camp → exactly 1 PROGRAM + N SESSIONs.
- After cleanup: zero orphan sibling camp-week PROGRAMs remain (`status='pending'` purged).

---

## Open follow-ups (not blocking)

- Inspect current `activities` rows to size the cleanup: a read-only count of pending PROGRAMs
  grouped by name prefix, before purging.
- Confirm whether `workshops` ever need multiple sections (would add optional CLASS_INSTANCE children).
