# Event Image Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins attach an image to an event by dragging/dropping (or browsing for) a file in the admin panel, in addition to pasting an external URL.

**Architecture:** A new server endpoint receives the file behind `withAdminAuth`, uploads it to a public Supabase Storage bucket using the service-role client, and returns the file's public URL. The browser writes that URL into the existing `#editEventExternalImageUrl` input, so every existing form-submit path persists it via `external_image_url` with **zero changes to the create/update endpoints**. Display is unchanged — `optimizedImageUrl()` proxies any `https://` image through the Netlify Image CDN, which `netlify.toml` already allow-lists (`remote_images = ["https://.*"]`).

**Tech Stack:** Astro 6 (SSR, Netlify adapter), Supabase JS v2 (`supabaseAdmin` service-role client + Storage), TypeScript, Tailwind, Shoelace. Tests are standalone `tsx` scripts (no test framework).

**Key facts confirmed in the codebase:**
- `supabaseAdmin` (service-role, RLS-bypassing) is exported from `src/lib/supabase.ts` and exposes `.storage`.
- `withAdminAuth`, `jsonResponse`, `jsonError` live in `src/lib/api-utils.ts`.
- The admin Edit/Create event modal ([src/components/ui/EditEventModal.astro](../../../src/components/ui/EditEventModal.astro)) is shared by both the create (`new-event`) and edit flows; both read/write the single input `#editEventExternalImageUrl`.
- `normalizeUrl()` (`src/lib/scraper/normalize.ts:67`) returns any string that already has a URL scheme untouched, so a `https://…supabase.co/storage/…` URL survives save unchanged.
- The recurring **series** creation form uses a separate input `#seriesExternalImageUrl` — handled in an optional task.

**Deferred (NOT in this plan):** deleting old files on replace/clear (risks deleting still-referenced files on cancel; orphans are cheap), orphan cleanup on event delete, per-view previews, cropping/zoom, the `images` table + `image_id` model, public-submission uploads, images on activities/announcements.

---

### Task 1: Create the storage bucket migration

**Files:**
- Create: `supabase/migrations/20260629120000_create_event_images_bucket.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Public storage bucket for admin-uploaded event images.
-- Public READ so images render directly and via the Netlify Image CDN.
-- WRITES happen only through the server upload endpoint using the service-role
-- key (which bypasses RLS), so no storage.objects policies are needed here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-images',
  'event-images',
  true,
  5242880, -- 5 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260629120000_create_event_images_bucket.sql
git commit -m "feat(storage): add public event-images bucket migration"
```

> The migration applies to the hosted project on `supabase db push`. Local application is exercised in Task 7's manual verification.

---

### Task 2: Re-enable Supabase Storage for local dev

**Files:**
- Modify: `supabase/config.toml` (the `[storage]` block, currently line 89)

- [ ] **Step 1: Enable storage, leave image transformation off**

Change:

```toml
[storage]
enabled = false  # not used by this app; disabled to avoid CLI 2.101.0 image bug
```

to:

```toml
[storage]
enabled = true  # event-images bucket for admin uploads; image_transformation stays off
```

Leave the `# [storage.image_transformation]` block commented out (the prior CLI image bug was in the transformation/imgproxy container, which we do not use — display goes through the Netlify Image CDN).

- [ ] **Step 2: Commit**

```bash
git add supabase/config.toml
git commit -m "chore(supabase): enable storage for local dev"
```

> Production (hosted Supabase) ignores `config.toml`; this only affects local `supabase start`. If local `supabase start` still hits the CLI image bug, the fallback is to test uploads against the hosted dev project instead (note it in the PR and move on — do not block).

---

### Task 3: Server-side upload validation helper (TDD)

Pure, I/O-free functions so they can be unit-tested with the repo's `tsx` test style.

**Files:**
- Create: `src/lib/event-image-upload.ts`
- Test: `src/lib/__tests__/event-image-upload.test.ts`
- Modify: `package.json` (add a test script)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/event-image-upload.test.ts`:

```ts
import {
  validateImageUpload,
  buildImageObjectPath,
  MAX_IMAGE_BYTES,
} from '../event-image-upload';

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`✅ PASS: ${label}`);
  } else {
    console.log(`❌ FAIL: ${label}`);
    failures++;
  }
}

