# Event Image Framing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins frame event images per view (carousel card, detail page) with a focal point or "full image + blurred backdrop", pick a banner or side-by-side detail layout, and make unframed images look right automatically.

**Architecture:** One nullable `image_display` JSONB column on `events` (exposed through the `public_events` view). A pure module `src/lib/image-display.ts` parses that JSON and resolves what to render for a view; everything else (API validation, `EventImage.astro`, the admin editor) goes through it. Rendering is pure CSS (`object-position`, `object-fit: contain` over a blurred CDN thumbnail); "Auto" with unknown dimensions is decided in the browser inside a fixed-size window, so there is no layout shift.

**Tech Stack:** Astro 6 SSR on Netlify, Supabase Postgres, TypeScript, Tailwind 4, tests run with `tsx` (no test framework — scripts print ✅/❌ and exit non-zero on failure).

**Spec:** `docs/superpowers/specs/2026-10-02-event-image-framing-design.md`

**Branch:** `feat/event-image-framing` (already created off `origin/main`; spec already committed).

**Repo conventions you need to know**
- Tests: one `tsx` script per feature in `src/lib/__tests__/`, registered as an `npm run test:<name>` script in `package.json`. `npm test` (date-time suite) has a known pre-existing TZ failure on main — don't chase it; run the per-feature scripts.
- The dev server doesn't run in the agent sandbox. Verify with tests, `npm run lint`, `npm run build`, and the Netlify deploy preview (the user tests live).
- `src/types/database.ts` is hand-maintained to match migrations.
- Public pages read events from the `public_events` view (explicit column list); admin endpoints read `events` with `*`.
- Push to `main` = deploy to prod. Do not merge; open a PR.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/20261002120000_add_event_image_display.sql` | create | Add column; expose it in `public_events` |
| `src/types/database.ts` | modify | Add `image_display: Json \| null` to `events` Row/Insert/Update and `public_events` Row |
| `src/lib/image-display.ts` | create | Types, constants, `parseImageDisplay`, `resolveFraming`, `fitsWindow`, `normalizeImageDisplayInput` |
| `src/lib/__tests__/image-display.test.ts` | create | Unit tests for the module |
| `src/pages/api/admin/events.ts` | modify | PUT: validate/normalize `image_display` |
| `src/pages/api/admin/events/create.ts` | modify | POST: validate/normalize `image_display` |
| `src/lib/supabase.ts` | modify | `getInheritableParentFields` selects `image_display` |
| `src/styles/event-image.css` | create | Global framing CSS shared by public pages and the editor previews |
| `src/components/EventImage.astro` | create | Renders a framed image for a view |
| `src/components/EventCarouselCard.astro` | modify | Use `EventImage` |
| `src/pages/events/[id].astro` | modify | Inherit `image_display`; banner/side layouts via `EventImage`; editor load/save |
| `src/scripts/image-upload-field.ts` | modify | Fire an `input` event after an upload writes the URL |
| `src/components/ui/EditEventModal.astro` | modify | Framing panel markup + init |
| `src/scripts/image-framing-field.ts` | create | Editor panel behaviour; `window.eventImageFraming` API |
| `src/pages/admin.astro`, `src/pages/admin/events/[id].astro`, `src/pages/admin/events/new.astro` | modify | Editor load/save one-liners |
| `src/lib/__tests__/image-framing-wiring.test.ts` | create | Canary: every modal page loads and saves framing |
| `package.json` | modify | `test:image-display`, `test:image-framing-wiring` scripts |

---

### Task 1: Migration and types

**Files:**
- Create: `supabase/migrations/20261002120000_add_event_image_display.sql`
- Modify: `src/types/database.ts` (events Row ~L446, Insert ~L477, Update ~L508; public_events Row ~L1171)

- [ ] **Step 1: Write the migration**

The view is re-created with `CREATE OR REPLACE`, which may only append columns at the end — so `image_display` goes after `secondary_tag_name`. The body is otherwise identical to `20260206140000_restore_public_events_view.sql`.

```sql
-- Per-event image framing for the carousel card and detail page.
--
-- Holds admin choices (focal point / full-with-blur / detail layout) plus the
-- image's natural size and the URL the settings were made for. Parsed and
-- validated by src/lib/image-display.ts; NULL means "all Auto".
--
-- public_events lists columns explicitly, so it is replaced to expose the new
-- column. CREATE OR REPLACE VIEW can only append columns, hence its position.

ALTER TABLE "public"."events" ADD COLUMN IF NOT EXISTS "image_display" jsonb;

CREATE OR REPLACE VIEW "public"."public_events" AS
 SELECT "e"."id",
    "e"."title",
    "e"."description",
    "e"."start_date",
    "e"."end_date",
    "e"."start_time",
    "e"."end_time",
    "e"."location_id",
    "e"."organization_id",
    "e"."website",
    "e"."registration_link",
    "e"."external_image_url",
    "e"."cost",
    "e"."registration",
    "e"."status",
    "e"."featured",
    "e"."exclude_from_calendar",
    "e"."created_at",
    "e"."updated_at",
    "e"."primary_tag_id",
    "e"."secondary_tag_id",
    "e"."image_alt_text",
    "e"."parent_event_id",
    "pt"."name" AS "primary_tag_name",
    "st"."name" AS "secondary_tag_name",
    "e"."image_display"
   FROM (("public"."events" "e"
     LEFT JOIN "public"."tags" "pt" ON (("e"."primary_tag_id" = "pt"."id")))
     LEFT JOIN "public"."tags" "st" ON (("e"."secondary_tag_id" = "st"."id")))
  WHERE (
    "e"."status" = 'approved'::"public"."event_status"
    AND "e"."exclude_from_calendar" = false
    AND (
      ("e"."start_date" >= (CURRENT_DATE - '14 days'::interval))
      OR (("e"."end_date" IS NOT NULL) AND ("e"."end_date" >= (CURRENT_DATE - '14 days'::interval)))
    )
  );
```

- [ ] **Step 2: Apply it locally (if local Supabase is running)**

Run: `supabase migration up`
Expected: `Applying migration 20261002120000_add_event_image_display.sql...` with no error. If local Supabase isn't running (`supabase status` fails), skip — note it in the task report. It runs on Podman via `DOCKER_HOST` from `~/.zshrc`.

- [ ] **Step 3: Update types**

In `src/types/database.ts`, add `image_display` right after `image_alt_text` in four places:

- `events.Row`: `image_display: Json | null;`
- `events.Insert`: `image_display?: Json | null;`
- `events.Update`: `image_display?: Json | null;`
- `public_events.Row` (~L1181): `image_display: Json | null;`

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit -p . 2>&1 | grep database.ts`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261002120000_add_event_image_display.sql src/types/database.ts
git commit -m "feat(db): add events.image_display and expose it in public_events"
```

---

### Task 2: `image-display` module (TDD)

**Files:**
- Create: `src/lib/image-display.ts`
- Create: `src/lib/__tests__/image-display.test.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/image-display.test.ts`:

```ts
/**
 * Event image framing: parsing stored settings and resolving what each view
 * renders. See docs/superpowers/specs/2026-10-02-event-image-framing-design.md.
 */
