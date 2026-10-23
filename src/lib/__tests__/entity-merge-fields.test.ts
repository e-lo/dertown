import { MERGE_SPECS, buildMergedValues, defaultChoice } from '../entity-merge-fields';

const PRIMARY_ID = '11111111-1111-4111-8111-111111111111';
const SECONDARY_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';

const location = MERGE_SPECS.location;
const organization = MERGE_SPECS.organization;
const coordinates = location.fields.find((f) => f.key === 'coordinates')!;
const address = location.fields.find((f) => f.key === 'address')!;

const primaryLoc = {
  id: PRIMARY_ID,
  name: 'Festhalle',
  address: null,
  phone: '555-1111',
  website: '',
  latitude: null,
  longitude: null,
  parent_location_id: null,
};
const secondaryLoc = {
  id: SECONDARY_ID,
  name: 'Leavenworth Festhalle',
  address: '1001 Front St',
  phone: '555-2222',
  website: 'https://festhalle.example',
  latitude: 47.59,
  longitude: -120.66,
  parent_location_id: OTHER_ID,
};

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
  console.log('🧪 Testing entity-merge-fields\n');
  let allTestsPassed = true;

  allTestsPassed =
    check(
      'default keeps primary when both have a value',
      defaultChoice(location.fields[0], primaryLoc, secondaryLoc),
      'primary'
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'default picks secondary when primary is empty',
      defaultChoice(address, primaryLoc, secondaryLoc),
      'secondary'
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'map pin is empty only when both columns are',
      defaultChoice(coordinates, primaryLoc, secondaryLoc),
      'secondary'
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'no choices keeps every primary value',
      buildMergedValues(location, primaryLoc, secondaryLoc, {}),
      {
        name: 'Festhalle',
        address: null,
        phone: '555-1111',
        website: '',
        latitude: null,
        longitude: null,
        parent_location_id: null,
      }
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'choosing secondary map pin moves latitude and longitude together',
      buildMergedValues(location, primaryLoc, secondaryLoc, {
        coordinates: 'secondary',
        address: 'secondary',
      }),
      {
        name: 'Festhalle',
        address: '1001 Front St',
        phone: '555-1111',
        website: '',
        latitude: 47.59,
        longitude: -120.66,
        parent_location_id: null,
      }
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'parent pointing at the secondary is cleared',
      buildMergedValues(
        location,
        { ...primaryLoc, parent_location_id: SECONDARY_ID },
        secondaryLoc,
        {}
      ).parent_location_id,
      null
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'chosen parent pointing at the primary is cleared',
      buildMergedValues(
        location,
        primaryLoc,
        { ...secondaryLoc, parent_location_id: PRIMARY_ID },
        { parent_location_id: 'secondary' }
      ).parent_location_id,
      null
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'unrelated parent from secondary is kept',
      buildMergedValues(location, primaryLoc, secondaryLoc, { parent_location_id: 'secondary' })
        .parent_location_id,
      OTHER_ID
    ) && allTestsPassed;

  allTestsPassed =
    check(
      'organization merge only writes organization columns',
      Object.keys(
        buildMergedValues(
          organization,
          { id: PRIMARY_ID, name: 'A' },
          { id: SECONDARY_ID, name: 'B' },
          { name: 'secondary' }
        )
      ),
      ['name', 'description', 'email', 'phone', 'website', 'location_id', 'parent_organization_id']
    ) && allTestsPassed;

  return allTestsPassed;
}

if (!runTests()) {
  process.exit(1);
}
