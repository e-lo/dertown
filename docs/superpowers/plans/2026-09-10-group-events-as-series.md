# Group Pending Events as a Series Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin check one or more pending events in the Approve Events queue and link them under a new or existing series parent in one action.

**Architecture:** A pure module (`src/lib/group-series.ts`) validates the request and derives the parent date range; a new admin route (`/api/admin/events/group-series`) loads the selected rows, creates or validates the parent, and links each child (direct FK for `events` rows, comment marker for `events_staged` rows). The dashboard gets a checkbox column plus a selection bar, and a new modal component whose client logic lives in `src/lib/admin/group-series-modal.ts`. The copy-pasted parent-marker helpers are consolidated into `src/lib/series-parent-marker.ts` first.

**Tech Stack:** Astro SSR routes on Netlify, Supabase (`supabaseAdmin` service client), plain TS client scripts, `tsx` script tests under `src/lib/__tests__/`, ESLint.

**Spec:** `docs/superpowers/specs/2026-09-10-group-events-as-series-design.md`

**Deviation from spec:** the client module is named `src/lib/admin/group-series-modal.ts` (not `group-series.ts`) so it does not share a basename with the pure route-logic module `src/lib/group-series.ts`.

**Verification notes:** the dev server does not run in the sandbox. Each task ends with `npm run lint` plus the relevant `tsx` test; the final task runs `npm run build`. Live verification happens on prod after push, per the deploy-and-verify memory.

---

## File map

| File | Responsibility |
|---|---|
| `src/lib/series-parent-marker.ts` (create) | Build, extract, strip, apply the `[SCRAPER_APPROVED_PARENT_ID:…]` comment marker. |
| `src/lib/__tests__/series-parent-marker.test.ts` (create) | Tests for the marker helper. |
| `src/pages/api/admin/events-staged/approve.ts` (modify) | Import marker helper; delete local copy. |
| `src/pages/api/admin/events-staged/edit.ts` (modify) | Import marker helper; delete local copy. |
| `src/pages/api/admin/events-staged.ts` (modify) | Import marker helper; delete local copy. |
| `src/lib/scraper/staged.ts` (modify) | Import marker builder; delete local copy. |
| `src/lib/group-series.ts` (create) | Pure request parsing, child eligibility, parent date range. |
| `src/lib/__tests__/group-series.test.ts` (create) | Tests for the pure module. |
| `src/pages/api/admin/events/group-series.ts` (create) | The route: load rows, resolve parent, link children. |
| `src/lib/admin/group-series-modal.ts` (create) | Client: selection state, selection bar, modal open/prefill/submit. |
| `src/components/ui/GroupSeriesModal.astro` (create) | Modal markup plus the processed `<script>` that boots the client module. |
| `src/pages/admin.astro` (modify) | Mount the modal, add the selection bar container, checkbox column, and two custom-event hooks. |
| `package.json` (modify) | Two new `test:*` scripts. |

---

### Task 1: Marker helper module with tests

**Files:**
- Create: `src/lib/series-parent-marker.ts`
- Create: `src/lib/__tests__/series-parent-marker.test.ts`
- Modify: `package.json` (scripts block)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/series-parent-marker.test.ts`:

```ts
import {
  applyApprovedParentMarker,
  buildApprovedParentMarker,
  extractApprovedParentId,
  stripApprovedParentMarker,
} from '../series-parent-marker';

const PARENT_A = '11111111-1111-4111-8111-111111111111';
const PARENT_B = '22222222-2222-4222-8222-222222222222';

function check(name: string, actual: unknown, expected: unknown): boolean {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    pass
      ? `✅ PASS: ${name}\n`
      : `❌ FAIL: ${name}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}\n`
  );
  return pass;
}

