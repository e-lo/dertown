# Kid Activities Admin — CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/admin/kid-activities` fully interactive — fix 404 errors, wire up Edit/Create/Delete/Duplicate buttons, implement form submission.

**Architecture:** Create missing REST endpoints under `/api/admin/kid-activities/`, then add the missing JavaScript functions to `kid-activities.astro`. The page already has a complete HTML modal form and list rendering; only the JS glue and API layer are missing.

**Tech Stack:** Astro API routes, TypeScript, Supabase (via `supabaseAdmin`), `withAdminAuth` middleware (same pattern as `/api/admin/events.ts`).

**Out of scope (stubs only):** Meeting patterns, activity-events/schedules management, bulk operations, export. These get `console.log` stubs so buttons don't throw.

---

## Context for the implementer

### Codebase patterns to follow

**Auth middleware** — all admin API routes use `withAdminAuth` from `@/lib/api-utils`:
```typescript
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
export const GET = withAdminAuth(async ({ auth }) => { ... });
```

**DB client** — use `supabaseAdmin` (service role, bypasses RLS):
```typescript
import { supabaseAdmin } from '@/lib/supabase';
```

**Reference file** — `/src/pages/api/admin/events.ts` is the canonical example of a GET+PUT admin endpoint. Read it before starting.

### Activities table key columns
```
id                     uuid PK
name                   text NOT NULL
description            text
activity_hierarchy_type text NOT NULL  -- 'PROGRAM' | 'SESSION' | 'CLASS_TYPE' | 'CLASS_INSTANCE'
parent_activity_id     uuid FK → activities.id
activity_type          text  -- 'sports'|'arts'|'music'|'dance'|'academic'|'recreation'|'other'
program_format         text  -- 'camp'|'class'|'lesson'|'league'|'session'
status                 enum  -- 'pending'|'approved'|'duplicate'|'archived'  default: 'pending'
location_id            uuid FK → locations.id
location_details       text
min_age / max_age      integer
min_grade / max_grade  text
cost                   text
website                text
registration_link      text
registration_opens     date
registration_closes    date
registration_info      text
registration_required  boolean
is_summer/fall/winter/spring boolean
notes                  text
```

### DB function for ancestor location lookup
```sql
-- Returns rows with columns: id, name, location_id, activity_hierarchy_type
SELECT * FROM get_activity_ancestors('activity-uuid-here');
```

### Kid-activities admin page script structure
The page uses a plain `<script>` tag (NOT `type="module"`), so functions added there are global by default. The page already exposes `makeApiCall` on `window`. The DOMContentLoaded handler calls `loadLocations()`, `loadEffectiveLocations()`, `loadSchedules()` — these already exist. You are adding new functions to the same `<script>` block.

### The modal form
`id="activityModal"` — toggle visibility with `classList.remove('hidden')` / `classList.add('hidden')`.
Key form field IDs: `activityId`, `parentActivityId`, `activityHierarchyType`, `activityName`, `activityType`, `activityDescription`, `locationId`, `minAge`, `maxAge`, `minGrade`, `maxGrade`, `cost`, `commitmentLevel`, `website`, `startDatetime`, `endDatetime`, `registrationOpens`, `registrationCloses`, `registrationLink`, `registrationRequired`, `registrationInfo`.

Section visibility by hierarchy type:
- `sessionInfoSection` — show only for SESSION
- `classInstanceInfoSection` — show only for CLASS_INSTANCE
- `standardActivityFields` — show for PROGRAM, CLASS_TYPE, CLASS_INSTANCE (hide for SESSION)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/api/admin/kid-activities.ts` | **Create** | GET list (with optional `?status=` filter) + POST create |
| `src/pages/api/admin/kid-activities/[id].ts` | **Create** | GET one, PUT update, DELETE |
| `src/pages/api/admin/kid-activities/[id]/effective-location.ts` | **Create** | GET inherited location walking up ancestor tree |
| `src/pages/api/admin/kid-activities/[id]/activity-events.ts` | **Create** | GET stub (returns empty events array — real scheduling is out of scope) |
| `src/pages/admin/kid-activities.astro` | **Modify** (script section only) | Add showModal, closeModal, editActivity, createChildActivity, deleteActivity, duplicateActivity, selectScheduleType, form submit handler, stubs for meeting patterns / bulk ops |

---

## Task 1: Create base CRUD API — `kid-activities.ts`

**Files:**
- Create: `src/pages/api/admin/kid-activities.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/pages/api/admin/kid-activities.ts
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ url }) => {
  const status = url.searchParams.get('status') ?? null;

  let query = supabaseAdmin
    .from('activities')
    .select('*')
    .order('name', { ascending: true });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    console.error('[kid-activities GET]', error);
    return jsonError('Failed to fetch activities');
  }
  return jsonResponse({ activities: data ?? [] });
});