import {
  CARD_ASPECT,
  DETAIL_BANNER_ASPECT,
  fitsWindow,
  normalizeImageDisplayInput,
  parseImageDisplay,
  resolveFraming,
} from '../image-display';

const URL_A = 'https://example.com/a.jpg';
const URL_B = 'https://example.com/b.jpg';

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  console.log(
    pass
      ? `✅ PASS: ${name}`
      : `❌ FAIL: ${name}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}`
  );
}

console.log('🧪 image-display\n');

// --- parseImageDisplay ---------------------------------------------------
check('parse: minimal valid', parseImageDisplay({ src: URL_A }), { src: URL_A });
check(
  'parse: full valid shape round-trips',
  parseImageDisplay({
    src: URL_A,
    width: 680,
    height: 1026,
    card: { mode: 'crop', focus: { x: 25, y: 10 } },
    detail: { layout: 'side', mode: 'full' },
  }),
  {
    src: URL_A,
    width: 680,
    height: 1026,
    card: { mode: 'crop', focus: { x: 25, y: 10 } },
    detail: { layout: 'side', mode: 'full' },
  }
);
check('parse: strips unknown keys', parseImageDisplay({ src: URL_A, junk: 1 }), { src: URL_A });
check('parse: null → null', parseImageDisplay(null), null);
check('parse: string → null', parseImageDisplay('{"src":"x"}'), null);
check('parse: missing src → null', parseImageDisplay({ width: 1, height: 1 }), null);
check('parse: empty src → null', parseImageDisplay({ src: '  ' }), null);
check('parse: width without height → null', parseImageDisplay({ src: URL_A, width: 10 }), null);
check('parse: zero width → null', parseImageDisplay({ src: URL_A, width: 0, height: 10 }), null);
check('parse: NaN height → null', parseImageDisplay({ src: URL_A, width: 10, height: NaN }), null);
check('parse: bad card mode → null', parseImageDisplay({ src: URL_A, card: { mode: 'zoom' } }), null);
check(
  'parse: bad detail layout → null',
  parseImageDisplay({ src: URL_A, detail: { layout: 'grid', mode: 'auto' } }),
  null
);
check(
  'parse: focus out of range → null',
  parseImageDisplay({ src: URL_A, card: { mode: 'crop', focus: { x: 101, y: 0 } } }),
  null
);
check(
  'parse: focus non-number → null',
  parseImageDisplay({ src: URL_A, card: { mode: 'crop', focus: { x: '5', y: 0 } } }),
  null
);

// --- fitsWindow -----------------------------------------------------------
check('fits: same aspect', fitsWindow(1.5, CARD_ASPECT), true);
check('fits: lower boundary 0.8 inclusive', fitsWindow(1.2, CARD_ASPECT), true);
check('fits: just under lower boundary', fitsWindow(1.19, CARD_ASPECT), false);
check('fits: upper boundary 1.25 inclusive', fitsWindow(1.875, CARD_ASPECT), true);
check('fits: just over upper boundary', fitsWindow(1.88, CARD_ASPECT), false);

// --- resolveFraming -------------------------------------------------------
const CENTER = { x: 50, y: 50 };
check(
  'resolve: no settings, card → measure',
  resolveFraming(URL_A, null, 'card'),
  { mode: 'measure', focus: CENTER, layout: 'banner' }
);
check(
  'resolve: no settings, detail → measure + banner',
  resolveFraming(URL_A, null, 'detail'),
  { mode: 'measure', focus: CENTER, layout: 'banner' }
);
check(
  'resolve: malformed settings treated as none',
  resolveFraming(URL_A, { src: URL_A, card: { mode: 'nope' } }, 'card'),
  { mode: 'measure', focus: CENTER, layout: 'banner' }
);
check(
  'resolve: stale src ignored (crop setting not applied to new image)',
  resolveFraming(URL_B, { src: URL_A, card: { mode: 'crop', focus: { x: 0, y: 0 } } }, 'card'),
  { mode: 'measure', focus: CENTER, layout: 'banner' }
);
check(
  'resolve: explicit crop keeps focus',
  resolveFraming(URL_A, { src: URL_A, card: { mode: 'crop', focus: { x: 20, y: 80 } } }, 'card'),
  { mode: 'crop', focus: { x: 20, y: 80 }, layout: 'banner' }
);
check(
  'resolve: explicit full',
  resolveFraming(URL_A, { src: URL_A, card: { mode: 'full' } }, 'card'),
  { mode: 'full', focus: CENTER, layout: 'banner' }
);
check(
  'resolve: auto + landscape 3:2 dims on card → crop',
  resolveFraming(URL_A, { src: URL_A, width: 1200, height: 800 }, 'card'),
  { mode: 'crop', focus: CENTER, layout: 'banner' }
);
check(
  'resolve: auto + portrait dims on card → full',
  resolveFraming(URL_A, { src: URL_A, width: 680, height: 1026 }, 'card'),
  { mode: 'full', focus: CENTER, layout: 'banner' }
);
check(
  'resolve: auto + 16:9 dims on detail → crop banner',
  resolveFraming(URL_A, { src: URL_A, width: 1600, height: 900 }, 'detail'),
  { mode: 'crop', focus: CENTER, layout: 'banner' }
);
check(
  'resolve: auto layout + tall dims on detail → side (full image)',
  resolveFraming(URL_A, { src: URL_A, width: 680, height: 1026 }, 'detail'),
  { mode: 'full', focus: CENTER, layout: 'side' }
);
check(
  'resolve: square-ish (w/h 0.95) on detail → banner + full',
  resolveFraming(URL_A, { src: URL_A, width: 950, height: 1000 }, 'detail'),
  { mode: 'full', focus: CENTER, layout: 'banner' }
);
check(
  'resolve: explicit banner overrides tall dims',
  resolveFraming(
    URL_A,
    { src: URL_A, width: 680, height: 1026, detail: { layout: 'banner', mode: 'crop', focus: { x: 50, y: 20 } } },
    'detail'
  ),
  { mode: 'crop', focus: { x: 50, y: 20 }, layout: 'banner' }
);
check(
  'resolve: explicit side without dims → side',
  resolveFraming(URL_A, { src: URL_A, detail: { layout: 'side', mode: 'auto' } }, 'detail'),
  { mode: 'full', focus: CENTER, layout: 'side' }
);
check(
  'resolve: card ignores detail layout',
  resolveFraming(URL_A, { src: URL_A, width: 680, height: 1026, detail: { layout: 'side', mode: 'auto' } }, 'card'),
  { mode: 'full', focus: CENTER, layout: 'banner' }
);
check('resolve: detail banner aspect constant is 16:9', DETAIL_BANNER_ASPECT, 16 / 9);

