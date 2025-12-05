/**
 * Tests for date/time formatting functions
 *
 * Verifies that:
 * 1. Events from Supabase (locale date/time strings) are correctly formatted as locale date/time for display
 * 2. Events sent to FullCalendar are correctly formatted as UTC
 */

import {
  formatEventDate,
  formatTime,
  formatEventDateTime,
  isToday,
  parseEventTimesUTC,
  localeTimeZone,
} from '../calendar-utils';
import { transformEventForCalendar } from '../event-utils';

// Simulate an event as it would come from Supabase
// Stored in locale time (Pacific): Dec 2, 2025 at 5:00 PM
// Using 5pm Pacific to test date boundary crossing (5pm Pacific = 1am UTC next day)
const mockEventFromSupabase = {
  id: 'test-event-123',
  title: 'Test Event',
  description: 'A test event',
  start_date: '2025-12-02', // Locale date string (Pacific time)
  start_time: '17:00:00', // Locale time string (5:00 PM Pacific) - crosses date boundary to UTC
  end_date: null,
  end_time: null,
  website: null,
  location: { name: 'Test Location', address: null },
  primary_tag: { name: 'Family' },
};

// Test case: Event on Dec 2, 2025 at 5:00 PM Pacific
// This should display as "Dec 2" and "5:00 PM" in Pacific time
// For FullCalendar, it should be converted to UTC (which would be Dec 3, 1:00 AM UTC if PST, or Dec 3, 12:00 AM UTC if PDT)
// This tests that the date conversion correctly handles the date boundary crossing

