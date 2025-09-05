// scripts/validate_timezone.mjs
import {
  createUTCDateTime,
  formatDateForGoogleUTC,
  formatDateForOutlookUTC,
  formatDateForICal,
  formatDateForICalUTC,
} from '../src/lib/calendar-utils.ts';

console.log('--- Timezone Validation Test ---');

// 1. Define our test event data (7:00 PM Pacific Time)
const eventData = {
  start_date: '2025-09-06',
  start_time: '19:00:00', // 7:00 PM
};
console.log(`\n[INPUT] Pacific Time: ${eventData.start_date} ${eventData.start_time}`);

// 2. Create the initial JavaScript Date object.
const dateObject = createUTCDateTime(eventData.start_date, eventData.start_time);
console.log(`\n[STEP 1] Created JS Date object representing the correct moment in time.`);
console.log(`         - As ISO String: ${dateObject.toISOString()}`);
console.log(`         - Expected UTC:  2025-09-07T02:00:00.000Z`);

// 3. Format for different calendar services
const googleDateString = formatDateForGoogleUTC(dateObject);
const outlookDateString = formatDateForOutlookUTC(dateObject);
const iCalDateStampString = formatDateForICalUTC(dateObject);
const iCalStartDateString = formatDateForICal(dateObject);

console.log(`\n[STEP 2] Formatting for each calendar service...`);
console.log(`\n  - Google Calendar (UTC)`);
console.log(`    - Generated: ${googleDateString}`);
console.log(`    - Expected:  20250907T020000Z`);

console.log(`\n  - Outlook Calendar (UTC)`);
console.log(`    - Generated: ${outlookDateString}`);
console.log(`    - Expected:  2025-09-07T02:00:00Z`);

console.log(`\n  - iCal DTSTAMP (UTC)`);
console.log(`    - Generated: ${iCalDateStampString}`);
console.log(`    - Expected:  20250907T020000Z`);

console.log(`\n  - iCal DTSTART (Pacific Time)`);
console.log(`    - Generated: ${iCalStartDateString}`);
console.log(`    - Expected:  20250906T190000`);


// 4. Final check
const tests = [
  { name: 'Google', expected: '20250907T020000Z', actual: googleDateString },
  { name: 'Outlook', expected: '2025-09-07T02:00:00Z', actual: outlookDateString },
  { name: 'iCal Stamp', expected: '20250907T020000Z', actual: iCalDateStampString },
  { name: 'iCal Start', expected: '20250906T190000', actual: iCalStartDateString },
];

const failedTests = tests.filter(t => t.actual !== t.expected);

if (failedTests.length === 0) {
  console.log('\n✅ ALL TESTS PASSED');
  process.exit(0);
} else {
  console.log('\n❌ SOME TESTS FAILED:');
  failedTests.forEach(t => {
    console.log(`  - ${t.name}: Expected "${t.expected}", but got "${t.actual}"`);
  });
  process.exit(1);
}