export const POST = withAdminAuth(async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  if (!body.name || !body.activity_hierarchy_type) {
    return jsonError('name and activity_hierarchy_type are required', 400);
  }

  // Clean empty strings to null
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    cleaned[k] = v === '' ? null : v;
  }
  cleaned.status = cleaned.status ?? 'pending';

  const { data, error } = await supabaseAdmin
    .from('activities')
    .insert(cleaned)
    .select('*')
    .single();

  if (error) {
    console.error('[kid-activities POST]', error);
    return jsonError(`Failed to create activity: ${error.message}`, 500);
  }
  return jsonResponse({ activity: data }, 201);
});
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/elizabethsall/Documents/GitHub/dertown && npx tsc --noEmit 2>&1 | grep kid-activities
```
Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/kid-activities.ts
git commit -m "feat(kid-activities): add GET list + POST create API endpoints"
```

---

## Task 2: Create single-record API — `[id].ts`

**Files:**
- Create: `src/pages/api/admin/kid-activities/[id].ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p /Users/elizabethsall/Documents/GitHub/dertown/src/pages/api/admin/kid-activities
```

```typescript
// src/pages/api/admin/kid-activities/[id].ts
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ params }) => {
  const { id } = params;
  const { data, error } = await supabaseAdmin
    .from('activities')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return jsonError('Activity not found', 404);
  return jsonResponse({ activity: data });
});

export const PUT = withAdminAuth(async ({ request, params }) => {
  const { id } = params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  // Clean empty strings to null, remove id from update payload
  const { id: _id, ...rest } = body as any;
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    cleaned[k] = v === '' ? null : v;
  }

  const { data, error } = await supabaseAdmin
    .from('activities')
    .update(cleaned)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[kid-activities PUT]', error);
    return jsonError(`Failed to update: ${error.message}`, 500);
  }
  return jsonResponse({ activity: data });
});

export const DELETE = withAdminAuth(async ({ params }) => {
  const { id } = params;
  const { error } = await supabaseAdmin
    .from('activities')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[kid-activities DELETE]', error);
    return jsonError(`Failed to delete: ${error.message}`, 500);
  }
  return jsonResponse({ ok: true });
});
```

- [ ] **Step 2: Check for TypeScript errors**

```bash
cd /Users/elizabethsall/Documents/GitHub/dertown && npx tsc --noEmit 2>&1 | grep "kid-activities"
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/kid-activities/[id].ts
git commit -m "feat(kid-activities): add GET/PUT/DELETE single-record endpoints"
```

---

## Task 3: Fix 404 storm — effective-location and activity-events endpoints

**Files:**
- Create: `src/pages/api/admin/kid-activities/[id]/effective-location.ts`
- Create: `src/pages/api/admin/kid-activities/[id]/activity-events.ts`

- [ ] **Step 1: Create the nested directory**

```bash
mkdir -p /Users/elizabethsall/Documents/GitHub/dertown/src/pages/api/admin/kid-activities/\[id\]
```

- [ ] **Step 2: Create effective-location endpoint**

This walks up the `parent_activity_id` chain to find the first non-null `location_id`, then joins to get the location name.