console.log('🧪 Testing event image upload validation\n');

const jpeg = validateImageUpload({ type: 'image/jpeg', size: 1000 });
check('jpeg accepted', jpeg.ok === true);
check('jpeg extension is jpg', jpeg.ok === true && jpeg.extension === 'jpg');

const png = validateImageUpload({ type: 'image/png', size: 1000 });
check('png extension is png', png.ok === true && png.extension === 'png');

const webp = validateImageUpload({ type: 'image/webp', size: 1000 });
check('webp extension is webp', webp.ok === true && webp.extension === 'webp');

const gif = validateImageUpload({ type: 'image/gif', size: 1000 });
check('gif rejected', gif.ok === false);

const empty = validateImageUpload({ type: 'image/png', size: 0 });
check('empty file rejected', empty.ok === false);

const tooBig = validateImageUpload({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 });
check('oversize rejected', tooBig.ok === false);

const atLimit = validateImageUpload({ type: 'image/png', size: MAX_IMAGE_BYTES });
check('exactly-at-limit accepted', atLimit.ok === true);

check(
  'object path is uuid.ext',
  buildImageObjectPath('abc-123', 'jpg') === 'abc-123.jpg'
);

console.log(`\n${failures === 0 ? '✅ All tests passed' : `❌ ${failures} test(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx src/lib/__tests__/event-image-upload.test.ts`
Expected: FAIL — cannot find module `../event-image-upload`.

- [ ] **Step 3: Implement the helper**

Create `src/lib/event-image-upload.ts`:

```ts
/** Storage bucket holding admin-uploaded event images. */
export const EVENT_IMAGES_BUCKET = 'event-images';

/** Image MIME types we accept for upload. */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Maximum upload size in bytes (5 MiB). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type ImageValidation =
  | { ok: true; extension: string }
  | { ok: false; error: string };

/** Validate an uploaded image's MIME type and size. Pure — no I/O. */
export function validateImageUpload(input: { type: string; size: number }): ImageValidation {
  const extension = EXTENSION_BY_TYPE[input.type];
  if (!extension) {
    return { ok: false, error: 'Unsupported image type. Use JPEG, PNG, or WebP.' };
  }
  if (input.size <= 0) {
    return { ok: false, error: 'File is empty.' };
  }
  if (input.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'Image is too large. Maximum size is 5 MB.' };
  }
  return { ok: true, extension };
}

/** Build the object path (filename) for a freshly uploaded image. */
export function buildImageObjectPath(uuid: string, extension: string): string {
  return `${uuid}.${extension}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx src/lib/__tests__/event-image-upload.test.ts`
Expected: PASS — `✅ All tests passed`.

- [ ] **Step 5: Add a package.json test script**

In `package.json`, under `"scripts"`, add after the existing `"test:deps"` line:

```json
    "test:image-upload": "tsx src/lib/__tests__/event-image-upload.test.ts"
```

(Add a comma to the previous line as needed to keep valid JSON.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/event-image-upload.ts src/lib/__tests__/event-image-upload.test.ts package.json
git commit -m "feat(events): add image upload validation helper"
```

---

### Task 4: Upload API endpoint

**Files:**
- Create: `src/pages/api/admin/events/upload-image.ts`

- [ ] **Step 1: Write the endpoint**

Create `src/pages/api/admin/events/upload-image.ts`:

```ts
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import {
  EVENT_IMAGES_BUCKET,
  validateImageUpload,
  buildImageObjectPath,
} from '@/lib/event-image-upload';

export const prerender = false;

export const POST = withAdminAuth(async ({ request }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('Expected multipart form data', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return jsonError('No file provided', 400);
  }

  const validation = validateImageUpload({ type: file.type, size: file.size });
  if (!validation.ok) {
    return jsonError(validation.error, 400);
  }

  const objectPath = buildImageObjectPath(crypto.randomUUID(), validation.extension);
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(EVENT_IMAGES_BUCKET)
    .upload(objectPath, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error('[UPLOAD EVENT IMAGE] Storage error:', uploadError);
    return jsonError('Failed to upload image', 500);
  }

  const { data } = supabaseAdmin.storage.from(EVENT_IMAGES_BUCKET).getPublicUrl(objectPath);

  return jsonResponse({ url: data.publicUrl, path: objectPath }, 201);
});
```

- [ ] **Step 2: Type-check / lint the new file**

Run: `npx tsc --noEmit` (or `npm run lint`)
Expected: no new errors referencing `upload-image.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/events/upload-image.ts
git commit -m "feat(events): add admin image upload endpoint"
```

> Endpoint behavior is verified end-to-end in Task 7 (the repo has no HTTP test harness; the pure validation logic is already covered in Task 3).

---

### Task 5: Client-side drag/drop helper

A reusable browser module that wires a drop zone + click-to-browse to an existing URL input, uploads on file selection, shows a preview, and exposes a global to refresh the preview when the input is set programmatically.

**Files:**
- Create: `src/scripts/image-upload-field.ts`

- [ ] **Step 1: Write the helper**

Create `src/scripts/image-upload-field.ts`:

```ts
/**
 * Wire a drag-and-drop / click-to-browse image uploader to an existing URL
 * input. On a successful upload the returned public URL is written into the URL
 * input (so existing form-submit code picks it up unchanged) and a thumbnail
 * preview is shown. Pasting a URL into the input still works.
 *
 * Because the admin modal sets the URL input's value programmatically when it
 * opens (which does not fire an `input` event), this also installs a global
 * `window.refreshEventImagePreview()` the modal can call to re-sync the preview.
 */
export interface ImageDropZoneOptions {
  urlInputId: string;
  dropZoneId: string;
  fileInputId: string;
  previewId: string;
  statusId: string;
  endpoint?: string;
  /** Optional name for the global refresh function (default refreshEventImagePreview). */
  refreshGlobalName?: string;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

export function initImageDropZone(opts: ImageDropZoneOptions): void {
  const endpoint = opts.endpoint ?? '/api/admin/events/upload-image';
  const urlInput = document.getElementById(opts.urlInputId) as HTMLInputElement | null;
  const dropZone = document.getElementById(opts.dropZoneId);
  const fileInput = document.getElementById(opts.fileInputId) as HTMLInputElement | null;
  const preview = document.getElementById(opts.previewId) as HTMLImageElement | null;
  const status = document.getElementById(opts.statusId);
  if (!urlInput || !dropZone || !fileInput || !preview || !status) return;

  function showPreview(url: string): void {
    if (url) {
      preview!.src = url;
      preview!.classList.remove('hidden');
    } else {
      preview!.removeAttribute('src');
      preview!.classList.add('hidden');
    }
  }

  function setStatus(message: string, isError: boolean): void {
    status!.textContent = message;
    status!.classList.toggle('text-red-600', isError);
  }

  async function upload(file: File): Promise<void> {
    if (!ACCEPTED.includes(file.type)) {
      setStatus('Unsupported file type. Use JPEG, PNG, or WebP.', true);
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus('Image is too large. Maximum size is 5 MB.', true);
      return;
    }
    setStatus('Uploading…', false);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(endpoint, { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || 'Upload failed.', true);
        return;
      }
      urlInput!.value = data.url;
      showPreview(data.url);
      setStatus('Uploaded.', false);
    } catch (err) {
      console.error('[image upload] failed', err);
      setStatus('Upload failed. Please try again.', true);
    }
  }

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void upload(file);
  });
  ['dragenter', 'dragover'].forEach((evt) =>
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add('ring-2', 'ring-indigo-400');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove('ring-2', 'ring-indigo-400');
    })
  );
  dropZone.addEventListener('drop', (e) => {
    const file = (e as DragEvent).dataTransfer?.files?.[0];
    if (file) void upload(file);
  });

  // Sync preview when a URL is typed/pasted.
  urlInput.addEventListener('input', () => showPreview(urlInput.value.trim()));

  // Global hook so the modal can re-sync after setting the value programmatically.
  const globalName = opts.refreshGlobalName ?? 'refreshEventImagePreview';
  (window as unknown as Record<string, () => void>)[globalName] = () =>
    showPreview(urlInput.value.trim());
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `image-upload-field.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/scripts/image-upload-field.ts
git commit -m "feat(events): add client drag/drop image upload helper"
```

