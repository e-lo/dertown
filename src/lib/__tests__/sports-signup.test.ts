import { describeSignup, type SignupFacts } from '../sports-signup';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`✅ PASS: ${label}`);
  } else {
    console.log(
      `❌ FAIL: ${label}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}`
    );
    failures++;
  }
}

console.log('🧪 Testing sports-signup\n');

const NOV_20 = new Date(2026, 10, 20);
const JAN_15 = new Date(2027, 0, 15);
const none: SignupFacts = { openLabel: null, windows: [] };
const dated = (...windows: [string | null, string | null][]): SignupFacts => ({
  openLabel: null,
  windows: windows.map(([opens, closes]) => ({ opens, closes })),
});

// Sign up now: only when registration is actually open
const open = describeSignup({ is_winter: true }, NOV_20, {
  ...none,
  openLabel: 'Registration open · closes Jan 31',
});
check('open registration → now', open.group, 'now');
check('open registration pill', open.pill, 'Registration open · closes Jan 31');

// Real dates from a past cycle repeat next year
const basketball = describeSignup({ is_winter: true }, NOV_20, dated(['2026-09-01', '2026-10-31']));
check('basketball (closed Oct, winter not started) → later', basketball.group, 'later');
check('basketball pill', basketball.pill, 'Signups usually open September');
check('basketball strip', basketball.months, [9, 10]);

const hockey = describeSignup(
  { is_fall: true, is_winter: true },
  NOV_20,
  dated(['2026-08-01', '2026-11-02'])
);
check('hockey (closed, in season) → happening', hockey.group, 'happening');
check('hockey pill', hockey.pill, 'In season · next signups August');

const soccer = describeSignup(
  { is_fall: true, is_spring: true },
  NOV_20,
  dated(['2026-01-01', '2026-02-28'], ['2026-03-01', '2026-06-30'])
);
check('soccer (last Jan 1) → soon', soccer.group, 'soon');
check('soccer pill is an estimate', soccer.pill, 'Usually opens Jan 1');
check('soccer strip', soccer.months, [1, 2, 3, 4, 5, 6]);

const confirmed = describeSignup({ is_winter: true }, NOV_20, dated(['2026-12-15', null]));
check('confirmed upcoming date → soon', confirmed.group, 'soon');
check('confirmed upcoming pill', confirmed.pill, 'Opens Dec 15');

// No dates: fall back to the usual season windows, without claiming "open"
const alpine = describeSignup({ is_winter: true }, NOV_20, none);
check('no dates, usual window now → soon', alpine.group, 'soon');
check('no dates, usual window pill', alpine.pill, 'Usually open Oct–Dec · check with the team');
check('winter strip', alpine.months, [10, 11, 12]);

const lacrosse = describeSignup({ is_spring: true }, NOV_20, none);
check('spring in Nov → soon', lacrosse.group, 'soon');
check('spring pill', lacrosse.pill, 'Usually opens January');

const swim = describeSignup({ is_summer: true }, NOV_20, none);
check('summer in Nov → later', swim.group, 'later');
check('summer pill', swim.pill, 'Signups usually open May');

const fallOnly = describeSignup({ is_fall: true }, NOV_20, none);
check('fall team in Nov → happening', fallOnly.group, 'happening');

const winterInJan = describeSignup({ is_winter: true }, JAN_15, none);
check('winter team in Jan → happening', winterInJan.group, 'happening');
check('winter in Jan pill', winterInJan.pill, 'In season · next signups October');

// Year-round and unknown
const gym = describeSignup({ is_ongoing: true }, NOV_20, dated(['2025-06-23', null]));
check('year-round → happening', gym.group, 'happening');
check('year-round pill', gym.pill, 'Join anytime');

const unknown = describeSignup({}, NOV_20, none);
check('no season, no dates → later', unknown.group, 'later');
check('unknown pill', unknown.pill, 'Check with the organization');

// Sorting within a group: sooner signups first
check('soccer sorts before lacrosse', soccer.sortKey < lacrosse.sortKey, true);

if (failures > 0) {
  console.log(`\n❌ ${failures} test(s) failed`);
  process.exit(1);
}
console.log('\n✅ All sports-signup tests passed');