```typescript
// src/pages/api/admin/kid-activities/[id]/effective-location.ts
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ params }) => {
  const { id } = params;

  // Walk up ancestor chain to find the first location_id
  // Use the DB function get_activity_ancestors which returns ancestors in order
  const { data: ancestors, error: ancestorError } = await supabaseAdmin
    .rpc('get_activity_ancestors', { activity_uuid: id });

  // Also check the activity itself
  const { data: self } = await supabaseAdmin
    .from('activities')
    .select('location_id, location_details, name')
    .eq('id', id)
    .single();

  if (ancestorError) {
    console.error('[effective-location]', ancestorError);
  }

  // Find first location_id in self + ancestors
  const candidates = [self, ...(ancestors ?? [])].filter(Boolean);
  const withLocation = candidates.find((a: any) => a.location_id);

  if (!withLocation?.location_id) {
    // Fall back to location_details text if set
    const locationDetails = candidates.find((a: any) => a.location_details);
    return jsonResponse({ location: locationDetails?.location_details ?? null });
  }

  // Look up the location name
  const { data: loc } = await supabaseAdmin
    .from('locations')
    .select('name')
    .eq('id', withLocation.location_id)
    .single();

  return jsonResponse({ location: loc?.name ?? null, location_id: withLocation.location_id });
});
```

- [ ] **Step 3: Create activity-events stub endpoint**

```typescript
// src/pages/api/admin/kid-activities/[id]/activity-events.ts
import { withAdminAuth, jsonResponse } from '@/lib/api-utils';

export const prerender = false;

// Stub: activity events / schedule management is out of scope for this iteration.
// Returns empty array so the UI shows "No schedule set" instead of 404 errors.
export const GET = withAdminAuth(async () => {
  return jsonResponse({ events: [] });
});
```

- [ ] **Step 4: Verify the 404 errors are gone**

Navigate to `/admin/kid-activities` in the browser. Open DevTools → Network. Reload. Confirm:
- No 404s on `/effective-location` endpoints (should be 200)
- No 404s on `/activity-events` endpoints (should be 200)
- "Error loading location" text changes to "📍 No location set" or a location name

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/admin/kid-activities/\[id\]/effective-location.ts \
        src/pages/api/admin/kid-activities/\[id\]/activity-events.ts
git commit -m "fix(kid-activities): add effective-location + activity-events endpoints to stop 404 storm"
```

---

## Task 4: Wire up JavaScript — modal helpers + edit/create/delete/duplicate

**Files:**
- Modify: `src/pages/admin/kid-activities.astro` — lines **1069–1189** (the `<script>` block)

The existing script ends with:
```javascript
    (window as any).makeApiCall = makeApiCall;
  </script>
```

Replace that final line (keeping everything above it) and add all the new functions before `</script>`.

- [ ] **Step 1: Add showModal / closeModal / selectScheduleType**

Append inside the `<script>` block, before `</script>`:

```javascript
    // ── Modal helpers ──────────────────────────────────────────────────────
    function showModal(modalId: string) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      }
    }

    function closeModal(modalId: string) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
    }

    function resetActivityForm() {
      const form = document.getElementById('activityForm') as HTMLFormElement | null;
      if (form) form.reset();
      (document.getElementById('activityId') as HTMLInputElement).value = '';
      (document.getElementById('parentActivityId') as HTMLInputElement).value = '';
      (document.getElementById('activityHierarchyType') as HTMLInputElement).value = '';
      // Hide all conditional sections
      document.getElementById('sessionInfoSection')?.classList.add('hidden');
      document.getElementById('classInstanceInfoSection')?.classList.add('hidden');
      document.getElementById('standardActivityFields')?.classList.remove('hidden');
    }

    function showSectionsForType(hierarchyType: string) {
      const sessionSection = document.getElementById('sessionInfoSection');
      const instanceSection = document.getElementById('classInstanceInfoSection');
      const standardFields = document.getElementById('standardActivityFields');
      if (hierarchyType === 'SESSION') {
        sessionSection?.classList.remove('hidden');
        instanceSection?.classList.add('hidden');
        standardFields?.classList.add('hidden');
      } else if (hierarchyType === 'CLASS_INSTANCE') {
        sessionSection?.classList.add('hidden');
        instanceSection?.classList.remove('hidden');
        standardFields?.classList.remove('hidden');
      } else {
        // PROGRAM, CLASS_TYPE
        sessionSection?.classList.add('hidden');
        instanceSection?.classList.add('hidden');
        standardFields?.classList.remove('hidden');
      }
    }

    function selectScheduleType(type: string) {
      const recurringBtn = document.getElementById('recurringBtn');
      const oneOffBtn = document.getElementById('oneOffBtn');
      const recurringSection = document.getElementById('recurringSection');
      const oneOffSection = document.getElementById('oneOffSection');
      if (type === 'RECURRING') {
        recurringBtn?.classList.add('border-green-500');
        oneOffBtn?.classList.remove('border-green-500');
        recurringSection?.classList.remove('hidden');
        oneOffSection?.classList.add('hidden');
      } else {
        oneOffBtn?.classList.add('border-green-500');
        recurringBtn?.classList.remove('border-green-500');
        oneOffSection?.classList.remove('hidden');
        recurringSection?.classList.add('hidden');
      }
    }

    (window as any).showModal = showModal;
    (window as any).closeModal = closeModal;
    (window as any).selectScheduleType = selectScheduleType;