// --- normalizeImageDisplayInput (API boundary) ----------------------------
check('input: undefined → absent', normalizeImageDisplayInput(undefined, URL_A), { ok: true, value: undefined });
check('input: null → clear', normalizeImageDisplayInput(null, URL_A), { ok: true, value: null });
check('input: invalid → error', normalizeImageDisplayInput({ src: URL_A, card: { mode: 'x' } }, URL_A), {
  ok: false,
});
check(
  'input: src forced to the saved image URL',
  normalizeImageDisplayInput({ src: 'example.com/a.jpg', card: { mode: 'full' } }, URL_A),
  { ok: true, value: { src: URL_A, card: { mode: 'full' } } }
);
check(
  'input: no saved image URL → clear',
  normalizeImageDisplayInput({ src: URL_A }, null),
  { ok: true, value: null }
);
check(
  'input: image URL not in payload keeps parsed src',
  normalizeImageDisplayInput({ src: URL_A }, undefined),
  { ok: true, value: { src: URL_A } }
);

console.log(failures === 0 ? '\nAll image-display tests passed' : `\n${failures} failing`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Register the script**

In `package.json` `scripts`, after `"test:image-upload"`:

```json
    "test:image-display": "tsx src/lib/__tests__/image-display.test.ts",
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test:image-display`
Expected: FAIL — `Cannot find module '../image-display'`.

- [ ] **Step 4: Implement the module**

`src/lib/image-display.ts`:

```ts
/**
 * Event image framing: how an event's image is shown in the carousel card and
 * on the detail page. Stored as events.image_display (JSONB). Everything that
 * reads or writes that column goes through this module.
 *
 * Framework-free so it can run on the server, in the admin editor bundle, and
 * in tsx tests.
 */

export type FramingMode = 'auto' | 'crop' | 'full';
export type DetailLayout = 'auto' | 'banner' | 'side';
export type ImageView = 'card' | 'detail';

/** Percentages, 0–100, from the image's top-left. */
export interface FocusPoint {
  x: number;
  y: number;
}

export interface ViewFraming {
  mode: FramingMode;
  focus?: FocusPoint;
}

export interface DetailFraming extends ViewFraming {
  layout: DetailLayout;
}

export interface ImageDisplay {
  /** The image URL these settings were made for; a mismatch means stale. */
  src: string;
  width?: number;
  height?: number;
  card?: ViewFraming;
  detail?: DetailFraming;
}

export interface ResolvedFraming {
  /** `measure`: Auto with unknown size — the browser decides crop vs full. */
  mode: 'crop' | 'full' | 'measure';
  focus: FocusPoint;
  layout: 'banner' | 'side';
}

export const CARD_ASPECT = 3 / 2;
export const DETAIL_BANNER_ASPECT = 16 / 9;
/** imageAspect / windowAspect within this range → crop is acceptable. */
export const CROP_TOLERANCE = { min: 0.8, max: 1.25 } as const;
/** Auto detail layout goes side-by-side for images narrower than this (w/h). */
export const SIDE_LAYOUT_MAX_ASPECT = 0.9;
export const CENTER_FOCUS: FocusPoint = { x: 50, y: 50 };

const FRAMING_MODES: readonly FramingMode[] = ['auto', 'crop', 'full'];
const DETAIL_LAYOUTS: readonly DetailLayout[] = ['auto', 'banner', 'side'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function isPercent(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
}

function parseFocus(raw: unknown): FocusPoint | null | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw) || !isPercent(raw.x) || !isPercent(raw.y)) return null;
  return { x: raw.x, y: raw.y };
}

function parseViewFraming(raw: unknown): ViewFraming | null {
  if (!isRecord(raw) || !FRAMING_MODES.includes(raw.mode as FramingMode)) return null;
  const focus = parseFocus(raw.focus);
  if (focus === null) return null;
  return focus ? { mode: raw.mode as FramingMode, focus } : { mode: raw.mode as FramingMode };
}

function parseDetailFraming(raw: unknown): DetailFraming | null {
  if (!isRecord(raw) || !DETAIL_LAYOUTS.includes(raw.layout as DetailLayout)) return null;
  const view = parseViewFraming(raw);
  if (!view) return null;
  return { layout: raw.layout as DetailLayout, ...view };
}

/** Strictly validate stored/submitted settings. Unknown keys are dropped. */
export function parseImageDisplay(raw: unknown): ImageDisplay | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.src !== 'string' || raw.src.trim() === '') return null;
  const result: ImageDisplay = { src: raw.src };

  const hasWidth = raw.width !== undefined;
  const hasHeight = raw.height !== undefined;
  if (hasWidth || hasHeight) {
    if (!isPositiveNumber(raw.width) || !isPositiveNumber(raw.height)) return null;
    result.width = raw.width;
    result.height = raw.height;
  }
  if (raw.card !== undefined) {
    const card = parseViewFraming(raw.card);
    if (!card) return null;
    result.card = card;
  }
  if (raw.detail !== undefined) {
    const detail = parseDetailFraming(raw.detail);
    if (!detail) return null;
    result.detail = detail;
  }
  return result;
}

export function fitsWindow(imageAspect: number, windowAspect: number): boolean {
  const ratio = imageAspect / windowAspect;
  return ratio >= CROP_TOLERANCE.min && ratio <= CROP_TOLERANCE.max;
}

function knownAspect(display: ImageDisplay | null): number | null {
  return display?.width && display.height ? display.width / display.height : null;
}

function resolveLayout(display: ImageDisplay | null, aspect: number | null): 'banner' | 'side' {
  const chosen = display?.detail?.layout ?? 'auto';
  if (chosen !== 'auto') return chosen;
  return aspect !== null && aspect < SIDE_LAYOUT_MAX_ASPECT ? 'side' : 'banner';
}

/** Decide how `view` renders the event's image. Never throws. */
export function resolveFraming(
  imageUrl: string | null | undefined,
  raw: unknown,
  view: ImageView
): ResolvedFraming {
  const parsed = parseImageDisplay(raw);
  const display = parsed && parsed.src === imageUrl ? parsed : null;
  const aspect = knownAspect(display);
  const layout = view === 'detail' ? resolveLayout(display, aspect) : 'banner';

  // Side-by-side has no fixed window: the whole image always shows.
  if (layout === 'side') return { mode: 'full', focus: CENTER_FOCUS, layout };

  const settings = view === 'card' ? display?.card : display?.detail;
  const mode = settings?.mode ?? 'auto';
  const focus = settings?.focus ?? CENTER_FOCUS;
  if (mode !== 'auto') return { mode, focus, layout };
  if (aspect === null) return { mode: 'measure', focus, layout };

  const windowAspect = view === 'card' ? CARD_ASPECT : DETAIL_BANNER_ASPECT;
  return { mode: fitsWindow(aspect, windowAspect) ? 'crop' : 'full', focus, layout };
}

export type ImageDisplayInput = { ok: true; value: ImageDisplay | null | undefined } | { ok: false };

/**
 * Validate `image_display` from an admin save request.
 * - `undefined` (key absent) → leave the column alone.
 * - `null`, or no image → clear it.
 * - Otherwise must parse; `src` is pinned to the image URL being saved so the
 *   staleness check can't be defeated by client-side URL normalisation.
 *   `imageUrl` undefined means the request isn't changing the image.
 */
export function normalizeImageDisplayInput(
  value: unknown,
  imageUrl: string | null | undefined
): ImageDisplayInput {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || imageUrl === null) return { ok: true, value: null };
  const parsed = parseImageDisplay(value);
  if (!parsed) return { ok: false };
  return { ok: true, value: imageUrl === undefined ? parsed : { ...parsed, src: imageUrl } };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:image-display`
Expected: every line `✅ PASS`, ends with `All image-display tests passed`, exit 0.

Note on `'input: src forced…'` — the expected object key order is `{ src, card }`; `{ ...parsed, src }` keeps `src` first because `parsed` already has `src` first. If that check fails only on key order, fix the expectation, not the code.

- [ ] **Step 6: Lint**

Run: `npx eslint src/lib/image-display.ts src/lib/__tests__/image-display.test.ts`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/image-display.ts src/lib/__tests__/image-display.test.ts package.json
git commit -m "feat(events): image-display parser and framing rules"
```

---

### Task 3: Validate `image_display` in admin save endpoints

**Files:**
- Modify: `src/pages/api/admin/events.ts` (PUT, ~L80–140)
- Modify: `src/pages/api/admin/events/create.ts` (POST, ~L15–20 and ~L88–100)

Both endpoints pass request fields straight to Supabase after converting `''`/`undefined` → `null`. `image_display` must be validated before that loop. `external_image_url` in the payload is the raw form value (may be `''`); treat empty as "no image".

- [ ] **Step 1: PUT handler**

Add to the imports at the top of `src/pages/api/admin/events.ts`:

```ts
import { normalizeImageDisplayInput } from '@/lib/image-display';
```

Immediately after `if (!id) { return jsonError('Event ID is required', 400); }` add:

```ts
  if ('image_display' in updateData) {
    const imageUrl =
      'external_image_url' in updateData ? (updateData.external_image_url || null) : undefined;
    const framing = normalizeImageDisplayInput(updateData.image_display, imageUrl);
    if (!framing.ok) return jsonError('Invalid image framing settings', 400);
    updateData.image_display = framing.value;
  }
```

(`value` can't be `undefined` here because the key is present; the existing cleaning loop maps `null` through unchanged.)

- [ ] **Step 2: Create handler**

Add the same import to `src/pages/api/admin/events/create.ts`. After the required-fields check (`if (!eventData.title || !eventData.start_date) {...}`) add:

```ts
  if ('image_display' in eventData) {
    const framing = normalizeImageDisplayInput(eventData.image_display, eventData.external_image_url || null);
    if (!framing.ok) return jsonError('Invalid image framing settings', 400);
    eventData.image_display = framing.value;
  }
```

- [ ] **Step 3: Lint + build**

Run: `npx eslint src/pages/api/admin/events.ts src/pages/api/admin/events/create.ts && npm run build 2>&1 | tail -3`
Expected: no lint errors; build ends with `Complete!`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/admin/events.ts src/pages/api/admin/events/create.ts
git commit -m "feat(api): validate image_display on admin event create/update"
```

---

### Task 4: Series children inherit framing with the image

**Files:**
- Modify: `src/lib/supabase.ts:153`
- Modify: `src/pages/events/[id].astro:141-145`

- [ ] **Step 1: Select the column for the parent**

In `getInheritableParentFields`, change the select's first line from

```
      description, external_image_url, image_alt_text, cost,
```

to

```
      description, external_image_url, image_alt_text, image_display, cost,
```

- [ ] **Step 2: Inherit it as part of the image unit**

In `src/pages/events/[id].astro`, replace

```ts
    if (isBlank(event.external_image_url)) {
      // Image is a unit: url + alt text move together.
      event.external_image_url = parent.external_image_url;
      event.image_alt_text = parent.image_alt_text;
    }
```

with

```ts
    if (isBlank(event.external_image_url)) {
      // Image is a unit: url, alt text and framing move together.
      event.external_image_url = parent.external_image_url;
      event.image_alt_text = parent.image_alt_text;
      event.image_display = parent.image_display;
    }
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts "src/pages/events/[id].astro"
git commit -m "feat(events): series children inherit image framing with the image"
```

---

### Task 5: Shared framing CSS and `EventImage` component

**Files:**
- Create: `src/styles/event-image.css`
- Create: `src/components/EventImage.astro`

- [ ] **Step 1: CSS (global — the admin editor previews reuse it)**

`src/styles/event-image.css`:

```css
/* Framed event image. Container sets the window size; data-frame picks how the
   image fills it. See src/lib/image-display.ts. */
.event-image {
  position: relative;
  overflow: hidden;
  background: #111827;
}
.event-image__backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(18px);
  transform: scale(1.2);
  display: none;
}
.event-image__main {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.event-image[data-frame='full'] .event-image__backdrop {
  display: block;
}
.event-image[data-frame='full'] .event-image__main {
  object-fit: contain;
}
/* Side-by-side detail layout: no fixed window, whole image at natural shape. */
.event-image--side {
  background: transparent;
}
.event-image--side .event-image__main {
  height: auto;
  max-height: 70vh;
  object-fit: contain;
}
```

- [ ] **Step 2: Component**

`src/components/EventImage.astro`:

```astro
---
/**
 * An event image framed for one view. The parent sizes the window via `class`
 * (e.g. aspect-ratio); this component decides how the image fills it.
 */
import '../styles/event-image.css';
import { optimizedImageUrl } from '../lib/image';
import { CROP_TOLERANCE, type ResolvedFraming } from '../lib/image-display';

interface Props {
  /** Original image URL (also used for the blurred thumbnail). */
  rawSrc: string;
  width: number;
  alt: string;
  framing: ResolvedFraming;
  loading?: 'lazy' | 'eager';
  class?: string;
}

const { rawSrc, width, alt, framing, loading = 'lazy', class: className = '' } = Astro.props;

const src = optimizedImageUrl(rawSrc, { width });
const backdropSrc = optimizedImageUrl(rawSrc, { width: 40, quality: 40 });
const isSide = framing.layout === 'side';
const initialFrame = framing.mode === 'full' ? 'full' : 'crop';
const objectPosition = `${framing.focus.x}% ${framing.focus.y}%`;

// Auto with unknown size: once loaded, switch to full if the image's shape is
// too far from the window's. The window is fixed-size, so nothing shifts.
const measureScript =
  framing.mode === 'measure'
    ? `var r=(this.naturalWidth/this.naturalHeight)/(this.clientWidth/this.clientHeight);` +
      `if(r<${CROP_TOLERANCE.min}||r>${CROP_TOLERANCE.max})this.parentElement.dataset.frame='full'`
    : undefined;
---

<div class:list={['event-image', { 'event-image--side': isSide }, className]} data-frame={initialFrame}>
  {!isSide && (
    <img class="event-image__backdrop" src={backdropSrc} alt="" aria-hidden="true" loading="lazy" decoding="async" />
  )}
  <img
    class="event-image__main"
    src={src}
    alt={alt}
    loading={loading}
    decoding="async"
    style={`object-position: ${objectPosition}`}
    onload={measureScript}
    onerror="this.parentElement.style.display='none'"
  />
</div>
```

The backdrop is `display: none` until `data-frame='full'`, and a lazy image that isn't displayed isn't fetched — so crop-mode images never download the thumbnail.

- [ ] **Step 3: Build**

Run: `npm run build 2>&1 | tail -3`
Expected: `Complete!` (component unused so far; this checks it compiles).

- [ ] **Step 4: Commit**

```bash
git add src/styles/event-image.css src/components/EventImage.astro
git commit -m "feat(events): EventImage component with crop/full/measure framing"
```

---

### Task 6: Carousel card uses `EventImage`

**Files:**
- Modify: `src/components/EventCarouselCard.astro`

- [ ] **Step 1: Replace the image**

Frontmatter: replace

```ts
import { optimizedImageUrl } from '../lib/image';
```
with
```ts
import EventImage from './EventImage.astro';
import { resolveFraming } from '../lib/image-display';
```

and replace

```ts
const cardImageUrl = event.external_image_url ? optimizedImageUrl(event.external_image_url, { width: 640 }) : null;
```
with
```ts
const cardFraming = event.external_image_url
  ? resolveFraming(event.external_image_url, event.image_display, 'card')
  : null;
```

Markup: replace the whole `{cardImageUrl && ( <img ... /> )}` block with

```astro
  {cardFraming && (
    <EventImage
      rawSrc={event.external_image_url}
      width={640}
      alt={String(event.image_alt_text ?? 'Event image')}
      framing={cardFraming}
      class="carousel-card-image"
    />
  )}
```

Style: replace the `.carousel-card-image` rule with (it now sizes the window; `object-fit` lives in the shared CSS):

```css
.carousel-card-image {
  width: 100%;
  aspect-ratio: 3 / 2;
  border-radius: 0.75rem 0.75rem 0 0;
  flex-shrink: 0;
}
```

Astro scoped styles apply to a child component's root element when the class is passed via `class`, because the component spreads it with `class:list` — verify in Step 2.

- [ ] **Step 2: Build and inspect output**

Run: `npm run build 2>&1 | tail -2 && grep -l "carousel-card-image" .netlify/build/chunks/*.mjs | head -1 | xargs grep -o 'event-image[^"]*carousel-card-image[^"]*' | head -1`
Expected: build `Complete!`; a match showing both classes on one element (e.g. `event-image carousel-card-image astro-…`).

- [ ] **Step 3: Commit**

```bash
git add src/components/EventCarouselCard.astro
git commit -m "feat(events): carousel card frames its image via EventImage"
```

---

### Task 7: Detail page banner / side-by-side layouts

**Files:**
- Modify: `src/pages/events/[id].astro` (frontmatter ~L163–169; header markup ~L196–212 and its closing `</div>` ~L325; `<style>` ~L925–940)

- [ ] **Step 1: Frontmatter**

Add import next to the existing `optimizedImageUrl` import:

```ts
import EventImage from '../../components/EventImage.astro';
import { resolveFraming } from '../../lib/image-display';
```

Replace

```ts
// Optimized image URLs for the detail hero
const detailImageUrl = event.external_image_url
  ? optimizedImageUrl(event.external_image_url, { width: 1200 })
  : null;
```
with
```ts
// Framing for the detail hero (after parent inheritance above)
const detailFraming = event.external_image_url
  ? resolveFraming(event.external_image_url, event.image_display, 'detail')
  : null;
const sideLayout = detailFraming?.layout === 'side';
```

Leave `ogImageUrl` as is. Search the file for other uses of `detailImageUrl` (`grep -n detailImageUrl`) — there should be none after Step 2.

- [ ] **Step 2: Header markup**

Replace the header open + image block:

```astro
      <div class="bg-white rounded-lg shadow-lg mb-6 sm:mb-8 relative">
        {detailImageUrl && (
          <div class="overflow-hidden rounded-t-lg w-full">
            <div class="event-detail-image-wrapper">
              <img
                ...
              />
            </div>
          </div>
        )}
        <div class="p-4 sm:p-6 md:p-8 pb-16 sm:pb-20 relative">
```

with

```astro
      <div class:list={['bg-white rounded-lg shadow-lg mb-6 sm:mb-8 relative', { 'md:flex md:items-start': sideLayout }]}>
        {detailFraming && (
          sideLayout ? (
            <div class="event-detail-side-image">
              <EventImage
                rawSrc={event.external_image_url}
                width={900}
                alt={String(event.image_alt_text ?? 'Event image')}
                framing={detailFraming}
                loading="eager"
              />
            </div>
          ) : (
            <div class="overflow-hidden rounded-t-lg w-full">
              <EventImage
                rawSrc={event.external_image_url}
                width={1200}
                alt={String(event.image_alt_text ?? 'Event image')}
                framing={detailFraming}
                loading="eager"
                class="event-detail-image-wrapper"
              />
            </div>
          )
        )}
        <div class:list={['p-4 sm:p-6 md:p-8 pb-16 sm:pb-20 relative', { 'md:flex-1 md:min-w-0': sideLayout }]}>
```

The closing tags further down are unchanged (same nesting depth).

- [ ] **Step 3: Styles**

Replace the `.event-detail-image-wrapper` and `.event-detail-image` rules with:

```css
.event-detail-image-wrapper {
  width: 100%;
  aspect-ratio: 16 / 9;
  max-height: 450px;
}
.event-detail-side-image {
  border-radius: 0.5rem 0.5rem 0 0;
  overflow: hidden;
  background: #f3f4f6;
  display: flex;
  justify-content: center;
}
@media (min-width: 768px) {
  .event-detail-side-image {
    width: 40%;
    flex-shrink: 0;
    border-radius: 0.5rem 0 0 0.5rem;
  }
}
```

- [ ] **Step 4: Build**

Run: `npm run build 2>&1 | tail -2 && grep -n "detailImageUrl" "src/pages/events/[id].astro"`
Expected: `Complete!`; grep prints nothing.

- [ ] **Step 5: Commit**

```bash
git add "src/pages/events/[id].astro"
git commit -m "feat(events): detail page banner and side-by-side image layouts"
```

---

### Task 8: Upload notifies listeners when it sets the URL

**Files:**
- Modify: `src/scripts/image-upload-field.ts:136-137`

The framing panel listens for `input` on the URL field. After an upload the module sets the value programmatically, which fires nothing.

- [ ] **Step 1: Dispatch instead of calling showPreview directly**

Replace

```ts
      urlInput!.value = data.url;
      showPreview(data.url);
```
with
```ts
      urlInput!.value = data.url;
      // Fires the existing input listener (preview) and the framing panel.
      urlInput!.dispatchEvent(new Event('input', { bubbles: true }));
```

- [ ] **Step 2: Run the existing upload tests**

Run: `npm run test:image-upload`
Expected: all PASS (same as before).

- [ ] **Step 3: Commit**

```bash
git add src/scripts/image-upload-field.ts
git commit -m "fix(events): image upload fires input so URL listeners update"
```

---

### Task 9: Framing panel in the edit modal

**Files:**
- Modify: `src/components/ui/EditEventModal.astro` (after the URL input ~L69; `<script>` ~L180)
- Create: `src/scripts/image-framing-field.ts`

UI per view row: a **picker** (whole image, `contain`, with a crosshair — click to set the focal point; accurate because the whole image is visible) next to a **preview** at the real window shape, rendered with the same `event-image` CSS. Mode buttons below; the Detail row also has layout buttons. Picking a focal point on a view in Auto switches it to Crop.

- [ ] **Step 1: Markup**

In `EditEventModal.astro`, add to the existing frontmatter (after the two comment lines):

```ts
import '../../styles/event-image.css';
```

Directly after `<input type="url" id="editEventExternalImageUrl" ... />` add:

```astro
        <div id="editEventImageFraming" class="hidden mt-3 space-y-4" data-framing-root>
          <p class="text-xs text-gray-500">
            Click the image on the left to choose what stays in view. Auto crops when the shape fits and shows the full image with a blurred background when it doesn't.
          </p>
          {(['card', 'detail'] as const).map((view) => (
            <div class="framing-row" data-view={view}>
              <div class="text-sm font-medium text-gray-700 mb-1">{view === 'card' ? 'Carousel card' : 'Detail page'}</div>
              <div class="flex gap-3 items-start">
                <div class="framing-picker relative cursor-crosshair" data-picker>
                  <img class="block max-h-32 max-w-[10rem] object-contain" alt="" data-picker-img />
                  <span class="framing-crosshair" data-crosshair></span>
                </div>
                <div class:list={['event-image framing-preview', view === 'card' ? 'framing-preview--card' : 'framing-preview--banner']} data-preview data-frame="crop">
                  <img class="event-image__backdrop" alt="" aria-hidden="true" />
                  <img class="event-image__main" alt="" />
                </div>
              </div>
              <div class="flex flex-wrap gap-1 mt-2" role="group" aria-label="Framing mode">
                <button type="button" class="framing-btn" data-mode="auto">Auto</button>
                <button type="button" class="framing-btn" data-mode="crop">Crop</button>
                <button type="button" class="framing-btn" data-mode="full">Full + blur</button>
              </div>
              {view === 'detail' && (
                <div class="flex flex-wrap gap-1 mt-1" role="group" aria-label="Detail layout">
                  <button type="button" class="framing-btn" data-layout="auto">Layout: Auto</button>
                  <button type="button" class="framing-btn" data-layout="banner">Banner</button>
                  <button type="button" class="framing-btn" data-layout="side">Side by side</button>
                </div>
              )}
            </div>
          ))}
          <button type="button" class="text-xs text-indigo-600 hover:underline" data-framing-reset>Reset to Auto</button>
        </div>
```

The component has no `<style>` block yet; add this one at the end of the file:

```css
<style is:global>
  .framing-picker { line-height: 0; }
  .framing-crosshair {
    position: absolute;
    width: 14px;
    height: 14px;
    margin: -7px 0 0 -7px;
    border: 2px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 1px #000;
    pointer-events: none;
  }
  .framing-preview { border-radius: 0.375rem; flex-shrink: 0; }
  .framing-preview--card { width: 9rem; aspect-ratio: 3 / 2; }
  .framing-preview--banner { width: 12rem; aspect-ratio: 16 / 9; }
  .framing-preview.event-image--side { width: auto; aspect-ratio: auto; }
  .framing-preview.event-image--side .event-image__main { max-height: 8rem; width: auto; }
  .framing-btn {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 9999px;
    background: #fff;
    color: #374151;
  }
  .framing-btn[aria-pressed='true'] { background: #4f46e5; border-color: #4f46e5; color: #fff; }
</style>
```

- [ ] **Step 2: Module**

`src/scripts/image-framing-field.ts`:

```ts
/**
 * Admin editor panel for event image framing (see src/lib/image-display.ts).
 *
 * Pages populate and save the modal with their own inline scripts, so this
 * exposes a small global, `window.eventImageFraming`:
 *   - setValue(raw)  after the page sets the image URL input when opening the
 *                    modal for an event (raw = event.image_display, or null).
 *   - getValue()     when building the save payload. `undefined` means "don't
 *                    send the field" (panel disabled, e.g. staged events).
 *   - disable()      for edits that can't store framing (staged events).
 */
import {
  CENTER_FOCUS,
  parseImageDisplay,
  resolveFraming,
  type DetailLayout,
  type FocusPoint,
  type FramingMode,
  type ImageDisplay,
  type ImageView,
} from '@/lib/image-display';

export interface ImageFramingApi {
  setValue(raw: unknown): void;
  getValue(): ImageDisplay | null | undefined;
  disable(): void;
}

declare global {
  interface Window {
    eventImageFraming?: ImageFramingApi;
  }
}

interface FramingState {
  width?: number;
  height?: number;
  card: { mode: FramingMode; focus: FocusPoint };
  detail: { layout: DetailLayout; mode: FramingMode; focus: FocusPoint };
}

function defaultState(): FramingState {
  return {
    card: { mode: 'auto', focus: { ...CENTER_FOCUS } },
    detail: { layout: 'auto', mode: 'auto', focus: { ...CENTER_FOCUS } },
  };
}

function stateFrom(display: ImageDisplay): FramingState {
  const base = defaultState();
  return {
    width: display.width,
    height: display.height,
    card: { mode: display.card?.mode ?? 'auto', focus: display.card?.focus ?? base.card.focus },
    detail: {
      layout: display.detail?.layout ?? 'auto',
      mode: display.detail?.mode ?? 'auto',
      focus: display.detail?.focus ?? base.detail.focus,
    },
  };
}

export function initImageFraming(opts: { urlInputId: string; rootId: string }): void {
  const urlInput = document.getElementById(opts.urlInputId) as HTMLInputElement | null;
  const root = document.getElementById(opts.rootId);
  if (!urlInput || !root) return;

  let enabled = true;
  let currentUrl = '';
  let state = defaultState();

  const rows = Array.from(root.querySelectorAll<HTMLElement>('.framing-row'));

  function toDisplay(): ImageDisplay | null {
    if (!currentUrl) return null;
    const display: ImageDisplay = { src: currentUrl, card: state.card, detail: state.detail };
    if (state.width && state.height) {
      display.width = state.width;
      display.height = state.height;
    }
    return display;
  }

  function render(): void {
    root!.classList.toggle('hidden', !enabled || !currentUrl);
    if (!enabled || !currentUrl) return;
    const display = toDisplay();
    for (const row of rows) {
      const view = row.dataset.view as ImageView;
      const framing = resolveFraming(currentUrl, display, view);
      const settings = state[view];

      const preview = row.querySelector<HTMLElement>('[data-preview]')!;
      // Editor knows the size once loaded; before that, show Auto as crop.
      preview.dataset.frame = framing.mode === 'full' ? 'full' : 'crop';
      preview.classList.toggle('event-image--side', framing.layout === 'side');
      preview.classList.toggle('framing-preview--banner', view === 'detail' && framing.layout !== 'side');
      const main = preview.querySelector<HTMLImageElement>('.event-image__main')!;
      main.style.objectPosition = `${framing.focus.x}% ${framing.focus.y}%`;

      const crosshair = row.querySelector<HTMLElement>('[data-crosshair]')!;
      crosshair.style.left = `${settings.focus.x}%`;
      crosshair.style.top = `${settings.focus.y}%`;

      row.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.mode === settings.mode));
      });
      row.querySelectorAll<HTMLButtonElement>('[data-layout]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.layout === state.detail.layout));
      });
    }
  }

  function loadImage(url: string): void {
    root!.querySelectorAll<HTMLImageElement>('[data-picker-img], .event-image__main, .event-image__backdrop').forEach(
      (img) => {
        img.src = url;
      }
    );
    const probe = new Image();
    probe.onload = () => {
      if (url !== currentUrl) return; // URL changed while loading
      state.width = probe.naturalWidth;
      state.height = probe.naturalHeight;
      render();
    };
    probe.src = url;
  }

  function showUrl(url: string, nextState: FramingState): void {
    currentUrl = url;
    state = nextState;
    if (url) loadImage(url);
    render();
  }

  urlInput.addEventListener('input', () => {
    const url = urlInput.value.trim();
    if (url === currentUrl) return;
    showUrl(url, defaultState()); // new image → old framing no longer applies
  });

  for (const row of rows) {
    const view = row.dataset.view as ImageView;
    row.querySelector<HTMLElement>('[data-picker]')!.addEventListener('click', (e) => {
      const img = row.querySelector<HTMLImageElement>('[data-picker-img]')!;
      const rect = img.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
      state[view].focus = {
        x: clamp(((e.clientX - rect.left) / rect.width) * 100),
        y: clamp(((e.clientY - rect.top) / rect.height) * 100),
      };
      if (state[view].mode === 'auto') state[view].mode = 'crop';
      render();
    });
    row.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        state[view].mode = b.dataset.mode as FramingMode;
        render();
      })
    );
    row.querySelectorAll<HTMLButtonElement>('[data-layout]').forEach((b) =>
      b.addEventListener('click', () => {
        state.detail.layout = b.dataset.layout as DetailLayout;
        render();
      })
    );
  }

  root.querySelector('[data-framing-reset]')?.addEventListener('click', () => {
    state = { ...defaultState(), width: state.width, height: state.height };
    render();
  });

  window.eventImageFraming = {
    setValue(raw: unknown) {
      enabled = true;
      const url = urlInput.value.trim();
      const parsed = parseImageDisplay(raw);
      // Saved src is the normalised URL; compare loosely so a bare
      // "example.com/x.jpg" in the input still matches "https://example.com/x.jpg".
      const matches = parsed && url && (parsed.src === url || parsed.src.endsWith(`//${url}`));
      showUrl(url, matches ? stateFrom(parsed) : defaultState());
    },
    getValue() {
      if (!enabled) return undefined;
      return toDisplay();
    },
    disable() {
      enabled = false;
      render();
    },
  };
}
```

- [ ] **Step 3: Init in the modal**

In `EditEventModal.astro`'s `<script>`, add after the `initImageDropZone({...})` call:

```ts
  import { initImageFraming } from '@/scripts/image-framing-field';

  initImageFraming({ urlInputId: 'editEventExternalImageUrl', rootId: 'editEventImageFraming' });