function runTests(): boolean {
  console.log('🧪 Testing series-parent-marker\n');
  let allTestsPassed = true;

  allTestsPassed =
    check('build', buildApprovedParentMarker(PARENT_A), `[SCRAPER_APPROVED_PARENT_ID:${PARENT_A}]`) &&
    allTestsPassed;

  allTestsPassed =
    check('extract from null', extractApprovedParentId(null), null) && allTestsPassed;
  allTestsPassed =
    check('extract from plain comments', extractApprovedParentId('Source: library'), null) &&
    allTestsPassed;
  allTestsPassed =
    check(
      'extract finds marker after notes',
      extractApprovedParentId(`Source: library\n[SCRAPER_APPROVED_PARENT_ID:${PARENT_A}]`),
      PARENT_A
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'extract is case-insensitive on hex',
      extractApprovedParentId(`[scraper_approved_parent_id:${PARENT_A.toUpperCase()}]`),
      PARENT_A.toUpperCase()
    ) && allTestsPassed;

  allTestsPassed =
    check('strip null → null', stripApprovedParentMarker(null), null) && allTestsPassed;
  allTestsPassed =
    check(
      'strip removes marker and trims',
      stripApprovedParentMarker(`Source: library\n[SCRAPER_APPROVED_PARENT_ID:${PARENT_A}]\n`),
      'Source: library'
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'strip on marker-only comments → null',
      stripApprovedParentMarker(`[SCRAPER_APPROVED_PARENT_ID:${PARENT_A}]`),
      null
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'apply to empty comments',
      applyApprovedParentMarker('', PARENT_A),
      `[SCRAPER_APPROVED_PARENT_ID:${PARENT_A}]`
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'apply appends after notes',
      applyApprovedParentMarker('Source: library', PARENT_A),
      `Source: library\n[SCRAPER_APPROVED_PARENT_ID:${PARENT_A}]`
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'apply replaces an existing marker',
      applyApprovedParentMarker(
        `Source: library\n[SCRAPER_APPROVED_PARENT_ID:${PARENT_A}]`,
        PARENT_B
      ),
      `Source: library\n[SCRAPER_APPROVED_PARENT_ID:${PARENT_B}]`
    ) && allTestsPassed;

  return allTestsPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
export { runTests };
```

- [ ] **Step 2: Add the npm script and run the test to verify it fails**

In `package.json`, after the line `"test:scraper-ical-timezone": ...,` add:

```json
    "test:series-marker": "tsx src/lib/__tests__/series-parent-marker.test.ts",
    "test:group-series": "tsx src/lib/__tests__/group-series.test.ts",
```

Run: `npm run test:series-marker`
Expected: FAIL with `Cannot find module '../series-parent-marker'`

- [ ] **Step 3: Write the helper**

Create `src/lib/series-parent-marker.ts`:

```ts
/**
 * Staged events cannot hold a foreign key to an approved parent (events_staged.parent_event_id
 * only references events_staged). The link is carried in `comments` as a marker until approval,
 * when the staged approve route turns it into a real parent_event_id.
 */
const MARKER_SOURCE = '\\[SCRAPER_APPROVED_PARENT_ID:([0-9a-f-]{36})\\]';

export function buildApprovedParentMarker(parentId: string): string {
  return `[SCRAPER_APPROVED_PARENT_ID:${parentId}]`;
}

export function extractApprovedParentId(comments: string | null | undefined): string | null {
  if (!comments) return null;
  const match = new RegExp(MARKER_SOURCE, 'i').exec(comments);
  return match?.[1] ?? null;
}

export function stripApprovedParentMarker(comments: string | null | undefined): string | null {
  const cleaned = (comments || '').replace(new RegExp(MARKER_SOURCE, 'gi'), '').trim();
  return cleaned || null;
}

export function applyApprovedParentMarker(
  comments: string | null | undefined,
  parentId: string
): string {
  const cleaned = stripApprovedParentMarker(comments);
  const marker = buildApprovedParentMarker(parentId);
  return cleaned ? `${cleaned}\n${marker}` : marker;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:series-marker`
Expected: every line `✅ PASS`, exit code 0.

- [ ] **Step 5: Lint and commit**

Run: `npm run lint`
Expected: no errors (warnings are acceptable; the repo already has `no-explicit-any` warnings).

```bash
git add src/lib/series-parent-marker.ts src/lib/__tests__/series-parent-marker.test.ts package.json
git commit -m "refactor(events): extract series parent marker helper with tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Replace the four copies of the marker logic

**Files:**
- Modify: `src/pages/api/admin/events-staged/approve.ts:1-23,66-75,148-152`
- Modify: `src/pages/api/admin/events-staged/edit.ts:1-19`
- Modify: `src/pages/api/admin/events-staged.ts:1-13`
- Modify: `src/lib/scraper/staged.ts:33-36`

- [ ] **Step 1: approve.ts**

Replace the top of the file (imports through `applyApprovedParentMarker`, lines 1–23) with:

```ts
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import {
  applyApprovedParentMarker,
  extractApprovedParentId,
  stripApprovedParentMarker,
} from '@/lib/series-parent-marker';

export const prerender = false;
```

Replace `const markedApprovedParentId = extractScraperApprovedParentId(stagedEvent.comments);` with:

```ts
    const markedApprovedParentId = extractApprovedParentId(stagedEvent.comments);
```

Replace the three-line `cleanedComments` block:

```ts
  const cleanedComments = (stagedEvent.comments || '')
    .replace(SCRAPER_APPROVED_PARENT_ID_REGEX, '')
    .trim() || null;
```

with:

```ts
  const cleanedComments = stripApprovedParentMarker(stagedEvent.comments);
```

- [ ] **Step 2: edit.ts**

Replace lines 1–19 (imports, `prerender`, regex, both local functions) with:

```ts
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import {
  applyApprovedParentMarker,
  stripApprovedParentMarker,
} from '@/lib/series-parent-marker';

export const prerender = false;
```

No other change; the call sites already use the same names.

- [ ] **Step 3: events-staged.ts**

Replace lines 1–13 (imports through the local `extractApprovedParentId`) with:

```ts
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import { findEventDuplicateHint } from '@/lib/event-duplicate';
import { extractApprovedParentId } from '@/lib/series-parent-marker';

export const prerender = false;
```

- [ ] **Step 4: scraper/staged.ts**

Delete these lines:

```ts
const SCRAPER_APPROVED_PARENT_ID_PREFIX = '[SCRAPER_APPROVED_PARENT_ID:';

function buildApprovedParentMarker(parentId: string): string {
  return `${SCRAPER_APPROVED_PARENT_ID_PREFIX}${parentId}]`;
}
```

Add to the import block at the top of the file:

```ts
import { buildApprovedParentMarker } from '../series-parent-marker';
```

(The scraper module uses relative imports; check the existing import lines and match their style.)

- [ ] **Step 5: Verify nothing else references the removed names**

Run: `grep -rn "SCRAPER_APPROVED_PARENT_ID_REGEX\|SCRAPER_APPROVED_PARENT_ID_PREFIX\|extractScraperApprovedParentId\|APPROVED_PARENT_MARKER_REGEX" src/pages src/lib/scraper`
Expected: no output. (`src/pages/admin.astro` keeps its own client-side copy of the regex; it runs in the browser and is out of scope.)

- [ ] **Step 6: Lint, test, commit**

Run: `npm run lint && npm run test:series-marker`
Expected: lint clean, tests pass.

```bash
git add src/pages/api/admin/events-staged/approve.ts src/pages/api/admin/events-staged/edit.ts src/pages/api/admin/events-staged.ts src/lib/scraper/staged.ts
git commit -m "refactor(events): use shared series parent marker helper

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Pure group-series logic with tests

**Files:**
- Create: `src/lib/group-series.ts`
- Create: `src/lib/__tests__/group-series.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/group-series.test.ts`:

```ts
import {
  deriveParentDateRange,
  findChildEligibilityError,
  isExistingParentRef,
  parseGroupSeriesRequest,
  type ChildRow,
} from '../group-series';

const ID_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TAG = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ORG = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function check(name: string, actual: unknown, expected: unknown): boolean {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    pass
      ? `✅ PASS: ${name}\n`
      : `❌ FAIL: ${name}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}\n`
  );
  return pass;
}

function row(overrides: Partial<ChildRow> = {}): ChildRow {
  return {
    id: ID_1,
    table: 'events_staged',
    title: 'Book Sale Day 1',
    status: 'pending',
    organization_id: ORG,
    start_date: '2026-10-01',
    comments: null,
    hasChildren: false,
    ...overrides,
  };
}

