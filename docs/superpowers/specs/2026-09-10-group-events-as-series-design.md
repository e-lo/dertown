# Design: Group Pending Events as a Series

**Date:** 2026-09-10
**Feature:** One-step grouping of existing pending events under a new or existing series parent
**Scope:** Admin dashboard Approve Events queue, one new admin API route, one shared helper

## Problem

Multi-day events (a library used book sale, a three-night play) arrive in the review queue as one pending row per day. Today the admin must:

1. Create a new event by hand to serve as the series parent, copying every field from one of the drafts.
2. Approve that parent.
3. Open each draft individually and set its parent via the autocomplete.

The existing "Create Series" modal does not help: it generates *new* child events from a date pattern and cannot adopt rows that already exist.

## Goals

- Select one or more pending events in the queue and group them under a series parent in a single action.
- The parent's fields are prefilled from the selection and fully editable before it is created.
- The parent is created as an approved, calendar-excluded event so children can be linked and approved immediately.
- Children stay pending. Each remains individually editable and approvable exactly as today; only their parent link changes.
- A single selected child is allowed. Later occurrences often are not scheduled yet.
- Works for every intake path (scraper, email ingest, paste import, manual submission) because it operates on queue rows, not sources.

## Non-goals

- Auto-detecting which rows belong together. A "similar rows" suggestion is a possible follow-up once this lands.
- Approving children as part of the group action.
- Nested series. A row that already has children cannot be selected as a child.
- Changing how the public site renders series. The event page already lists a parent's children.

## Current building blocks

- `events_staged.parent_event_id` may only reference another staged row (FK). Staged rows link to an *approved* parent via a `[SCRAPER_APPROVED_PARENT_ID:<uuid>]` marker in `comments`. The staged approve route reads that marker and writes the real `parent_event_id` on the approved copy.
- `events.parent_event_id` references `events.id` directly.
- The staged-list route already computes `effective_parent_id` and `parent_title` from either the FK or the marker, and the queue renders a "child of: …" badge from them.
- The marker regex and `applyApprovedParentMarker` are copy-pasted in `src/pages/api/admin/events-staged/approve.ts` and `src/pages/api/admin/events-staged/edit.ts`.
- The existing Create Series modal creates parents with `status: 'approved'`, `exclude_from_calendar: true`, and `start_date` set to the first occurrence.

## Design

### 1. Queue selection

In the Approve Events table on `/admin`:

- Add a leading checkbox column. Rows that are already series parents (`is_series_parent`) render a disabled checkbox with a tooltip "Already a series parent".
- A selection bar appears above the table once at least one row is checked. It shows "N selected" and a "Group as series" button. A "Clear" link unchecks everything.
- Selection is client-side state and resets on reload.

### 2. Group-as-series modal

Opened from the selection bar. A compact modal, separate from the existing Create Series modal.

**Parent section.** Two radio choices:

- **New parent** (default). Fields: title, description, primary tag (required), secondary tag, location, organization, website, external image URL, cost. Prefilled from the earliest-dated selected event. Title is prefilled verbatim (no "(Series)" suffix; the admin edits as they like). Location and organization reuse the existing autocomplete setup functions with new element ids. The parent is always created with `status: 'approved'` and `exclude_from_calendar: true`; those are not shown as fields.
- **Existing parent.** One autocomplete over the already-loaded `allParentEvents` list, filtered to `parent_source === 'events'` (approved, top-level). Selecting one hides the new-parent fields.

**Children section.** A read-only list of the selected rows: title, date, and a "staged" or "pending" tag so the admin can confirm before submitting.

**Submit** calls the new route. On success: close the modal, clear the selection, show "Grouped N events under <parent title>", and reload the queue. Rows now show the "child of" badge and the admin approves them one by one as today. The parent is editable afterwards at `/admin/events/<id>` like any other event.

The modal's DOM ids, state, and handlers live in a new module `src/lib/admin/group-series.ts` that the dashboard imports, instead of adding to the 4,400-line inline script.

### 3. API route

`POST /api/admin/events/group-series`, wrapped in `withAdminAuth`.

Request body:

```json
{
  "children": [
    { "id": "uuid", "table": "events_staged" },
    { "id": "uuid", "table": "events" }
  ],
  "parent": { "id": "uuid" }
}
```

or, for a new parent:

```json
{
  "children": [ ... ],
  "parent": {
    "title": "Library Used Book Sale",
    "description": "...",
    "primary_tag_id": "uuid",
    "secondary_tag_id": null,
    "location_id": "uuid",
    "organization_id": "uuid",
    "website": null,
    "external_image_url": null,
    "cost": null
  }
}
```

Processing order:

1. Validate: at least one child; each `table` is `events` or `events_staged`; new-parent has `title` and `primary_tag_id`.
2. Load every child row from its table. Reject with 404 if any is missing, 400 if any child has `status` other than `pending`, and 400 if any child is itself referenced as a parent by another row (no nesting). Org editors get 403 if any child's `organization_id` is outside their organizations.
3. Resolve the parent. If `parent.id` is given, it must exist in `events` with `status = 'approved'` and `parent_event_id IS NULL`, else 400. If new, insert into `events` with the supplied fields plus `status: 'approved'`, `exclude_from_calendar: true`, `start_date` = earliest child `start_date`, `end_date` = latest child `start_date` when that differs from the earliest, otherwise null.
4. Link children. For `events` rows: `update parent_event_id`. For `events_staged` rows: set `parent_event_id` to null and rewrite `comments` with `applyApprovedParentMarker`. Updates run sequentially; the first failure aborts and the response reports which children were linked so the admin can retry the rest. A newly created parent is not rolled back on partial failure (it is a valid, calendar-excluded event the admin can reuse).
5. Respond `{ parent: { id, title }, linked: number }`.

### 4. Shared helper

Move the marker regex, `extractApprovedParentId`, and `applyApprovedParentMarker` into `src/lib/series-parent-marker.ts`. Replace the three existing copies (staged approve, staged edit, staged list) with imports. Behavior unchanged.

## Data flow

1. Admin checks rows → selection bar → "Group as series".
2. Modal prefills from the earliest selected row → admin edits parent fields or picks an existing parent → submit.
3. Route creates or validates the parent, links each child, returns counts.
4. Queue reloads; children show "child of" badges; admin edits and approves them individually.
5. Staged approve route (unchanged) reads the marker and sets `parent_event_id` on the approved copy.

## Error handling

- Client: submit button disabled until required parent fields are present (title, primary tag) or an existing parent is chosen. Server errors surface through the existing `showMessage` helper.
- Server: all validation failures return 4xx with a specific message before any write. Partial link failure returns 500 with `{ error, parent, linked, failed: [ids] }`.

## Testing

Tests follow the project's existing pattern: plain `tsx` scripts under `src/lib/__tests__/`, wired into `package.json` scripts, no mocking framework.

- `series-parent-marker.test.ts`: extract, apply, replace an existing marker, empty comments.
- Keep the route's pure logic in `src/lib/group-series.ts` so it is testable without Supabase: request-body validation, child eligibility checks (pending status, not already a parent, org scope), and parent date-range derivation (single child, multiple children, unordered input). `group-series.test.ts` covers those. The route itself only loads rows, calls these functions, and performs the writes.
- Manual on prod after deploy (dev server does not run in the sandbox): group three book-sale drafts, confirm badges, edit one child, approve all three, confirm the public series page lists them.

## Follow-ups (out of scope)

- "Similar rows" chips that pre-check likely group members.
- An "approve all children now" checkbox in the modal.