```

- [ ] **Step 2: Add editActivity**

```javascript
    // ── CRUD operations ────────────────────────────────────────────────────
    async function editActivity(id: string) {
      try {
        const response = await makeApiCall(`/api/admin/kid-activities/${id}`);
        if (!response) return;
        const { activity } = await response.json();

        resetActivityForm();

        // Populate hidden fields
        (document.getElementById('activityId') as HTMLInputElement).value = activity.id;
        (document.getElementById('parentActivityId') as HTMLInputElement).value = activity.parent_activity_id ?? '';
        (document.getElementById('activityHierarchyType') as HTMLInputElement).value = activity.activity_hierarchy_type;

        // Populate visible fields
        (document.getElementById('activityName') as HTMLInputElement).value = activity.name ?? '';
        (document.getElementById('activityType') as HTMLSelectElement).value = activity.activity_type ?? '';
        (document.getElementById('activityDescription') as HTMLTextAreaElement).value = activity.description ?? '';
        (document.getElementById('locationId') as HTMLSelectElement).value = activity.location_id ?? '';
        (document.getElementById('minAge') as HTMLInputElement).value = activity.min_age ?? '';
        (document.getElementById('maxAge') as HTMLInputElement).value = activity.max_age ?? '';
        (document.getElementById('minGrade') as HTMLInputElement).value = activity.min_grade ?? '';
        (document.getElementById('maxGrade') as HTMLInputElement).value = activity.max_grade ?? '';
        (document.getElementById('cost') as HTMLInputElement).value = activity.cost ?? '';
        (document.getElementById('website') as HTMLInputElement).value = activity.website ?? '';
        (document.getElementById('commitmentLevel') as HTMLSelectElement).value = activity.commitment_level ?? '';
        (document.getElementById('startDatetime') as HTMLInputElement).value = activity.start_datetime?.split('T')[0] ?? '';
        (document.getElementById('endDatetime') as HTMLInputElement).value = activity.end_datetime?.split('T')[0] ?? '';
        (document.getElementById('registrationOpens') as HTMLInputElement).value = activity.registration_opens ?? '';
        (document.getElementById('registrationCloses') as HTMLInputElement).value = activity.registration_closes ?? '';
        (document.getElementById('registrationLink') as HTMLInputElement).value = activity.registration_link ?? '';
        (document.getElementById('registrationInfo') as HTMLTextAreaElement).value = activity.registration_info ?? '';
        (document.getElementById('registrationRequired') as HTMLInputElement).checked = !!activity.registration_required;

        showSectionsForType(activity.activity_hierarchy_type);

        const title = document.getElementById('modalTitle');
        if (title) title.textContent = `Edit ${activity.activity_hierarchy_type.replace('_', ' ')}`;

        showModal('activityModal');
      } catch (err) {
        alert('Failed to load activity: ' + (err as Error).message);
      }
    }

    (window as any).editActivity = editActivity;
```

- [ ] **Step 3: Add createChildActivity**

```javascript
    async function createChildActivity(parentId: string, hierarchyType: string) {
      resetActivityForm();
      (document.getElementById('parentActivityId') as HTMLInputElement).value = parentId;
      (document.getElementById('activityHierarchyType') as HTMLInputElement).value = hierarchyType;

      showSectionsForType(hierarchyType);

      const title = document.getElementById('modalTitle');
      if (title) title.textContent = `Add ${hierarchyType.replace('_', ' ')}`;

      showModal('activityModal');
    }

    (window as any).createChildActivity = createChildActivity;
```

- [ ] **Step 4: Add deleteActivity**

```javascript
    async function deleteActivity(id: string) {
      if (!confirm('Delete this activity and all its children? This cannot be undone.')) return;
      try {
        await makeApiCall(`/api/admin/kid-activities/${id}`, { method: 'DELETE' });
        window.location.reload();
      } catch (err) {
        alert('Failed to delete: ' + (err as Error).message);
      }
    }

    (window as any).deleteActivity = deleteActivity;
