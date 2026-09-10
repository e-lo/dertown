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
    check(
      'build',
      buildApprovedParentMarker(PARENT_A),
      `[SCRAPER_APPROVED_PARENT_ID:${PARENT_A}]`
    ) && allTestsPassed;

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
