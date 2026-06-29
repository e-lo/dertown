# Design: Local image upload for events (admin)

**Date:** 2026-06-29
**Status:** Approved (design); pending implementation plan
**Scope:** Admin-only, events-only, single image per event

## Goal

Let admins attach a "local" image to an event by dragging and dropping (or
browsing for) a file in the admin panel, instead of only being able to paste a
URL to an externally-hosted image.

## Background

Today, every event image is an external reference. The `events` table has an
`external_image_url` (TEXT) column plus `image_alt_text`. The admin edit form
([src/components/ui/EditEventModal.astro](../../../src/components/ui/EditEventModal.astro))
and the create-event form in
([src/pages/admin.astro](../../../src/pages/admin.astro)) expose only a URL text
input. The create/update API endpoints accept JSON only — no file handling.
Supabase Storage is currently disabled in
[supabase/config.toml](../../../supabase/config.toml). A reserved-but-unused
`image_id` UUID column exists on `events`/`events_staged` but nothing populates
it.

## Decisions

- **One image slot, two ways to fill it.** A single "Event image" area in the
  admin: drag/drop a file *or* paste a URL. Either way, the result is the
  event's one image. (Chosen over two separate fields.)
- **Reuse `external_image_url` for storage.** Uploaded files go to Supabase
  Storage; the returned public URL is saved into the existing
  `external_image_url` field. **No schema changes.** All existing display and
  merge logic keeps working untouched. (Chosen over a new `images` table +
  `image_id`, which is deferred until per-view cropping is built.)

## Architecture

Files upload through a new server endpoint, not directly browser→Supabase. The
browser sends the file to our API; the API (running with the service-role key,
behind admin auth) uploads it to a Supabase Storage bucket and returns the
file's public URL; that URL is saved into the event's `external_image_url` on
save. Display is unchanged — it already reads that field and proxies through the
Netlify Image CDN ([src/lib/image.ts](../../../src/lib/image.ts)).

## Components

### 1. Storage bucket

- New **public** bucket `event-images`; re-enable Storage in
  `supabase/config.toml`.
- Public **read** so images display directly.
- **Writes** happen only through our server endpoint using the service-role
  key, so no permissive storage RLS write policies are needed.
- Files named with a random UUID + original extension (e.g. `9f3c…b2.jpg`) to
  avoid collisions.

### 2. Upload endpoint

- `POST /api/admin/events/upload-image`, wrapped in the existing
  `withAdminAuth`.
- Accepts multipart FormData with one `file`.
- Server-side validation: content-type in {JPEG, PNG, WebP}, size ≤ 5 MB.
- On success returns `{ url, path }`. On failure returns clear JSON error
  (400 bad input, 500 storage failure).

### 3. Admin UI (drag/drop)

- Applies to both the **edit** path
  ([EditEventModal.astro](../../../src/components/ui/EditEventModal.astro)) and
  the **create** path (create-event form in
  [admin.astro](../../../src/pages/admin.astro)).
- The current "External Image URL" text input becomes one **"Event image"**
  area: a drop zone (also click-to-browse) plus the URL text field beneath it.
- Dropping/selecting a file uploads it immediately, shows a thumbnail preview,
  and writes the returned URL into the same field the form already submits.
- Pasting a URL still works and also shows a preview.

## Data flow

drop file → `POST /upload-image` → service-role client uploads to
`event-images` → returns public URL → JS sets the image field + preview →
admin saves event → existing create/update endpoint persists
`external_image_url` (those endpoints unchanged).

## Error handling

- **Client:** reject wrong type/oversize before upload with an inline message;
  show a spinner during upload; show the server's error if upload fails; keep
  the form usable (image is optional).
- **Server:** validate type and size independently of the client; 400 on bad
  input, 500 on storage failure; the URL is only persisted on a successful
  event save, so a failed upload never half-updates a record.

## Cleanup (minimal for v1)

- When an admin replaces or clears the image, best-effort delete the previous
  file from the bucket **if** it's one of ours (detected by storage URL
  prefix; pasted external URLs are never deleted).
- Orphan cleanup when an entire event is deleted is **deferred** — noted as a
  known limitation.

## Testing

- **Endpoint:** valid upload returns a URL; oversize rejected (400); wrong type
  rejected (400); unauthenticated/non-admin rejected; storage failure → 500.
- **Validation helpers:** unit-tested for type/size.
- **Manual:** drag/drop in both edit and create modals; preview renders; save
  persists; image shows on front page + detail view; replace deletes old file.

## Out of scope (deferred)

- Separate front-page vs. detail-view previews.
- Per-view cropping/zoom.
- The `images` table + `image_id` model.
- Public-submission uploads.
- Images on activities/announcements.