```

- [ ] **Step 5: Add duplicateActivity**

```javascript
    async function duplicateActivity(id: string) {
      if (!confirm('Duplicate this activity?')) return;
      try {
        const getRes = await makeApiCall(`/api/admin/kid-activities/${id}`);
        if (!getRes) return;
        const { activity } = await getRes.json();

        const { id: _id, created_at, updated_at, ...rest } = activity;
        rest.name = `${rest.name} (copy)`;
        rest.status = 'pending';

        await makeApiCall('/api/admin/kid-activities', {
          method: 'POST',
          body: JSON.stringify(rest),
        });
        window.location.reload();
      } catch (err) {
        alert('Failed to duplicate: ' + (err as Error).message);
      }
    }

    (window as any).duplicateActivity = duplicateActivity;
```

- [ ] **Step 6: Add form submit handler**

```javascript
    // ── Form submission ────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
      const form = document.getElementById('activityForm') as HTMLFormElement | null;
      if (!form) return;

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = (document.getElementById('activityId') as HTMLInputElement).value;
        const isEdit = !!id;

        const formData = new FormData(form);
        const body: Record<string, unknown> = {};
        for (const [key, value] of formData.entries()) {
          if (key === 'registration_required') {
            body[key] = true; // checkbox — only present if checked
          } else {
            body[key] = value === '' ? null : value;
          }
        }
        // registration_required defaults to false if checkbox absent
        if (!body.registration_required) body.registration_required = false;

        try {
          if (isEdit) {
            await makeApiCall(`/api/admin/kid-activities/${id}`, {
              method: 'PUT',
              body: JSON.stringify(body),
            });
          } else {
            await makeApiCall('/api/admin/kid-activities', {
              method: 'POST',
              body: JSON.stringify(body),
            });
          }
          closeModal('activityModal');
          window.location.reload();
        } catch (err) {
          alert('Failed to save: ' + (err as Error).message);
        }
      });
    });
```

- [ ] **Step 7: Add stubs for out-of-scope functions**

```javascript
    // ── Stubs for out-of-scope features ────────────────────────────────────
    function manageMeetingPatterns(id: string) {
      alert('Meeting patterns management coming soon. Activity ID: ' + id);
    }
    function manageEvents(id: string) {
      alert('Event management coming soon. Activity ID: ' + id);
    }
    function exportCalendar(id: string) {
      alert('Calendar export coming soon. Activity ID: ' + id);
    }
    function bulkMigrateCalendarData() { alert('Bulk migrate coming soon.'); }
    function bulkCreateSessions() { alert('Bulk create sessions coming soon.'); }
    function exportCalendarData() { alert('Export calendar data coming soon.'); }
    function bulkDuplicatePrograms() { alert('Bulk duplicate coming soon.'); }

    function scrollToSession(id: string) {
      document.getElementById(`session-${id}`)?.scrollIntoView({ behavior: 'smooth' });
    }
    function scrollToClassType(id: string) {
      document.getElementById(`classtype-${id}`)?.scrollIntoView({ behavior: 'smooth' });
    }
    function scrollToClassInstance(id: string) {
      document.getElementById(`instance-${id}`)?.scrollIntoView({ behavior: 'smooth' });
    }

    (window as any).manageMeetingPatterns = manageMeetingPatterns;
    (window as any).manageEvents = manageEvents;
    (window as any).exportCalendar = exportCalendar;
    (window as any).bulkMigrateCalendarData = bulkMigrateCalendarData;
    (window as any).bulkCreateSessions = bulkCreateSessions;
    (window as any).exportCalendarData = exportCalendarData;
    (window as any).bulkDuplicatePrograms = bulkDuplicatePrograms;
    (window as any).scrollToSession = scrollToSession;
    (window as any).scrollToClassType = scrollToClassType;
    (window as any).scrollToClassInstance = scrollToClassInstance;