---

### Task 6: Wire drag/drop into the Edit/Create event modal

This single modal serves both the create (`new-event`) and edit flows, so wiring it here covers both.

**Files:**
- Modify: `src/components/ui/EditEventModal.astro` (replace the image form-field, lines 55-58; add a `<script>` before the final closing of the file)
- Modify: `src/pages/admin.astro` (refresh the preview after each place the image input value is set programmatically)

- [ ] **Step 1: Replace the image field markup**

In `src/components/ui/EditEventModal.astro`, replace this block (currently lines 55-58):

```astro
      <div class="form-field">
        <label class="form-label">External Image URL:</label>
        <input type="url" id="editEventExternalImageUrl" placeholder="https://example.com/image.jpg" class="form-input-base">
      </div>
```

with:

```astro
      <div class="form-field">
        <label class="form-label">Event Image:</label>
        <div
          id="editEventImageDropZone"
          class="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-md p-4 text-center text-sm text-gray-500 cursor-pointer hover:border-indigo-400 transition-colors"
        >
          <span class="material-symbols-outlined text-2xl">upload</span>
          <span>Drag &amp; drop an image here, or click to browse</span>
          <span class="text-xs text-gray-400">JPEG, PNG, or WebP · up to 5 MB</span>
        </div>
        <input type="file" id="editEventImageFile" accept="image/jpeg,image/png,image/webp" class="hidden" />
        <p id="editEventImageStatus" class="mt-1 text-xs text-gray-500" aria-live="polite"></p>
        <img id="editEventImagePreview" alt="Event image preview" class="hidden mt-2 max-h-40 rounded-md border border-gray-200" />
        <label class="form-label mt-2">Or paste an image URL:</label>
        <input type="url" id="editEventExternalImageUrl" placeholder="https://example.com/image.jpg" class="form-input-base" />
      </div>
```

