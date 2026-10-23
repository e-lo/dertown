import { issueWindows, nextSendDate, sendDateKey } from '../newsletter/dates';

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
  console.log('🧪 Testing newsletter dates\n');
  let allTestsPassed = true;

  allTestsPassed =
    check(
      'wednesday morning targets the same-week thursday',
      nextSendDate(new Date('2026-10-28T16:00:00Z')).toISOString(),
      '2026-10-29T19:00:00.000Z'
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'thursday 11:30 PT is under an hour away, so next week',
      nextSendDate(new Date('2026-10-29T18:30:00Z')).toISOString(),
      '2026-11-05T20:00:00.000Z'
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'thursday 10:59 PT still targets today',
      nextSendDate(new Date('2026-10-29T17:59:00Z')).toISOString(),
      '2026-10-29T19:00:00.000Z'
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'after DST ends, noon PT is 20:00Z',
      nextSendDate(new Date('2026-11-02T18:00:00Z')).toISOString(),
      '2026-11-05T20:00:00.000Z'
    ) && allTestsPassed;
  allTestsPassed =
    check('send date key is the pacific date', sendDateKey(new Date('2026-10-29T19:00:00Z')), '2026-10-29') &&
    allTestsPassed;
  allTestsPassed =
    check('issue windows', issueWindows(new Date('2026-10-29T19:00:00Z')), {
      thisWeek: { start: '2026-10-30', end: '2026-11-05' },
      planAhead: { start: '2026-11-12', end: '2026-12-10' },
    }) && allTestsPassed;

  return allTestsPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
export { runTests };