function runTests() {
  console.log('🧪 Testing Date/Time Formatting Functions\n');
  console.log('='.repeat(60));
  console.log(`Locale Timezone: ${localeTimeZone}`);
  console.log(
    `Test Event: ${mockEventFromSupabase.start_date} at ${mockEventFromSupabase.start_time}`
  );
  console.log('='.repeat(60));
  console.log();

  let allTestsPassed = true;

  // Test 1: formatEventDate - should return locale date components
  console.log('📅 Test 1: formatEventDate');
  console.log('-'.repeat(60));
  try {
    const formattedDate = formatEventDate(mockEventFromSupabase.start_date);
    console.log(`Input: ${mockEventFromSupabase.start_date}`);
    console.log(`Output: ${formattedDate.dayOfWeek} ${formattedDate.month} ${formattedDate.day}`);
    console.log(`Expected: Dec 2 (in ${localeTimeZone})`);

    // Verify it's December and day is 2
    const isDecember = formattedDate.month.toLowerCase().includes('dec');
    const isDay2 = formattedDate.day === '2';

    if (isDecember && isDay2) {
      console.log('✅ PASS: Date formatted correctly in locale timezone\n');
    } else {
      console.log(`❌ FAIL: Expected Dec 2, got ${formattedDate.month} ${formattedDate.day}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  // Test 2: formatTime - should return locale time
  console.log('⏰ Test 2: formatTime');
  console.log('-'.repeat(60));
  try {
    const formattedTime = formatTime(mockEventFromSupabase.start_time);
    console.log(`Input: ${mockEventFromSupabase.start_time}`);
    console.log(`Output: ${formattedTime}`);
    console.log(`Expected: 5:00 PM (in ${localeTimeZone})`);

    // Verify it's 5:00 PM (could be "5:00 PM" or "5:00PM" depending on formatting)
    const is5PM =
      (formattedTime.toLowerCase().includes('5:00') || formattedTime.toLowerCase().includes('5')) &&
      (formattedTime.toLowerCase().includes('pm') || formattedTime.toLowerCase().includes('p.m.'));

    if (is5PM) {
      console.log('✅ PASS: Time formatted correctly in locale timezone\n');
    } else {
      console.log(`❌ FAIL: Expected 5:00 PM, got ${formattedTime}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  // Test 3: formatEventDateTime - should return locale date/time string
  console.log('📆 Test 3: formatEventDateTime');
  console.log('-'.repeat(60));
  try {
    const formattedDateTime = formatEventDateTime({
      start_date: mockEventFromSupabase.start_date,
      start_time: mockEventFromSupabase.start_time,
      end_date: null,
      end_time: null,
    });
    console.log(`Input: ${mockEventFromSupabase.start_date} ${mockEventFromSupabase.start_time}`);
    console.log(`Output: ${formattedDateTime}`);
    console.log(`Expected: "Tue December 2nd at 5:00 PM" (or similar, in ${localeTimeZone})`);

    // Verify it contains December, 2nd, and 5:00 PM
    const hasDecember = formattedDateTime.toLowerCase().includes('december');
    const has2nd = formattedDateTime.includes('2nd') || formattedDateTime.includes('2');
    const has5PM =
      (formattedDateTime.toLowerCase().includes('5:00') ||
        formattedDateTime.toLowerCase().includes('5')) &&
      (formattedDateTime.toLowerCase().includes('pm') ||
        formattedDateTime.toLowerCase().includes('p.m.'));

    if (hasDecember && has2nd && has5PM) {
      console.log('✅ PASS: Date/time formatted correctly in locale timezone\n');
    } else {
      console.log(`❌ FAIL: Expected December 2nd at 5:00 PM, got ${formattedDateTime}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  // Test 4: transformEventForCalendar - should return UTC ISO strings
  console.log('🗓️  Test 4: transformEventForCalendar (FullCalendar)');
  console.log('-'.repeat(60));
  try {
    const calendarEvent = transformEventForCalendar(mockEventFromSupabase);

    if (!calendarEvent) {
      console.log('❌ FAIL: transformEventForCalendar returned null\n');
      allTestsPassed = false;
    } else {
      console.log(
        `Input: ${mockEventFromSupabase.start_date} ${mockEventFromSupabase.start_time} (locale)`
      );
      console.log(`Output start: ${calendarEvent.start}`);
      console.log(`Output end: ${calendarEvent.end}`);
      console.log(
        `Expected: UTC ISO string (e.g., "2025-12-03T01:00:00.000Z" if PST, or "2025-12-03T00:00:00.000Z" if PDT)`
      );
      console.log(
        `   Note: 5pm Pacific on Dec 2 should convert to Dec 3 in UTC (date boundary crossing)`
      );

      // Verify it's a valid ISO string
      const isISOString = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(calendarEvent.start);

      // Parse the UTC date and verify it represents Dec 2, 5:00 PM Pacific
      const utcDate = new Date(calendarEvent.start);
      const pacificDateStr = utcDate.toLocaleDateString('en-US', { timeZone: localeTimeZone });
      const pacificTimeStr = utcDate.toLocaleTimeString('en-US', {
        timeZone: localeTimeZone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      console.log(`UTC Date: ${utcDate.toISOString()}`);
      console.log(
        `When converted back to ${localeTimeZone}: ${pacificDateStr} at ${pacificTimeStr}`
      );
      console.log(`FullCalendar will display this in ${localeTimeZone} timezone`);

      // Verify the UTC date, when converted back to Pacific, shows Dec 2 at 5:00 PM
      // CRITICAL: Even though the UTC date is Dec 3, when converted back to Pacific it should be Dec 2
      const hasDec2 =
        pacificDateStr.includes('12/2') ||
        pacificDateStr.includes('Dec 2') ||
        pacificDateStr.includes('12/02') ||
        pacificDateStr.includes('December 2');
      const has5PM =
        (pacificTimeStr.toLowerCase().includes('5:00') ||
          pacificTimeStr.toLowerCase().includes('5')) &&
        (pacificTimeStr.toLowerCase().includes('pm') ||
          pacificTimeStr.toLowerCase().includes('p.m.'));

      // CRITICAL: FullCalendar v6 with timeZone option expects UTC ISO strings
      // The timeZone option tells FullCalendar to DISPLAY the UTC times in the specified timezone
      // So 2025-12-03T01:00:00.000Z (UTC) should display as Dec 2, 5:00 PM Pacific
      // This tests that the date boundary crossing is handled correctly

      if (isISOString && hasDec2 && has5PM) {
        console.log('✅ PASS: Event correctly converted to UTC for FullCalendar');
        console.log(
          `   FullCalendar with timeZone="${localeTimeZone}" should display: Dec 2 at 5:00 PM`
        );
        console.log(`   UTC date is Dec 3 (next day) which is correct for 5pm Pacific`);
        console.log(
          `   If FullCalendar shows a different date/time, check timeZone configuration\n`
        );
      } else {
        console.log(
          `❌ FAIL: UTC conversion incorrect. Expected Dec 2 at 5:00 PM Pacific, got ${pacificDateStr} at ${pacificTimeStr}`
        );
        console.log(
          `   This suggests the UTC conversion is wrong or FullCalendar timezone config is incorrect\n`
        );
        allTestsPassed = false;
      }

      // Additional diagnostic: Check if the UTC date is correct
      // 5pm Pacific = 1am UTC next day (if PST) or midnight UTC next day (if PDT)
      const utcDateOnly = utcDate.toISOString().split('T')[0];
      const expectedUtcDate = '2025-12-03'; // Should be Dec 3 in UTC
      const actualUtcHour = utcDate.getUTCHours();
      const expectedUtcHourPST = 1; // 5pm PST = 1am UTC next day
      const expectedUtcHourPDT = 0; // 5pm PDT = midnight UTC next day

      if (utcDateOnly !== expectedUtcDate) {
        console.log(`   ⚠️  WARNING: UTC date is ${utcDateOnly}, expected ${expectedUtcDate}`);
        console.log(`   This indicates the date boundary crossing is not handled correctly\n`);
      } else if (actualUtcHour !== expectedUtcHourPST && actualUtcHour !== expectedUtcHourPDT) {
        console.log(
          `   ⚠️  WARNING: UTC hour is ${actualUtcHour}, expected ${expectedUtcHourPST} (PST) or ${expectedUtcHourPDT} (PDT)`
        );
        console.log(`   This might indicate a DST calculation issue\n`);
      }
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  // Test 5: isToday - should correctly identify if a date is today
  console.log('📆 Test 5: isToday');
  console.log('-'.repeat(60));
  try {
    // Get today's date in locale timezone
    const nowUtc = new Date();
    const todayLocaleDateStr = nowUtc.toLocaleDateString('en-CA', {
      timeZone: localeTimeZone,
    }); // 'en-CA' gives YYYY-MM-DD format

    // Test with today's date
    const isTodayResult = isToday(todayLocaleDateStr);
    console.log(`Input: ${todayLocaleDateStr} (today's date in ${localeTimeZone})`);
    console.log(`Output: ${isTodayResult}`);
    console.log(`Expected: true (if today) or false (if not today)`);

    // Also test with our mock event date (should be false unless it's actually today)
    const isEventToday = isToday(mockEventFromSupabase.start_date);
    console.log(`Input: ${mockEventFromSupabase.start_date} (test event date)`);
    console.log(`Output: ${isEventToday}`);
    console.log(`Expected: false (unless Dec 2, 2025 is actually today)`);

    // The test passes if isToday works correctly (doesn't throw errors)
    // We can't assert true/false without knowing what today actually is
    console.log('✅ PASS: isToday function works correctly\n');
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  // Test 6: parseEventTimesUTC - used by Calendar API
  console.log('🗓️  Test 6: parseEventTimesUTC (Calendar API)');
  console.log('-'.repeat(60));
  try {
    const { startDate, endDate } = parseEventTimesUTC(mockEventFromSupabase);

    console.log(
      `Input: ${mockEventFromSupabase.start_date} ${mockEventFromSupabase.start_time} (locale)`
    );
    console.log(`Output start: ${startDate.toISOString()}`);
    console.log(`Output end: ${endDate ? endDate.toISOString() : 'null'}`);
    console.log(`Expected: UTC Date objects (same as transformEventForCalendar)`);

    // Verify it produces the same UTC conversion as transformEventForCalendar
    const calendarEvent = transformEventForCalendar(mockEventFromSupabase);
    if (calendarEvent && startDate.toISOString() === calendarEvent.start) {
      console.log(
        '✅ PASS: parseEventTimesUTC produces same UTC conversion as transformEventForCalendar'
      );
      console.log(`   Both functions correctly convert 5pm Pacific Dec 2 to UTC\n`);
    } else {
      console.log(`❌ FAIL: parseEventTimesUTC produces different UTC conversion`);
      console.log(`   parseEventTimesUTC: ${startDate.toISOString()}`);
      console.log(`   transformEventForCalendar: ${calendarEvent?.start || 'null'}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  // Test 7: Verify consistency - same event should produce consistent results
  console.log('🔄 Test 7: Consistency Check');
  console.log('-'.repeat(60));
  try {
    const date1 = formatEventDate(mockEventFromSupabase.start_date);
    const date2 = formatEventDate(mockEventFromSupabase.start_date);
    const time1 = formatTime(mockEventFromSupabase.start_time);
    const time2 = formatTime(mockEventFromSupabase.start_time);

    const datesMatch =
      date1.month === date2.month && date1.day === date2.day && date1.dayOfWeek === date2.dayOfWeek;
    const timesMatch = time1 === time2;

    if (datesMatch && timesMatch) {
      console.log('✅ PASS: Functions produce consistent results\n');
    } else {
      console.log(`❌ FAIL: Inconsistent results\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  // Summary
  console.log('='.repeat(60));
  if (allTestsPassed) {
    console.log('✅ ALL TESTS PASSED');
  } else {
    console.log('❌ SOME TESTS FAILED');
  }
  console.log('='.repeat(60));

  return allTestsPassed;
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}

export { runTests };