```

(Move the `import` up next to the other import — imports must be at the top of the script.)

- [ ] **Step 4: Lint + build**

Run: `npx eslint src/scripts/image-framing-field.ts && npm run build 2>&1 | tail -2`
Expected: no lint errors; `Complete!`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/EditEventModal.astro src/scripts/image-framing-field.ts
git commit -m "feat(admin): image framing panel in the event edit modal"
```

---

### Task 10: Wire load/save on every modal page (+ canary test)

**Files:**
- Create: `src/lib/__tests__/image-framing-wiring.test.ts`
- Modify: `package.json`
- Modify: `src/pages/admin.astro`, `src/pages/admin/events/[id].astro`, `src/pages/admin/events/new.astro`, `src/pages/events/[id].astro`

Load sites call `setValue` right after the URL input is set (after any `refreshEventImagePreview()` call). Save sites add `image_display` to the payload only for real events. Duplicate-from-form paths need nothing: the panel keeps its state while the URL is unchanged.

- [ ] **Step 1: Write the failing canary**

`src/lib/__tests__/image-framing-wiring.test.ts`:

```ts
/**
 * Image-framing wiring canary.
 *
 * The framing panel lives in the shared EditEventModal, but each page fills and
 * saves that modal with its own inline script. A page that forgets to call
 * setValue shows stale framing from the previous event; one that forgets
 * getValue silently drops the admin's choices. Neither is caught by types or
 * lint, so assert the contract on the source.
 */
import { readFileSync } from 'node:fs';

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(ok ? `✅ PASS: ${label}` : `❌ FAIL: ${label}${detail ? `\n        ${detail}` : ''}`);
  if (!ok) failures++;
}

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const count = (src: string, re: RegExp) => (src.match(re) || []).length;

const SET = /eventImageFraming\?\.setValue\(/g;
const GET = /image_display:\s*window\.eventImageFraming\?\.getValue\(\)/g;
const DISABLE = /eventImageFraming\?\.disable\(\)/g;

console.log('🧪 Image-framing wiring\n');

const admin = read('src/pages/admin.astro');
check('admin.astro: load in editExistingEvent, duplicateEvent, paste reset (≥3)', count(admin, SET) >= 3, `found ${count(admin, SET)}`);
check('admin.astro: staged events disable the panel', count(admin, DISABLE) >= 1);
check('admin.astro: new-event and existing-event saves send framing (≥2)', count(admin, GET) >= 2, `found ${count(admin, GET)}`);

const adminEvent = read('src/pages/admin/events/[id].astro');
check('admin/events/[id]: load in populateEventForm', count(adminEvent, SET) >= 1);
check('admin/events/[id]: updateEvent and createEvent send framing (≥2)', count(adminEvent, GET) >= 2, `found ${count(adminEvent, GET)}`);

const adminNew = read('src/pages/admin/events/new.astro');
check('admin/events/new: reset on open', count(adminNew, SET) >= 1);
check('admin/events/new: createEvent sends framing', count(adminNew, GET) >= 1);

const publicEvent = read('src/pages/events/[id].astro');
check('events/[id]: load when opening the editor', count(publicEvent, SET) >= 1);
check('events/[id]: save sends framing', count(publicEvent, GET) >= 1);

console.log(failures === 0 ? '\nAll wiring checks passed' : `\n${failures} failing`);
process.exit(failures === 0 ? 0 : 1);
```

