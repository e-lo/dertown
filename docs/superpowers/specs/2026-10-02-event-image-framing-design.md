# Design: Event image framing (admin)

**Date:** 2026-10-02
**Status:** Approved (design); pending implementation plan
**Scope:** Web only. Carousel card + event detail page. Admin edit modal.

## Goal

Event images that aren't landscape at roughly the right proportions look bad:
the carousel card crops everything to 3:2 and the detail page crops everything
to 16:9 (max 450px tall), both with `object-fit: cover`. Portrait posters lose
most of their content.

Let admins choose, per view, what part of the image shows (a focal point), or
show the whole image over a blurred copy of itself, and choose a portrait
(side-by-side) or landscape (banner) detail layout. Events nobody frames —
most scraped events — should look good automatically.

## Decisions

- **Focal point, not a crop box.** An admin clicks the important spot; the
  fixed-shape window positions the image around it (`object-position`). No
  zoom. Pure CSS, no server-side image processing, no extra image variants.
- **Default is Auto.** If the image's shape is close to the window's, crop
  centered (today's behaviour). If it's far off, show it whole over a blurred
  backdrop. The window size never changes, so nothing jumps on load.
- **Detail layout: admin picks; Auto uses side-by-side for tall images** — but
  only when the image's dimensions are known (recorded by the editor). Unknown
  dimensions → banner. This avoids layout shift.
- **Mobile app is out of scope** — it doesn't render event images.
- **Public submit form and scraper don't set framing**; their events are Auto.

## Data model

New nullable column (one migration):

```sql
ALTER TABLE events ADD COLUMN image_display jsonb;
```

Shape:

```ts
type FramingMode = 'auto' | 'crop' | 'full';
type DetailLayout = 'auto' | 'banner' | 'side';
interface FocusPoint { x: number; y: number }   // percentages, 0–100

interface ImageDisplay {
  src: string;            // the external_image_url these settings were made for
  width?: number;         // natural pixel size, recorded by the editor
  height?: number;
  card?:   { mode: FramingMode; focus?: FocusPoint };
  detail?: { layout: DetailLayout; mode: FramingMode; focus?: FocusPoint };
}
```

- **Staleness:** if `image_display.src` ≠ the event's current
  `external_image_url`, the settings are ignored entirely (treated as all-Auto,
  unknown dimensions). Replacing an image can never apply an old crop to it.
- **Series inheritance:** wherever a child event inherits
  `external_image_url` + `image_alt_text` from its parent, it inherits
  `image_display` with them (image is a unit). `getInheritableParentFields`
  must select it.
- `events_staged` is unchanged.

## Parser and rules — `src/lib/image-display.ts`

Pure, framework-free, unit-tested. Pages and endpoints never read the raw JSON.

- `parseImageDisplay(raw: unknown): ImageDisplay | null` — strict validation.
  Returns `null` for anything malformed (wrong types, out-of-range focus,
  unknown enum values, non-positive dimensions). Used by the API to reject bad
  input (400) and by pages to fall back safely.
- `resolveFraming(imageUrl, raw, view: 'card' | 'detail')` returns what to
  render:

  ```ts
  { mode: 'crop' | 'full' | 'measure', focus: FocusPoint, layout?: 'banner' | 'side' }
  ```

  - Settings ignored if invalid or stale (`src` mismatch).
  - Explicit `crop` / `full` → returned as-is. Focus defaults to `{50, 50}`.
  - `auto` with known dimensions → compare image aspect (w/h) to the window
    aspect (card 3/2, detail banner 16/9). Ratio `imageAspect / windowAspect`
    within `[0.8, 1.25]` → `crop` centered; otherwise `full`.
  - `auto` with unknown dimensions → `measure` (decided in the browser, below).
  - Detail layout: explicit `banner`/`side` as-is; `auto` → `side` when
    dimensions are known and `w/h < 0.9`, else `banner`.
  - Side-by-side layout always shows the full image (no window to crop to).

Thresholds are named constants in this module.

## Rendering — `src/components/EventImage.astro`

Props: `src` (already CDN-optimised URL), `rawSrc` (original URL, for the blur
thumbnail), `alt`, `framing` (from `resolveFraming`), `class`.

- **crop:** `<img>` with `object-fit: cover; object-position: x% y%`.
- **full:** a backdrop `<img>` (CDN thumbnail ~40px wide, CSS
  `filter: blur(…)`, scaled up slightly, `aria-hidden`, `alt=""`) behind the
  main `<img>` with `object-fit: contain`.
- **measure:** renders the full-mode markup with the main image in `cover`
  mode; a tiny inline script on image `load` compares `naturalWidth /
  naturalHeight` to the container's aspect with the same `[0.8, 1.25]` rule and
  switches to contain (backdrop shown) if outside it. The container has a
  fixed aspect, so no layout shift. Thresholds are emitted from the TS
  constants as data attributes so the rule lives in one place.
- The existing `onerror` hide behaviour is kept.

Used by:

- `EventCarouselCard.astro` — `view: 'card'`, fixed 3:2 window.
- `events/[id].astro` — `view: 'detail'`.
  - **banner:** the existing 16:9 / max-450px header strip.
  - **side:** on ≥ md screens, image column (~40%, full image, no crop) beside
    the title/details; on small screens it stacks: full image on top,
    uncropped, max-height capped to keep the title visible.

## Admin editor — `src/scripts/image-framing-field.ts`

A self-contained module mounted in `EditEventModal.astro` under the image
URL/drop zone, wired like `initImageDropZone`.

- Hidden until there is an image URL; re-initialises when the URL changes
  (paste or upload).
- On image load records `naturalWidth`/`naturalHeight` and the current URL.
- One row per view, **Card (3:2)** and **Detail**. Each row has a picker (the
  whole image, uncropped, with a crosshair) and a preview at the true window
  shape, rendered with the same CSS as the public site. Clicking the picker
  sets that view's focal point (accurate because the whole image is visible)
  and switches the view to Crop if it was Auto.
- Per row: mode segmented control **Auto / Crop / Full + blur**.
- Staged-event edits can't store framing (no column on `events_staged`), so
  the panel is disabled for them.
- Detail only: layout control **Auto / Banner / Side by side**; the preview
  switches shape accordingly.
- **Reset** returns everything to Auto (focus 50/50).
- API: `getValue(): ImageDisplay | null` (null when there is no image) and
  `setValue(raw: unknown)` (runs through the parser; stale/invalid → Auto).

Each page that loads/saves via the modal adds one line to populate
(`setValue(event.image_display)`) and one to save
(`image_display: framing.getValue()`): `admin.astro`,
`admin/events/[id].astro`, `admin/events/new.astro`, `events/[id].astro`.

## API

`PUT /api/admin/events` and `POST /api/admin/events/create` validate
`image_display` with `parseImageDisplay` when present: invalid → 400 with a
clear message; `null` clears it. Other endpoints are unchanged.

## Testing

- Unit tests (`src/lib/__tests__/image-display.test.ts`): parser accepts valid
  shapes and rejects each malformed case; stale `src` ignored; Auto thresholds
  at and around the boundaries for both views; unknown dimensions → `measure`;
  detail layout Auto rule; focus defaults.
- `npm run build`, lint, `astro check`.
- Live verification on the Netlify deploy preview (dev server doesn't run in
  the sandbox): portrait poster, landscape photo, wide panorama, unframed
  scraped event, series child inheriting a framed parent image.

## Out of scope

- Crop box / zoom; server-side cropping or stored image variants.
- Framing in the public submit form or scraper.
- Mobile app.
- Backfilling dimensions for existing events (Auto + browser measuring covers
  them).
