import { inheritParentFields, type InheritableFields } from '../newsletter/inherit-parent';

function check(name: string, actual: unknown, expected: unknown): boolean {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    pass
      ? `✅ PASS: ${name}\n`
      : `❌ FAIL: ${name}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}\n`
  );
  return pass;
}

type Row = InheritableFields & { id: string; parent_event_id: string | null };

const blank: InheritableFields = {
  description: null,
  external_image_url: null,
  image_alt_text: null,
  cost: null,
  location_id: null,
};

const parent: InheritableFields = {
  description: 'Parent description',
  external_image_url: 'https://example.com/parent.jpg',
  image_alt_text: 'Parent alt',
  cost: '$10',
  location_id: 'loc-parent',
};

function runTests(): boolean {
  console.log('🧪 Testing newsletter parent-field inheritance\n');
  const parents = new Map([['p1', parent]]);
  let allTestsPassed = true;

  const [child] = inheritParentFields<Row>(
    [{ ...blank, id: 'c1', parent_event_id: 'p1', description: '  ' }],
    parents
  );
  allTestsPassed =
    check('blank child fields come from the parent', child, {
      ...parent,
      id: 'c1',
      parent_event_id: 'p1',
    }) && allTestsPassed;

  const [own] = inheritParentFields<Row>(
    [
      {
        id: 'c2',
        parent_event_id: 'p1',
        description: 'Own description',
        external_image_url: 'https://example.com/own.jpg',
        image_alt_text: null,
        cost: 'Free',
        location_id: 'loc-own',
      },
    ],
    parents
  );
  allTestsPassed =
    check(
      'child values win',
      [own.description, own.cost, own.location_id],
      ['Own description', 'Free', 'loc-own']
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'image is a unit: own image keeps its own (missing) alt text',
      [own.external_image_url, own.image_alt_text],
      ['https://example.com/own.jpg', null]
    ) && allTestsPassed;

  const [orphan] = inheritParentFields<Row>(
    [{ ...blank, id: 'c3', parent_event_id: 'missing' }],
    parents
  );
  allTestsPassed =
    check('unknown parent leaves the row alone', orphan.description, null) && allTestsPassed;

  const [standalone] = inheritParentFields<Row>(
    [{ ...blank, id: 'c4', parent_event_id: null }],
    parents
  );
  allTestsPassed =
    check('row without a parent is unchanged', standalone.location_id, null) && allTestsPassed;

  return allTestsPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
export { runTests };