Add to `package.json` scripts after `test:image-display`:

```json
    "test:image-framing-wiring": "tsx src/lib/__tests__/image-framing-wiring.test.ts",
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:image-framing-wiring`
Expected: FAIL on every check.

- [ ] **Step 3: `src/pages/admin.astro`**

Find each site with `grep -n "editEventExternalImageUrl\|refreshEventImagePreview" src/pages/admin.astro`.

- `editStagedEvent` (~L2065–2066): after `window.refreshEventImagePreview?.();` add
  ```js
        window.eventImageFraming?.disable();
  ```
- `editExistingEvent` (~L2172–2173): after `window.refreshEventImagePreview?.();` add
  ```js
        window.eventImageFraming?.setValue(event.image_display);
  ```
- `window.duplicateEvent` (~L2302–2303): after `window.refreshEventImagePreview?.();` add
  ```js
      window.eventImageFraming?.setValue(event.image_display);
  ```
- `submitPasteImport` (~L3701–3702, URL reset to `''`): after `window.refreshEventImagePreview?.();` add
  ```js
      window.eventImageFraming?.setValue(null);
  ```
- Modal submit, `new-event` branch (~L3783 `const formData = {`): add a property after `external_image_url: ...`:
  ```js
          image_display: window.eventImageFraming?.getValue(),
  ```
