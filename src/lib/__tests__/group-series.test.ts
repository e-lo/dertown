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

const NEW_PARENT_FIELDS = {
  title: 'x',
  primary_tag_id: TAG,
  description: null,
  secondary_tag_id: null,
  location_id: null,
  organization_id: null,
  website: null,
  external_image_url: null,
  cost: null,
};

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
    check(
      'rejects empty children',
      parseGroupSeriesRequest({ children: [], parent: { id: ID_1 } }),
      {
        ok: false,
        error: 'Select at least one event to group',
      }
    ) && allTestsPassed;

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
    check('new fields not an existing ref', isExistingParentRef(NEW_PARENT_FIELDS), false) &&
    allTestsPassed;

  // --- findChildEligibilityError ---

  const superAdmin = { isSuperAdmin: true, organizationIds: [] as string[] };
  const orgEditor = { isSuperAdmin: false, organizationIds: [ORG] };

  allTestsPassed =
    check(
      'eligible rows → null',
      findChildEligibilityError([row(), row({ id: ID_2 })], superAdmin),
      null
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'non-pending row rejected',
      findChildEligibilityError([row({ status: 'approved' })], superAdmin),
      {
        status: 400,
        message: '"Book Sale Day 1" is not pending and cannot be grouped',
      }
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'existing parent rejected',
      findChildEligibilityError([row({ hasChildren: true })], superAdmin),
      {
        status: 400,
        message: '"Book Sale Day 1" is already a series parent',
      }
    ) && allTestsPassed;

  allTestsPassed =
    check('org editor allowed for own org', findChildEligibilityError([row()], orgEditor), null) &&
    allTestsPassed;

  allTestsPassed =
    check(
      'org editor rejected for other org',
      findChildEligibilityError([row({ organization_id: ID_2 })], orgEditor),
      {
        status: 403,
        message: '"Book Sale Day 1" belongs to an organization you cannot edit',
      }
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'org editor rejected for missing org',
      findChildEligibilityError([row({ organization_id: null })], orgEditor),
      {
        status: 403,
        message: '"Book Sale Day 1" belongs to an organization you cannot edit',
      }
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
      {
        start_date: '2026-10-01',
        end_date: '2026-10-03',
      }
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
