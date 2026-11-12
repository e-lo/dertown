import { monthsUntilSignup, nextSignupMonthName, signupGroup, signupHint } from '../sports-signup';

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`✅ PASS: ${label}`);
  } else {
    console.log(`❌ FAIL: ${label}`);
    failures++;
  }
}

console.log('🧪 Testing sports-signup\n');

const NOV = 11;
const winter = { is_winter: true };
const fall = { is_fall: true };
const spring = { is_spring: true };
const fallSpring = { is_fall: true, is_spring: true };
const yearRound = { is_ongoing: true };
const none = {};

// In November: winter signups (Oct–Dec) are open, spring (Jan–Mar) opens in 2 months
check('winter is "now" in Nov', signupGroup(winter, NOV, false) === 'now');
check('spring is "soon" in Nov', signupGroup(spring, NOV, false) === 'soon');
check('fall is "later" in Nov (opens May)', signupGroup(fall, NOV, false) === 'later');
check('fall+spring takes the nearest window', monthsUntilSignup(fallSpring, NOV) === 2);
check('year-round is "anytime"', signupGroup(yearRound, NOV, false) === 'anytime');
check('no season is "unknown"', signupGroup(none, NOV, false) === 'unknown');
check('real open registration wins', signupGroup(fall, NOV, true) === 'now');

// Window edges
check('fall window includes May', monthsUntilSignup(fall, 5) === 0);
check('fall window includes Sep', monthsUntilSignup(fall, 9) === 0);
check('fall closed in Oct, 7 months to May', monthsUntilSignup(fall, 10) === 7);
check('winter wraps: Jan → 9 months to Oct', monthsUntilSignup(winter, 1) === 9);
check('spring in Dec opens next month', monthsUntilSignup(spring, 12) === 1);

check('next month name for spring in Nov', nextSignupMonthName(spring, NOV) === 'January');
check('no next month name when open', nextSignupMonthName(winter, NOV) === null);
check('hint text', signupHint(fallSpring) === 'Signups usually: Spring Jan–Mar · Fall May–Sep');
check('no hint for year-round only', signupHint(yearRound) === null);
check('summer hint is just May', signupHint({ is_summer: true }) === 'Signups usually: Summer May');
check('summer opens in May (Nov → 6 months)', monthsUntilSignup({ is_summer: true }, NOV) === 6);
check('summer is "now" in May', signupGroup({ is_summer: true }, 5, false) === 'now');

if (failures > 0) {
  console.log(`\n❌ ${failures} test(s) failed`);
  process.exit(1);
}
console.log('\n✅ All sports-signup tests passed');