(The input keeps its id `editEventExternalImageUrl`, so all existing save code is untouched.)

- [ ] **Step 2: Add the wiring script**

At the very end of `src/components/ui/EditEventModal.astro` (after the final `</div>` that closes `#editEventModal`), add:

```astro
<script>
  import { initImageDropZone } from '@/scripts/image-upload-field';

  initImageDropZone({
    urlInputId: 'editEventExternalImageUrl',
    dropZoneId: 'editEventImageDropZone',
    fileInputId: 'editEventImageFile',
    previewId: 'editEventImagePreview',
    statusId: 'editEventImageStatus',
  });
</script>
```

- [ ] **Step 3: Refresh the preview wherever the value is set programmatically**

In `src/pages/admin.astro`, find every line that assigns to the image input. Each looks like:

```js
document.getElementById('editEventExternalImageUrl').value = ...;
```

(at the time of writing these are around lines 2025, 2131, 2260, 2407, and 3653). Immediately **after** each such assignment, add:

```js
        window.refreshEventImagePreview?.();
```

Use a search for `editEventExternalImageUrl').value =` to find them all; add the refresh call after each assignment (not after reads on the save side, e.g. lines ~2359/2527/3744/3839, which only read `.value`).

- [ ] **Step 4: Verify in the browser (dev server)**

Start the dev server and verify there are no console errors and the drop zone renders in the modal. (Full functional verification is Task 7.)

Run: `npm run dev`
Expected: admin event modal shows the "Event Image" drop zone above the URL field; no console errors on open.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/EditEventModal.astro src/pages/admin.astro
git commit -m "feat(events): drag/drop image upload in admin event modal"
```

---

### Task 7: End-to-end manual verification

No code changes — confirm the feature works against a real Supabase Storage backend.

- [ ] **Step 1: Apply the migration**

- Hosted: `supabase db push` (applies Task 1 migration to the project).
- OR local: ensure `.env.local`/env has `USE_LOCAL_DB=true`, run `supabase start` then `supabase db reset` (or `supabase migration up`). If local storage hits the CLI image bug, use the hosted dev project instead (see Task 2 note).

- [ ] **Step 2: Confirm the bucket exists and is public**

Supabase Studio → Storage → confirm an `event-images` bucket exists and is marked Public. (Or SQL: `select id, public from storage.buckets where id = 'event-images';` → `public = true`.)

- [ ] **Step 3: Upload via the admin UI**

1. Log in to the admin panel as an admin.
2. Open "Create event" (and separately an existing event's Edit modal).
3. Drag an image onto the drop zone (and separately try click-to-browse). Confirm the status shows "Uploading…" then "Uploaded.", and a thumbnail preview appears.
4. Try a non-image / >5 MB file → confirm an inline error and no upload.
5. Save the event.

- [ ] **Step 4: Confirm persistence and display**

1. Reopen the saved event's Edit modal → the preview shows the uploaded image and the URL field contains the `…/storage/v1/object/public/event-images/…` URL.
2. View the event on the front page (featured) and on the event detail page → the image renders. In production it loads via `/.netlify/images?...`.

- [ ] **Step 5: Confirm pasting a URL still works**

In the modal, clear the field, paste an external `https://` image URL → preview updates → save → image displays. Confirms the dual-path "one image slot" behavior.