```

- [ ] **Step 8: Keep the existing makeApiCall window export, verify no duplicate**

The original script ends with `(window as any).makeApiCall = makeApiCall;`. Keep that line. It should appear before your new additions are inserted. If you see it duplicated, remove the duplicate.

- [ ] **Step 9: Verify in browser**

Navigate to `/admin/kid-activities`. Confirm:
- "Error loading location" is replaced with "📍 No location set" or a real name
- Clicking Edit on any program opens the modal pre-filled with that program's data
- Clicking Cancel in the modal closes it
- Clicking "Add Session" on a program opens a blank modal pre-set to SESSION type
- Clicking Delete shows a confirmation dialog
- No `ReferenceError` in the console

- [ ] **Step 10: Commit**

```bash
git add src/pages/admin/kid-activities.astro
git commit -m "feat(kid-activities): wire up all CRUD JS functions — edit, create child, delete, duplicate, form submit, modal helpers"
```

---

## Task 5: Clean up the AI-imported flat programs

The AI import created every camp week as a separate top-level PROGRAM. The correct structure is:
`Organization` → `PROGRAM` (the camp) → `SESSION` (each week) → `CLASS_INSTANCE` (time slots if needed).

With the CRUD working from Tasks 1–4, the admin can now manually fix this. But to make it easier, add a simple "bulk delete pending" action.

**Files:**
- Modify: `src/pages/api/admin/kid-activities.ts` — add DELETE handler

- [ ] **Step 1: Add DELETE handler (bulk delete by status)**

Add to `src/pages/api/admin/kid-activities.ts`:

```typescript
export const DELETE = withAdminAuth(async ({ url }) => {
  const status = url.searchParams.get('status');
  if (!status) return jsonError('status query param required', 400);

  const { error } = await supabaseAdmin
    .from('activities')
    .delete()
    .eq('status', status);

  if (error) {
    console.error('[kid-activities bulk DELETE]', error);
    return jsonError(`Failed to bulk delete: ${error.message}`, 500);
  }
  return jsonResponse({ ok: true });
});
```

- [ ] **Step 2: Add "Delete all pending" button to kid-activities.astro**

In the Quick Actions section (around line 129 near `showModal('activityModal')`), add a new button after the existing ones:

```html
<button
  onclick="bulkDeletePending()"
  class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
>
  🗑️ Delete All Pending (AI drafts)
</button>
```

- [ ] **Step 3: Add bulkDeletePending JS function** (replace the stub from Task 4)

```javascript
    async function bulkDeletePending() {
      const count = document.querySelectorAll('[data-status="pending"]').length;
      if (!confirm(`Delete ALL ${count || 'pending'} activities with status=pending? This clears AI-imported drafts so you can start fresh.`)) return;
      try {
        await makeApiCall('/api/admin/kid-activities?status=pending', { method: 'DELETE' });
        window.location.reload();
      } catch (err) {
        alert('Failed: ' + (err as Error).message);
      }
    }
    (window as any).bulkDeletePending = bulkDeletePending;
```

Note: For `data-status` to work, each activity card in the HTML needs `data-status={activity.status}`. Find the program card div (around line 170 in kid-activities.astro) and add that attribute. Look for the div with class names like `border rounded-lg p-4` for each program and add `data-status={program.status}`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/admin/kid-activities.ts src/pages/admin/kid-activities.astro
git commit -m "feat(kid-activities): add bulk delete pending + Delete All Pending button to clear AI drafts"
```

---

## Task 6: Push and verify end-to-end

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

- [ ] **Step 2: Smoke test on production (dertown.org/admin/kid-activities)**

Check:
1. No console 404 errors on page load
2. "Error loading location" → "📍 No location set" on all cards
3. Edit button opens pre-filled modal
4. Save updates the activity (page reloads with changes)
5. "Add Session" on a program creates a new SESSION child under it
6. Delete confirms and removes the record
7. "Delete All Pending" button visible and functional for cleanup

---

## What this plan does NOT cover (future tasks)

- **Meeting patterns** — recurring schedule setup (RRULE generation, weekly day/time selection)
- **Activity events** — the `activity_events` table join/management
- **Export calendar** — iCal/CSV export
- **Bulk create sessions** — create multiple sessions from a template
- **Public families/camps page** — activities showing on `/families/camps` (currently works from DB; just needs data entered)
- **Changing Layout** — kid-activities uses `Layout` (public), not `AdminLayout`. Consider switching to `AdminLayout` for consistency (out of scope here but worth noting)