- Modal submit, shared edit branch (~L3888, `formData.external_image_url = ...` inside the website/link/image block): directly after the `if (currentEditType === 'existing-event') { formData.status = ... }` block (~L3906) add
  (written as `Object.assign` so it matches the canary's `image_display: window.eventImageFraming?.getValue()` pattern):
  ```js
      if (currentEditType === 'existing-event') {
        Object.assign(formData, { image_display: window.eventImageFraming?.getValue() });
      }
  ```
  Staged events (`events-staged/edit`) must not receive the key — that table has no such column.

`getValue()` returns `undefined` when disabled; `JSON.stringify` drops `undefined` properties, so the field is simply omitted.

- [ ] **Step 4: `src/pages/admin/events/[id].astro`**

- `populateEventForm` (~L314): after the line setting `editEventExternalImageUrl`, add
  ```js
    window.eventImageFraming?.setValue(event.image_display);
  ```
- `updateEvent` (~L414, `formData.external_image_url = normalizeUrl(...)`): next line add
  ```js
    Object.assign(formData, { image_display: window.eventImageFraming?.getValue() });
  ```
- `createEvent` (~L469 inside `const formData = {`): after `external_image_url: ...,` add
  ```js
      image_display: window.eventImageFraming?.getValue(),
  ```

- [ ] **Step 5: `src/pages/admin/events/new.astro`**

- `openCreateEventModal` (~L234, URL reset to `''`): next line add
  ```js
    window.eventImageFraming?.setValue(null);
  ```
- `createEvent` (~L284 inside `const formData = {`): after `external_image_url: ...,` add
  ```js
      image_display: window.eventImageFraming?.getValue(),
  ```

- [ ] **Step 6: `src/pages/events/[id].astro`**

- Editor open (~L738, the line with `set('editEventExternalImageUrl', event.external_image_url);`): after that statement line add
  ```ts
        window.eventImageFraming?.setValue(event.image_display);
  ```
- Save (~L864 inside `const formData = {`): after `external_image_url: normalizeUrl(...),` add
  ```ts
            image_display: window.eventImageFraming?.getValue(),
  ```

This page's script is TypeScript. `window.eventImageFraming` is typed by the `declare global` in `src/scripts/image-framing-field.ts`, which is part of the TS program, so no extra declaration is needed. The other three pages are plain JS.

- [ ] **Step 7: Run canary and build**

Run: `npm run test:image-framing-wiring && npm run lint 2>&1 | tail -3 && npm run build 2>&1 | tail -2`
Expected: all wiring PASS; lint clean; `Complete!`.

- [ ] **Step 8: Commit**

```bash
git add package.json src/lib/__tests__/image-framing-wiring.test.ts src/pages/admin.astro "src/pages/admin/events/[id].astro" src/pages/admin/events/new.astro "src/pages/events/[id].astro"
git commit -m "feat(admin): load and save image framing from every edit-modal page"
```

---

### Task 11: Full verification and PR

- [ ] **Step 1: Run every relevant check**

```bash
npm run test:image-display
npm run test:image-framing-wiring
npm run test:image-upload
npm run test:group-series
npm run test:duplicate-event-wiring
npm run lint
npm run build
npx astro check 2>&1 | grep -E "image-display|EventImage|image-framing|EventCarouselCard|events/\[id\]" || echo "no new type errors in touched files"
```

Expected: all tests PASS; lint clean; build `Complete!`; last command prints `no new type errors in touched files` (main may carry unrelated pre-existing `astro check` errors — only touched files matter).

- [ ] **Step 2: Migration before merge (user action)**

The column must exist in prod before this code deploys, or saves that include `image_display` will fail. Ask the user how they apply migrations to prod (e.g. `supabase db push`) and to apply `20261002120000_add_event_image_display.sql` before merging. Reads are safe either way (`*` selects and `resolveFraming` treat a missing column as Auto) — except `getInheritableParentFields`, which names the column and would error; that's another reason to migrate first.

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin feat/event-image-framing
gh pr create --title "feat(events): admin image framing (focal point, full + blur, detail layouts)" --body "$(cat <<'EOF'
## Summary
- New `events.image_display` (JSONB) + `public_events` view column, parsed by `src/lib/image-display.ts`
- Carousel card and detail page render images via `EventImage`: crop around a focal point, or full image over a blurred thumbnail; Auto picks per image shape (browser-measured when size unknown, no layout shift)
- Detail page: banner or side-by-side layout (Auto → side-by-side for tall images with known size)
- Edit modal: framing panel (focal-point picker, live previews, Auto / Crop / Full + blur, layout), wired on all four modal pages
- Admin create/update endpoints validate framing and pin it to the saved image URL

Spec: docs/superpowers/specs/2026-10-02-event-image-framing-design.md

## Before merging
- [ ] Apply migration `20261002120000_add_event_image_display.sql` to prod

## Test plan
- [ ] `npm run test:image-display`, `npm run test:image-framing-wiring`, lint, build
- [ ] Deploy preview: portrait poster (e.g. Così Fan Tutte event) shows whole in card + detail
- [ ] Deploy preview: landscape photo still crops as before
- [ ] Deploy preview: set a focal point + side-by-side in the modal, save, reload — persists
- [ ] Deploy preview: replace the image URL — framing resets to Auto
- [ ] Deploy preview: series child inherits parent image framing

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Bind PR in the desktop app**

Call `get_status`; if the PR isn't reported, `bind_pr` it. Report CI status to the user; don't poll.