---

### Task 8 (OPTIONAL / stretch): Wire drag/drop into the recurring-series form

The series-creation form uses a separate input `#seriesExternalImageUrl` in `src/pages/admin.astro`. Reuse the same helper for a consistent experience. Skip for the first ship if time-boxed.

**Files:**
- Modify: `src/pages/admin.astro` (series form image field + an init call)

- [ ] **Step 1: Add a drop zone next to the series image input**

Find the series form's image input (`id="seriesExternalImageUrl"`). Add, immediately before it, the same drop-zone markup pattern as Task 6 Step 1 but with series-scoped ids:

```html
<div
  id="seriesImageDropZone"
  class="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-md p-4 text-center text-sm text-gray-500 cursor-pointer hover:border-indigo-400 transition-colors"
>
  <span class="material-symbols-outlined text-2xl">upload</span>
  <span>Drag &amp; drop an image here, or click to browse</span>
  <span class="text-xs text-gray-400">JPEG, PNG, or WebP · up to 5 MB</span>
</div>
<input type="file" id="seriesImageFile" accept="image/jpeg,image/png,image/webp" class="hidden" />
<p id="seriesImageStatus" class="mt-1 text-xs text-gray-500" aria-live="polite"></p>
<img id="seriesImagePreview" alt="Series image preview" class="hidden mt-2 max-h-40 rounded-md border border-gray-200" />
```

- [ ] **Step 2: Initialize the helper for the series field**

In the appropriate `<script>` for the series form, add:

```ts
import { initImageDropZone } from '@/scripts/image-upload-field';

initImageDropZone({
  urlInputId: 'seriesExternalImageUrl',
  dropZoneId: 'seriesImageDropZone',
  fileInputId: 'seriesImageFile',
  previewId: 'seriesImagePreview',
  statusId: 'seriesImageStatus',
  refreshGlobalName: 'refreshSeriesImagePreview',
});
```

After each place the series form sets `seriesExternalImageUrl').value = …` programmatically (e.g. around lines 2586, 2661, 2694), add `window.refreshSeriesImagePreview?.();`.

- [ ] **Step 3: Verify and commit**

Verify drag/drop works in the series form, then:

```bash
git add src/pages/admin.astro
git commit -m "feat(events): drag/drop image upload in series form"
```

---

## Self-Review

**Spec coverage:**
- One image slot, two ways to fill it → Task 6 (drop zone + URL input share `#editEventExternalImageUrl`). ✓
- Reuse `external_image_url` (no schema change) → endpoint returns a URL the client writes into the existing input; create/update endpoints untouched. ✓
- Public Supabase Storage bucket, writes via service role → Task 1 (public bucket) + Task 4 (service-role upload). ✓
- Upload endpoint behind admin auth with type/size validation → Tasks 3 + 4. ✓
- Drag/drop + click-to-browse + thumbnail preview in admin → Tasks 5 + 6. ✓
- Error handling client + server → Task 5 (client guards + server-error display) + Tasks 3/4 (400/500). ✓
- Display unchanged via Netlify Image CDN → confirmed `remote_images = ["https://.*"]`; no change needed. ✓
- Deferred items listed and excluded. ✓ (Replace-cleanup moved to deferred — flagged in header.)

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `validateImageUpload`/`buildImageObjectPath`/`MAX_IMAGE_BYTES`/`EVENT_IMAGES_BUCKET` are defined in Task 3 and consumed with the same names in Task 4; `initImageDropZone` options match between Tasks 5, 6, and 8. ✓