function runTests(): boolean {
  console.log('🧪 Testing group-series\n');
  let allTestsPassed = true;

  // --- parseGroupSeriesRequest ---

  allTestsPassed =
    check('rejects non-object body', parseGroupSeriesRequest('nope'), {
      ok: false,
      error: 'Request body must be an object',
    }) && allTestsPassed;

  allTestsPassed =
    check('rejects empty children', parseGroupSeriesRequest({ children: [], parent: { id: ID_1 } }), {
      ok: false,
      error: 'Select at least one event to group',
    }) && allTestsPassed;

  allTestsPassed =
    check(
      'rejects bad child table',
      parseGroupSeriesRequest({ children: [{ id: ID_1, table: 'users' }], parent: { id: ID_2 } }),
      { ok: false, error: 'Each child table must be "events" or "events_staged"' }
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'rejects bad child id',
      parseGroupSeriesRequest({ children: [{ id: 'x', table: 'events' }], parent: { id: ID_2 } }),
      { ok: false, error: 'Each child needs a valid id' }
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'accepts existing parent and dedupes children',
      parseGroupSeriesRequest({
        children: [
          { id: ID_1, table: 'events_staged' },
          { id: ID_1, table: 'events_staged' },
          { id: ID_2, table: 'events' },
        ],
        parent: { id: ID_2 },
      }),
      {
        ok: true,
        request: {
          children: [
            { id: ID_1, table: 'events_staged' },
            { id: ID_2, table: 'events' },
          ],
          parent: { id: ID_2 },
        },
      }
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'new parent requires title',
      parseGroupSeriesRequest({
        children: [{ id: ID_1, table: 'events_staged' }],
        parent: { title: '  ', primary_tag_id: TAG },
      }),
      { ok: false, error: 'Parent title is required' }
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'new parent requires primary tag',
      parseGroupSeriesRequest({
        children: [{ id: ID_1, table: 'events_staged' }],
        parent: { title: 'Book Sale' },
      }),
      { ok: false, error: 'Parent primary tag is required' }
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'new parent normalizes blanks to null and trims',
      parseGroupSeriesRequest({
        children: [{ id: ID_1, table: 'events_staged' }],
        parent: {
          title: ' Book Sale ',
          primary_tag_id: TAG,
          description: '',
          website: ' https://library.org ',
          cost: undefined,
        },
      }),
      {
        ok: true,
        request: {
          children: [{ id: ID_1, table: 'events_staged' }],
          parent: {
            title: 'Book Sale',
            primary_tag_id: TAG,
            description: null,
            secondary_tag_id: null,
            location_id: null,
            organization_id: null,
            website: 'https://library.org',
            external_image_url: null,
            cost: null,
          },
        },
      }
    ) && allTestsPassed;

  // --- isExistingParentRef ---

  allTestsPassed =
    check('existing ref detected', isExistingParentRef({ id: ID_1 }), true) && allTestsPassed;
  allTestsPassed =
    check(
      'new fields not an existing ref',
      isExistingParentRef({
        title: 'x',
        primary_tag_id: TAG,
        description: null,
        secondary_tag_id: null,
        location_id: null,
        organization_id: null,
        website: null,
        external_image_url: null,
        cost: null,
      }),
      false
    ) && allTestsPassed;

  // --- findChildEligibilityError ---

  const superAdmin = { isSuperAdmin: true, organizationIds: [] as string[] };
  const orgEditor = { isSuperAdmin: false, organizationIds: [ORG] };

  allTestsPassed =
    check('eligible rows → null', findChildEligibilityError([row(), row({ id: ID_2 })], superAdmin), null) &&
    allTestsPassed;

  allTestsPassed =
    check(
      'non-pending row rejected',
      findChildEligibilityError([row({ status: 'approved' })], superAdmin),
      { status: 400, message: '"Book Sale Day 1" is not pending and cannot be grouped' }
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'existing parent rejected',
      findChildEligibilityError([row({ hasChildren: true })], superAdmin),
      { status: 400, message: '"Book Sale Day 1" is already a series parent' }
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'org editor allowed for own org',
      findChildEligibilityError([row()], orgEditor),
      null
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'org editor rejected for other org',
      findChildEligibilityError([row({ organization_id: ID_2 })], orgEditor),
      { status: 403, message: '"Book Sale Day 1" belongs to an organization you cannot edit' }
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'org editor rejected for missing org',
      findChildEligibilityError([row({ organization_id: null })], orgEditor),
      { status: 403, message: '"Book Sale Day 1" belongs to an organization you cannot edit' }
    ) && allTestsPassed;

  // --- deriveParentDateRange ---

  allTestsPassed =
    check('single date → no end', deriveParentDateRange(['2026-10-01']), {
      start_date: '2026-10-01',
      end_date: null,
    }) && allTestsPassed;

  allTestsPassed =
    check(
      'unordered dates → min/max',
      deriveParentDateRange(['2026-10-03', '2026-10-01', '2026-10-02']),
      { start_date: '2026-10-01', end_date: '2026-10-03' }
    ) && allTestsPassed;

  allTestsPassed =
    check('same date twice → no end', deriveParentDateRange(['2026-10-01', '2026-10-01']), {
      start_date: '2026-10-01',
      end_date: null,
    }) && allTestsPassed;

  try {
    deriveParentDateRange([]);
    console.log('❌ FAIL: empty dates should throw\n');
    allTestsPassed = false;
  } catch {
    console.log('✅ PASS: empty dates throw\n');
  }

  return allTestsPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
export { runTests };
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:group-series`
Expected: FAIL with `Cannot find module '../group-series'`

- [ ] **Step 3: Write the module**

Create `src/lib/group-series.ts`:

```ts
/**
 * Pure logic for the "group pending events as a series" admin action.
 * Kept free of Supabase so it can be tested with plain tsx scripts.
 */

export type ChildTable = 'events' | 'events_staged';

export interface ChildRef {
  id: string;
  table: ChildTable;
}

export interface ExistingParentRef {
  id: string;
}

export interface NewParentFields {
  title: string;
  primary_tag_id: string;
  description: string | null;
  secondary_tag_id: string | null;
  location_id: string | null;
  organization_id: string | null;
  website: string | null;
  external_image_url: string | null;
  cost: string | null;
}

export type ParentSpec = ExistingParentRef | NewParentFields;

export interface GroupSeriesRequest {
  children: ChildRef[];
  parent: ParentSpec;
}

export type ParseResult =
  | { ok: true; request: GroupSeriesRequest }
  | { ok: false; error: string };

/** A selected child as loaded from its table, plus whether anything already points at it. */
export interface ChildRow {
  id: string;
  table: ChildTable;
  title: string;
  status: string | null;
  organization_id: string | null;
  start_date: string;
  comments: string | null;
  hasChildren: boolean;
}

export interface OrgScope {
  isSuperAdmin: boolean;
  organizationIds: string[];
}

export interface EligibilityError {
  status: 400 | 403;
  message: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function optionalUuid(value: unknown): string | null {
  return isUuid(value) ? value : null;
}

export function isExistingParentRef(parent: ParentSpec): parent is ExistingParentRef {
  return 'id' in parent;
}

export function parseGroupSeriesRequest(body: unknown): ParseResult {
  if (!isRecord(body)) return { ok: false, error: 'Request body must be an object' };

  const { children, parent } = body;
  if (!Array.isArray(children) || children.length === 0) {
    return { ok: false, error: 'Select at least one event to group' };
  }

  const parsedChildren: ChildRef[] = [];
  const seen = new Set<string>();
  for (const child of children) {
    if (!isRecord(child) || !isUuid(child.id)) {
      return { ok: false, error: 'Each child needs a valid id' };
    }
    if (child.table !== 'events' && child.table !== 'events_staged') {
      return { ok: false, error: 'Each child table must be "events" or "events_staged"' };
    }
    const key = `${child.table}:${child.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parsedChildren.push({ id: child.id, table: child.table });
  }

  if (!isRecord(parent)) return { ok: false, error: 'Parent is required' };

  if ('id' in parent) {
    if (!isUuid(parent.id)) return { ok: false, error: 'Parent id is not a valid id' };
    return { ok: true, request: { children: parsedChildren, parent: { id: parent.id } } };
  }

  const title = optionalText(parent.title);
  if (!title) return { ok: false, error: 'Parent title is required' };
  if (!isUuid(parent.primary_tag_id)) {
    return { ok: false, error: 'Parent primary tag is required' };
  }

  const fields: NewParentFields = {
    title,
    primary_tag_id: parent.primary_tag_id,
    description: optionalText(parent.description),
    secondary_tag_id: optionalUuid(parent.secondary_tag_id),
    location_id: optionalUuid(parent.location_id),
    organization_id: optionalUuid(parent.organization_id),
    website: optionalText(parent.website),
    external_image_url: optionalText(parent.external_image_url),
    cost: optionalText(parent.cost),
  };
  return { ok: true, request: { children: parsedChildren, parent: fields } };
}

export function findChildEligibilityError(
  rows: ChildRow[],
  scope: OrgScope
): EligibilityError | null {
  for (const row of rows) {
    if (row.status !== 'pending') {
      return { status: 400, message: `"${row.title}" is not pending and cannot be grouped` };
    }
    if (row.hasChildren) {
      return { status: 400, message: `"${row.title}" is already a series parent` };
    }
    const inScope =
      scope.isSuperAdmin ||
      (row.organization_id !== null && scope.organizationIds.includes(row.organization_id));
    if (!inScope) {
      return {
        status: 403,
        message: `"${row.title}" belongs to an organization you cannot edit`,
      };
    }
  }
  return null;
}

/** ISO dates sort correctly as strings, so min/max is a plain sort. */
export function deriveParentDateRange(startDates: string[]): {
  start_date: string;
  end_date: string | null;
} {
  const sorted = startDates.filter(Boolean).sort();
  if (sorted.length === 0) throw new Error('deriveParentDateRange needs at least one date');
  const start_date = sorted[0];
  const last = sorted[sorted.length - 1];
  return { start_date, end_date: last !== start_date ? last : null };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:group-series`
Expected: every line `✅ PASS`, exit 0.

- [ ] **Step 5: Lint and commit**

Run: `npm run lint`

```bash
git add src/lib/group-series.ts src/lib/__tests__/group-series.test.ts
git commit -m "feat(events): pure validation and date-range logic for grouping events as a series

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The group-series API route

**Files:**
- Create: `src/pages/api/admin/events/group-series.ts`

- [ ] **Step 1: Write the route**

```ts
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import { applyApprovedParentMarker } from '@/lib/series-parent-marker';
import {
  deriveParentDateRange,
  findChildEligibilityError,
  isExistingParentRef,
  parseGroupSeriesRequest,
  type ChildRef,
  type ChildRow,
  type ChildTable,
} from '@/lib/group-series';

export const prerender = false;

const CHILD_COLUMNS = 'id, title, status, organization_id, start_date, comments';

type LoadResult = { rows: ChildRow[] } | { missingId: string };

/** Load every selected child from its own table and note which are already parents. */
async function loadChildRows(refs: ChildRef[]): Promise<LoadResult> {
  const idsByTable: Record<ChildTable, string[]> = { events: [], events_staged: [] };
  for (const ref of refs) idsByTable[ref.table].push(ref.id);

  const rows: ChildRow[] = [];
  for (const table of ['events', 'events_staged'] as const) {
    const ids = idsByTable[table];
    if (ids.length === 0) continue;

    const [{ data, error }, { data: dependents, error: dependentsError }] = await Promise.all([
      supabaseAdmin.from(table).select(CHILD_COLUMNS).in('id', ids),
      supabaseAdmin.from(table).select('parent_event_id').in('parent_event_id', ids),
    ]);
    if (error) throw new Error(error.message);
    if (dependentsError) throw new Error(dependentsError.message);

    const alreadyParents = new Set((dependents || []).map((d) => d.parent_event_id));
    const byId = new Map((data || []).map((r) => [r.id, r]));
    for (const id of ids) {
      const row = byId.get(id);
      if (!row) return { missingId: id };
      rows.push({
        id: row.id,
        table,
        title: row.title,
        status: row.status,
        organization_id: row.organization_id,
        start_date: row.start_date,
        comments: row.comments,
        hasChildren: alreadyParents.has(id),
      });
    }
  }
  return { rows };
}

function inOrgScope(
  auth: { isSuperAdmin: boolean; organizationIds: string[] },
  organizationId: string | null
): boolean {
  return auth.isSuperAdmin || (!!organizationId && auth.organizationIds.includes(organizationId));
}

export const POST = withAdminAuth(async ({ request, auth }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON in request body', 400);
  }

  const parsed = parseGroupSeriesRequest(body);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const { children, parent } = parsed.request;

  let rows: ChildRow[];
  try {
    const loaded = await loadChildRows(children);
    if ('missingId' in loaded) return jsonError(`Event ${loaded.missingId} was not found`, 404);
    rows = loaded.rows;
  } catch (error) {
    console.error('[GROUP SERIES] Failed to load selected events:', error);
    return jsonError('Failed to load selected events');
  }

  const eligibility = findChildEligibilityError(rows, auth);
  if (eligibility) return jsonError(eligibility.message, eligibility.status);

  let parentId: string;
  let parentTitle: string;

  if (isExistingParentRef(parent)) {
    const { data: existing, error } = await supabaseAdmin
      .from('events')
      .select('id, title, organization_id')
      .eq('id', parent.id)
      .eq('status', 'approved')
      .is('parent_event_id', null)
      .maybeSingle();
    if (error) {
      console.error('[GROUP SERIES] Failed to load parent:', error);
      return jsonError('Failed to load parent event');
    }
    if (!existing) return jsonError('Parent must be an approved top-level event', 400);
    if (!inOrgScope(auth, existing.organization_id)) {
      return jsonError('Forbidden: parent belongs to another organization', 403);
    }
    parentId = existing.id;
    parentTitle = existing.title;
  } else {
    if (!inOrgScope(auth, parent.organization_id)) {
      return jsonError('Forbidden: cannot create a parent for this organization', 403);
    }
    const range = deriveParentDateRange(rows.map((r) => r.start_date));
    const { data: created, error } = await supabaseAdmin
      .from('events')
      .insert({
        ...parent,
        ...range,
        status: 'approved',
        exclude_from_calendar: true,
      })
      .select('id, title')
      .single();
    if (error || !created) {
      console.error('[GROUP SERIES] Failed to create parent:', error);
      return jsonError('Failed to create parent event');
    }
    parentId = created.id;
    parentTitle = created.title;
  }

  const linked: string[] = [];
  const failed: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { error } =
      row.table === 'events'
        ? await supabaseAdmin.from('events').update({ parent_event_id: parentId }).eq('id', row.id)
        : await supabaseAdmin
            .from('events_staged')
            .update({
              parent_event_id: null,
              comments: applyApprovedParentMarker(row.comments, parentId),
            })
            .eq('id', row.id);
    if (error) {
      console.error(`[GROUP SERIES] Failed to link ${row.table} ${row.id}:`, error);
      failed.push(...rows.slice(i).map((r) => r.id));
      break;
    }
    linked.push(row.id);
  }

  const parentSummary = { id: parentId, title: parentTitle };
  if (failed.length > 0) {
    return jsonResponse(
      {
        error: `Linked ${linked.length} of ${rows.length} events; the rest failed. Select the remaining events and choose this parent as an existing parent to retry.`,
        parent: parentSummary,
        linked: linked.length,
        failed,
      },
      500
    );
  }

  return jsonResponse({ parent: parentSummary, linked: linked.length });
});
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean. If ESLint or the editor reports a type error on `supabaseAdmin.from(table)` because `table` is a union, split `loadChildRows` into one call per table literal (`supabaseAdmin.from('events')` and `supabaseAdmin.from('events_staged')`) sharing the same mapping code via a local function that takes the already-fetched `data` and `dependents`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/admin/events/group-series.ts
git commit -m "feat(events): admin route to group pending events under a series parent

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Client module for selection and the modal

**Files:**
- Create: `src/lib/admin/group-series-modal.ts`

The module owns: the selection set (fed by checkboxes the dashboard renders), the selection bar, opening and prefilling the modal, reference-data loading, and submit. It talks to the dashboard only through DOM data attributes and two custom events:

- Dashboard → module: `document` event `group-series:queue-rendered` after the queue table is (re)rendered.
- Module → dashboard: `window` event `group-series:done` with `detail: { parentTitle, linked }` after a successful submit.

- [ ] **Step 1: Write the module**

```ts
/**
 * Client logic for "Group as series" in the admin Approve Events queue.
 *
 * The dashboard renders one `.group-series-checkbox` per selectable row with
 * data-group-id / data-group-table / data-group-title / data-group-date attributes,
 * and dispatches `group-series:queue-rendered` on document after each render.
 * This module keeps the selection, renders the selection bar into #group-series-bar,
 * and drives #groupSeriesModal. On success it dispatches `group-series:done` on window.
 */

type ChildTable = 'events' | 'events_staged';

interface SelectedChild {
  id: string;
  table: ChildTable;
  title: string;
  date: string;
}

interface NamedRef {
  id: string;
  name: string;
}

interface ParentOption {
  id: string;
  title: string;
  start_date?: string | null;
  parent_source?: string;
}

interface ReferenceData {
  tags: NamedRef[];
  locations: NamedRef[];
  organizations: NamedRef[];
  parents: ParentOption[];
}

interface QueueEventDetails {
  description?: string | null;
  primary_tag_id?: string | null;
  secondary_tag_id?: string | null;
  location_id?: string | null;
  organization_id?: string | null;
  website?: string | null;
  external_image_url?: string | null;
  cost?: string | null;
  location?: { name?: string } | null;
  organization?: { name?: string } | null;
}

const selection = new Map<string, SelectedChild>();
let referenceData: ReferenceData | null = null;

function keyFor(table: string, id: string): string {
  return `${table}:${id}`;
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Selection + bar
// ---------------------------------------------------------------------------

function renderBar(): void {
  const bar = document.getElementById('group-series-bar');
  if (!bar) return;
  const count = selection.size;
  if (count === 0) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }
  bar.classList.remove('hidden');
  bar.innerHTML =
    `<span>${count} selected</span>` +
    '<button type="button" id="groupSeriesOpen" class="btn-save" style="margin-left:0.75rem;">Group as series</button>' +
    '<button type="button" id="groupSeriesClear" class="btn-cancel" style="margin-left:0.5rem;">Clear</button>';
  byId('groupSeriesOpen').addEventListener('click', openModal);
  byId('groupSeriesClear').addEventListener('click', clearSelection);
}

function clearSelection(): void {
  selection.clear();
  document
    .querySelectorAll<HTMLInputElement>('.group-series-checkbox')
    .forEach((box) => (box.checked = false));
  renderBar();
}

function onCheckboxChange(event: Event): void {
  const box = event.target;
  if (!(box instanceof HTMLInputElement) || !box.classList.contains('group-series-checkbox')) return;
  const { groupId, groupTable, groupTitle, groupDate } = box.dataset;
  if (!groupId || (groupTable !== 'events' && groupTable !== 'events_staged')) return;
  const key = keyFor(groupTable, groupId);
  if (box.checked) {
    selection.set(key, { id: groupId, table: groupTable, title: groupTitle || '', date: groupDate || '' });
  } else {
    selection.delete(key);
  }
  renderBar();
}

/** After the queue re-renders, re-check surviving rows and drop selections that vanished. */
function onQueueRendered(): void {
  const present = new Set<string>();
  document.querySelectorAll<HTMLInputElement>('.group-series-checkbox').forEach((box) => {
    const key = keyFor(box.dataset.groupTable || '', box.dataset.groupId || '');
    present.add(key);
    box.checked = selection.has(key);
  });
  for (const key of [...selection.keys()]) {
    if (!present.has(key)) selection.delete(key);
  }
  renderBar();
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return (await res.json()) as T;
}

async function loadReferenceData(): Promise<ReferenceData> {
  if (referenceData) return referenceData;
  const [tags, locations, organizations, parents] = await Promise.all([
    fetchJson<NamedRef[]>('/api/admin/tags'),
    fetchJson<NamedRef[]>('/api/admin/locations'),
    fetchJson<NamedRef[]>('/api/admin/organizations'),
    fetchJson<ParentOption[]>('/api/admin/parent-events'),
  ]);
  referenceData = {
    tags,
    locations,
    organizations,
    parents: parents.filter((p) => p.parent_source === 'events'),
  };
  return referenceData;
}

function fillSelect(select: HTMLSelectElement, items: NamedRef[], placeholder: string): void {
  select.innerHTML = `<option value="">${placeholder}</option>`;
  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    select.appendChild(option);
  }
}

function fillDatalist(list: HTMLDataListElement, values: string[]): void {
  list.innerHTML = '';
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    list.appendChild(option);
  }
}

function parentLabel(p: ParentOption): string {
  return p.start_date ? `${p.title} (${p.start_date})` : p.title;
}

function populateReferenceInputs(data: ReferenceData): void {
  fillSelect(byId<HTMLSelectElement>('groupSeriesPrimaryTag'), data.tags, 'Select primary tag…');
  fillSelect(byId<HTMLSelectElement>('groupSeriesSecondaryTag'), data.tags, 'None');
  fillDatalist(byId<HTMLDataListElement>('groupSeriesLocationOptions'), data.locations.map((l) => l.name));
  fillDatalist(
    byId<HTMLDataListElement>('groupSeriesOrganizationOptions'),
    data.organizations.map((o) => o.name)
  );
  fillDatalist(byId<HTMLDataListElement>('groupSeriesParentOptions'), data.parents.map(parentLabel));
}

function lookupIdByName(items: NamedRef[], typed: string): string | null {
  const needle = typed.trim().toLowerCase();
  if (!needle) return null;
  return items.find((item) => item.name.trim().toLowerCase() === needle)?.id ?? null;
}

function lookupParentId(parents: ParentOption[], typed: string): string | null {
  const needle = typed.trim().toLowerCase();
  if (!needle) return null;
  return parents.find((p) => parentLabel(p).toLowerCase() === needle)?.id ?? null;
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

function earliestSelected(): SelectedChild | null {
  const items = [...selection.values()].sort((a, b) => a.date.localeCompare(b.date));
  return items[0] ?? null;
}

async function fetchQueueEventDetails(child: SelectedChild): Promise<QueueEventDetails> {
  if (child.table === 'events') {
    const data = await fetchJson<{ event?: QueueEventDetails }>(`/api/admin/events/${child.id}`);
    return data.event ?? {};
  }
  const data = await fetchJson<{ events?: Array<QueueEventDetails & { id: string }> }>(
    '/api/admin/events-staged'
  );
  return data.events?.find((e) => e.id === child.id) ?? {};
}

function setParentMode(mode: 'new' | 'existing'): void {
  byId('groupSeriesNewFields').classList.toggle('hidden', mode !== 'new');
  byId('groupSeriesExistingFields').classList.toggle('hidden', mode !== 'existing');
}

function showError(message: string | null): void {
  const el = byId('groupSeriesError');
  el.textContent = message || '';
  el.classList.toggle('hidden', !message);
}

function renderChildrenList(): void {
  const items = [...selection.values()].sort((a, b) => a.date.localeCompare(b.date));
  byId('groupSeriesChildren').innerHTML = items
    .map(
      (c) =>
        `<li>${escapeHtml(c.title)} <span class="text-gray-500">${escapeHtml(c.date)}</span>` +
        ` <span class="text-gray-400 italic">(${c.table === 'events_staged' ? 'staged' : 'pending'})</span></li>`
    )
    .join('');
}

async function prefillFromEarliest(data: ReferenceData): Promise<void> {
  const first = earliestSelected();
  if (!first) return;
  byId<HTMLInputElement>('groupSeriesTitle').value = first.title;
  let details: QueueEventDetails = {};
  try {
    details = await fetchQueueEventDetails(first);
  } catch (error) {
    console.error('[group-series] could not load event details for prefill:', error);
  }
  byId<HTMLTextAreaElement>('groupSeriesDescription').value = details.description || '';
  byId<HTMLSelectElement>('groupSeriesPrimaryTag').value = details.primary_tag_id || '';
  byId<HTMLSelectElement>('groupSeriesSecondaryTag').value = details.secondary_tag_id || '';
  byId<HTMLInputElement>('groupSeriesWebsite').value = details.website || '';
  byId<HTMLInputElement>('groupSeriesImageUrl').value = details.external_image_url || '';
  byId<HTMLInputElement>('groupSeriesCost').value = details.cost || '';
  const locationName =
    details.location?.name ||
    data.locations.find((l) => l.id === details.location_id)?.name ||
    '';
  const orgName =
    details.organization?.name ||
    data.organizations.find((o) => o.id === details.organization_id)?.name ||
    '';
  byId<HTMLInputElement>('groupSeriesLocation').value = locationName;
  byId<HTMLInputElement>('groupSeriesOrganization').value = orgName;
}

async function openModal(): Promise<void> {
  if (selection.size === 0) return;
  const modal = byId('groupSeriesModal');
  showError(null);
  byId<HTMLFormElement>('groupSeriesForm').reset();
  byId<HTMLInputElement>('groupSeriesModeNew').checked = true;
  setParentMode('new');
  renderChildrenList();
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    const data = await loadReferenceData();
    populateReferenceInputs(data);
    await prefillFromEarliest(data);
  } catch (error) {
    showError('Could not load reference data: ' + (error instanceof Error ? error.message : String(error)));
  }
}

function closeModal(): void {
  const modal = byId('groupSeriesModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function buildParentPayload(data: ReferenceData): Record<string, unknown> | { error: string } {
  const mode = byId<HTMLInputElement>('groupSeriesModeExisting').checked ? 'existing' : 'new';
  if (mode === 'existing') {
    const typed = byId<HTMLInputElement>('groupSeriesExistingParent').value;
    const id = lookupParentId(data.parents, typed);
    if (!id) return { error: 'Pick an existing parent from the list' };
    return { id };
  }
  const title = byId<HTMLInputElement>('groupSeriesTitle').value.trim();
  if (!title) return { error: 'Parent title is required' };
  const primaryTagId = byId<HTMLSelectElement>('groupSeriesPrimaryTag').value;
  if (!primaryTagId) return { error: 'Primary tag is required' };
  const locationTyped = byId<HTMLInputElement>('groupSeriesLocation').value;
  const orgTyped = byId<HTMLInputElement>('groupSeriesOrganization').value;
  const locationId = lookupIdByName(data.locations, locationTyped);
  const organizationId = lookupIdByName(data.organizations, orgTyped);
  if (locationTyped.trim() && !locationId) {
    return { error: 'Location must match an existing location (or leave it blank)' };
  }
  if (orgTyped.trim() && !organizationId) {
    return { error: 'Organization must match an existing organization (or leave it blank)' };
  }
  return {
    title,
    primary_tag_id: primaryTagId,
    secondary_tag_id: byId<HTMLSelectElement>('groupSeriesSecondaryTag').value || null,
    description: byId<HTMLTextAreaElement>('groupSeriesDescription').value,
    location_id: locationId,
    organization_id: organizationId,
    website: byId<HTMLInputElement>('groupSeriesWebsite').value,
    external_image_url: byId<HTMLInputElement>('groupSeriesImageUrl').value,
    cost: byId<HTMLInputElement>('groupSeriesCost').value,
  };
}

async function onSubmit(event: Event): Promise<void> {
  event.preventDefault();
  showError(null);
  const submit = byId<HTMLButtonElement>('groupSeriesSubmit');
  const data = referenceData;
  if (!data) {
    showError('Reference data is still loading; try again in a moment');
    return;
  }
  const parent = buildParentPayload(data);
  if ('error' in parent) {
    showError(parent.error);
    return;
  }
  const children = [...selection.values()].map((c) => ({ id: c.id, table: c.table }));

  submit.disabled = true;
  try {
    const res = await fetch('/api/admin/events/group-series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ children, parent }),
    });
    const result = (await res.json().catch(() => ({}))) as {
      error?: string;
      parent?: { title: string };
      linked?: number;
    };
    if (!res.ok) {
      showError(result.error || `Request failed (${res.status})`);
      return;
    }
    closeModal();
    clearSelection();
    window.dispatchEvent(
      new CustomEvent('group-series:done', {
        detail: { parentTitle: result.parent?.title || '', linked: result.linked || 0 },
      })
    );
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Request failed');
  } finally {
    submit.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

export function initGroupSeries(): void {
  document.addEventListener('change', onCheckboxChange);
  document.addEventListener('group-series:queue-rendered', onQueueRendered);
  byId('groupSeriesForm').addEventListener('submit', onSubmit);
  byId('groupSeriesClose').addEventListener('click', closeModal);
  byId('groupSeriesCancel').addEventListener('click', closeModal);
  byId('groupSeriesModeNew').addEventListener('change', () => setParentMode('new'));
  byId('groupSeriesModeExisting').addEventListener('change', () => setParentMode('existing'));
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/group-series-modal.ts
git commit -m "feat(admin): client module for grouping queue events as a series

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Modal component

**Files:**
- Create: `src/components/ui/GroupSeriesModal.astro`

- [ ] **Step 1: Write the component**

Element ids must match Task 5 exactly.

```astro
---
// Modal for grouping selected pending events under a series parent.
// Client logic: src/lib/admin/group-series-modal.ts
---

<div id="groupSeriesModal" class="modal-overlay hidden">
  <div class="modal-container" style="max-width: 640px;">
    <div class="modal-header">
      <h3 class="modal-title">Group as Series</h3>
      <button type="button" id="groupSeriesClose" class="modal-close-btn" aria-label="Close modal">
        <span class="material-symbols-outlined text-2xl">close</span>
      </button>
    </div>
    <form id="groupSeriesForm">
      <div class="form-field">
        <label class="form-label">Series parent</label>
        <div style="display: flex; gap: 1rem;">
          <label><input type="radio" name="groupSeriesParentMode" id="groupSeriesModeNew" value="new" checked /> Create new parent</label>
          <label><input type="radio" name="groupSeriesParentMode" id="groupSeriesModeExisting" value="existing" /> Use existing parent</label>
        </div>
      </div>

      <div id="groupSeriesExistingFields" class="hidden">
        <div class="form-field">
          <label class="form-label" for="groupSeriesExistingParent">Existing parent: <span class="form-label-required">*</span></label>
          <input type="text" id="groupSeriesExistingParent" list="groupSeriesParentOptions" class="form-input-base" placeholder="Start typing a series title…" autocomplete="off" />
          <datalist id="groupSeriesParentOptions"></datalist>
        </div>
      </div>

      <div id="groupSeriesNewFields">
        <p class="text-sm text-gray-500 mb-2">Prefilled from the earliest selected event. The parent is created approved and hidden from the calendar; its dates span the selected events.</p>
        <div class="form-field">
          <label class="form-label" for="groupSeriesTitle">Title: <span class="form-label-required">*</span></label>
          <input type="text" id="groupSeriesTitle" class="form-input-base" />
        </div>
        <div class="form-field">
          <label class="form-label" for="groupSeriesDescription">Description:</label>
          <textarea id="groupSeriesDescription" rows="3" class="form-input-base"></textarea>
        </div>
        <div class="form-field">
          <label class="form-label" for="groupSeriesPrimaryTag">Primary tag: <span class="form-label-required">*</span></label>
          <select id="groupSeriesPrimaryTag" class="form-input-base"></select>
        </div>
        <div class="form-field">
          <label class="form-label" for="groupSeriesSecondaryTag">Secondary tag:</label>
          <select id="groupSeriesSecondaryTag" class="form-input-base"></select>
        </div>
        <div class="form-field">
          <label class="form-label" for="groupSeriesLocation">Location:</label>
          <input type="text" id="groupSeriesLocation" list="groupSeriesLocationOptions" class="form-input-base" autocomplete="off" />
          <datalist id="groupSeriesLocationOptions"></datalist>
        </div>
        <div class="form-field">
          <label class="form-label" for="groupSeriesOrganization">Organization:</label>
          <input type="text" id="groupSeriesOrganization" list="groupSeriesOrganizationOptions" class="form-input-base" autocomplete="off" />
          <datalist id="groupSeriesOrganizationOptions"></datalist>
        </div>
        <div class="form-field">
          <label class="form-label" for="groupSeriesWebsite">Website:</label>
          <input type="text" id="groupSeriesWebsite" class="form-input-base" />
        </div>
        <div class="form-field">
          <label class="form-label" for="groupSeriesImageUrl">External image URL:</label>
          <input type="text" id="groupSeriesImageUrl" class="form-input-base" />
        </div>
        <div class="form-field">
          <label class="form-label" for="groupSeriesCost">Cost:</label>
          <input type="text" id="groupSeriesCost" class="form-input-base" />
        </div>
      </div>

      <div class="form-field">
        <label class="form-label">Events to group</label>
        <ul id="groupSeriesChildren" class="text-sm" style="margin: 0; padding-left: 1.25rem;"></ul>
        <p class="text-sm text-gray-500 mt-1">Children stay in the queue. Edit and approve each one as usual after grouping.</p>
      </div>

      <p id="groupSeriesError" class="text-red-600 text-sm hidden"></p>

      <div class="form-actions" style="display: flex; justify-content: flex-end; gap: 0.5rem;">
        <button type="button" id="groupSeriesCancel" class="btn-cancel">Cancel</button>
        <button type="submit" id="groupSeriesSubmit" class="btn-save">Group events</button>
      </div>
    </form>
  </div>
</div>

<script>
  import { initGroupSeries } from '../../lib/admin/group-series-modal';
  initGroupSeries();
</script>
```

- [ ] **Step 2: Lint and commit**

Run: `npm run lint`

```bash
git add src/components/ui/GroupSeriesModal.astro
git commit -m "feat(admin): group-as-series modal component

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Wire the dashboard

**Files:**
- Modify: `src/pages/admin.astro` (frontmatter imports ~line 8, modal mount ~line 56, Approve Events section ~line 184, `loadEventsToApprove` ~line 970, `displayEvents` ~lines 1317–1395)

- [ ] **Step 1: Import and mount the modal**

After `import SeriesModal from '../components/ui/SeriesModal.astro';` add:

```astro
import GroupSeriesModal from '../components/ui/GroupSeriesModal.astro';
```

After the line `    <SeriesModal />` add:

```astro
    <GroupSeriesModal />
```

- [ ] **Step 2: Add the selection bar container**

In the Approve Events section, replace:

```html
    <div id="loading" class="loading">Loading events...</div>
    <div id="events-container" class="dashboard-table-container"></div>
```

with:

```html
    <div id="loading" class="loading">Loading events...</div>
    <div id="group-series-bar" class="hidden" style="display:flex;align-items:center;gap:0.25rem;padding:0.5rem 0.75rem;margin-bottom:0.5rem;background:#eff6ff;border:1px solid #bfdbfe;border-radius:0.375rem;font-size:0.875rem;"></div>
    <div id="events-container" class="dashboard-table-container"></div>
```

Note: `.hidden` in this project's admin CSS sets `display:none !important`, which overrides the inline `display:flex` while hidden. Verify with: `grep -n "\.hidden" src/styles/*.css src/components/AdminLayout.astro | head`. If `.hidden` is not `!important`, drop the inline `display:flex` and add `display:flex` via a `style` attribute in `renderBar()` instead.

- [ ] **Step 3: Add the checkbox column in `displayEvents`**

Only the Approve Events queue gets checkboxes. Inside `displayEvents`, right after the `if (events.length === 0) {...}` block, add:

```js
      const selectable = containerId === 'events-container';
      const escapeAttr = (value) =>
        String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;');
```

In the `<thead>` string, before `'<th>Title</th>' +` add:

```js
        (selectable ? '<th style="width:2rem;"></th>' : '') +
```

In the row template, replace:

```js
              '<tr>' +
              '<td>' + (event.title || 'N/A') + titleBadge + calendarHiddenBadge + '</td>' +
```

with:

```js
              '<tr>' +
              (selectable
                ? '<td style="text-align:center;">' +
                  (event.is_series_parent
                    ? '<input type="checkbox" disabled title="Already a series parent">'
                    : '<input type="checkbox" class="group-series-checkbox"' +
                      ' data-group-id="' + event.id + '"' +
                      ' data-group-table="' + (eventIsStaged ? 'events_staged' : 'events') + '"' +
                      ' data-group-title="' + escapeAttr(event.title) + '"' +
                      ' data-group-date="' + escapeAttr(event.start_date) + '"' +
                      ' aria-label="Select for grouping">') +
                  '</td>'
                : '') +
              '<td>' + (event.title || 'N/A') + titleBadge + calendarHiddenBadge + '</td>' +
```

- [ ] **Step 4: Notify the module after render, and react to completion**

In `loadEventsToApprove`, replace:

```js
      _cachedEvents = allEvents;
      displayEvents(allEvents);
```

with:

```js
      _cachedEvents = allEvents;
      displayEvents(allEvents);
      document.dispatchEvent(new CustomEvent('group-series:queue-rendered'));
```

Also find the `events.length === 0` early return inside `displayEvents` — the dispatch above still fires after it, which is correct (the module prunes its selection when no checkboxes exist).

Directly after the `loadEventsToApprove` function definition (after its closing `}`), add:

```js
  window.addEventListener('group-series:done', (event) => {
    const { parentTitle, linked } = event.detail || {};
    showMessage(
      `Grouped ${linked} event${linked === 1 ? '' : 's'} under "${parentTitle}". Approve the children when ready.`,
      'success'
    );
    loadEventsToApprove();
  });
```

- [ ] **Step 5: Lint and build**

Run: `npm run lint`
Expected: clean.

Run: `npm run build`
Expected: build completes; the output includes a bundled client script for `group-series-modal`. If the build fails with the known `prerender` Tailwind error, confirm no new `prerender = true` was introduced; this feature only adds `prerender = false` routes.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin.astro
git commit -m "feat(admin): select queue events and group them as a series

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Final verification and handoff

- [ ] **Step 1: Run every relevant test**

Run: `npm run test:series-marker && npm run test:group-series && npm run lint`
Expected: all pass.

- [ ] **Step 2: Confirm the working tree only contains this feature**

Run: `git status --short`
Expected: only pre-existing unrelated modifications (mobile, kid-activities, dormant-tables migration) remain unstaged; nothing from this feature is uncommitted.

- [ ] **Step 3: Production checklist (after the user pushes; the sandbox cannot run the dev server)**

1. Open `/admin`. In Approve Events, check three drafts of a multi-day event. The blue bar shows "3 selected".
2. Click "Group as series". Title, tags, location, org prefill from the earliest draft. Edit the title, submit.
3. The queue reloads; each draft shows a "child of: …" badge. The success message names the parent.
4. Check a single draft, choose "Use existing parent", pick the parent just created. It links.
5. Edit one child, approve all children. Open the public event page for one child: the series list shows its siblings.
6. Confirm the parent at `/admin/events/<id>` has "Exclude from calendar" on and start/end dates spanning the children.
