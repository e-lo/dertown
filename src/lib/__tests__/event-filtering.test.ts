/**
 * Tests for event filtering functions
 * 
 * Verifies that:
 * 1. Events are filtered based on Pacific timezone dates, not UTC dates
 * 2. Today's events are included even if they're "tomorrow" in UTC
 * 3. Events with end_date extending into the future are included
 */

import { localeTimeZone } from '../calendar-utils';

// Copy the functions here to test them without importing from supabase.ts
// (which has environment variable dependencies)
function getTodayLocale(): string {
  // Get current UTC time
  const nowUtc = new Date();
  
  // Convert to locale timezone date string (YYYY-MM-DD format)
  // Use 'en-CA' locale which gives us YYYY-MM-DD format directly
  const todayLocaleDateStr = nowUtc.toLocaleDateString('en-CA', { 
    timeZone: localeTimeZone 
  });
  
  return todayLocaleDateStr;
}

function filterCurrentAndFutureEvents(events: any[]): any[] {
  if (!events) return [];
  
  const todayLocale = getTodayLocale();
  
  return events.filter((event: any) => {
    // Must have at least a start_date
    if (!event.start_date) return false;
    
    // Check if start_date >= today (date comparison in locale time)
    const startDateStr = event.start_date;
    const startDateIsTodayOrFuture = startDateStr >= todayLocale;
    
    // Check if end_date >= today (if end_date exists)
    if (event.end_date) {
      const endDateStr = event.end_date;
      const endDateIsTodayOrFuture = endDateStr >= todayLocale;
      // Include if either start_date or end_date is today or future
      return startDateIsTodayOrFuture || endDateIsTodayOrFuture;
    }
    
    // If no end_date, only check start_date
    return startDateIsTodayOrFuture;
  });
}

async function runTests() {
  console.log('🧪 Testing Event Filtering Functions\n');
  console.log('='.repeat(60));
  console.log(`Locale Timezone: ${localeTimeZone}`);
  const todayLocale = getTodayLocale();
  console.log(`Today (Pacific): ${todayLocale}`);
  console.log('='.repeat(60));
  console.log();

  let allTestsPassed = true;

  // Test 1: Event today in Pacific time should be included
  console.log('📅 Test 1: Event Today (Pacific Time)');
  console.log('-'.repeat(60));
  try {
    const todayEvent = {
      id: 'event-today',
      title: 'Event Today',
      start_date: todayLocale,
      start_time: '17:00:00', // 5pm Pacific
      end_date: null,
      end_time: null,
    };

    const filtered = filterCurrentAndFutureEvents([todayEvent]);
    const isIncluded = filtered.length === 1 && filtered[0].id === 'event-today';

    console.log(`Input: Event on ${todayLocale} at 5pm Pacific`);
    console.log(`Filtered result: ${filtered.length} event(s)`);
    console.log(`Expected: 1 event (included)`);

    if (isIncluded) {
      console.log('✅ PASS: Today\'s event is included\n');
    } else {
      console.log('❌ FAIL: Today\'s event was filtered out\n');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  // Test 2: Event tomorrow in Pacific time should be included
  console.log('📅 Test 2: Event Tomorrow (Pacific Time)');
  console.log('-'.repeat(60));
  try {
    // Calculate tomorrow in Pacific time
    const todayDate = new Date(todayLocale + 'T12:00:00');
    const tomorrowDate = new Date(todayDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowLocale = tomorrowDate.toISOString().split('T')[0];

    const tomorrowEvent = {
      id: 'event-tomorrow',
      title: 'Event Tomorrow',
      start_date: tomorrowLocale,
      start_time: '10:00:00',
      end_date: null,
      end_time: null,
    };

    const filtered = filterCurrentAndFutureEvents([tomorrowEvent]);
    const isIncluded = filtered.length === 1 && filtered[0].id === 'event-tomorrow';

    console.log(`Input: Event on ${tomorrowLocale} at 10am Pacific`);
    console.log(`Filtered result: ${filtered.length} event(s)`);
    console.log(`Expected: 1 event (included)`);

    if (isIncluded) {
      console.log('✅ PASS: Tomorrow\'s event is included\n');
    } else {
      console.log('❌ FAIL: Tomorrow\'s event was filtered out\n');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  // Test 3: Event yesterday in Pacific time should be excluded
  console.log('📅 Test 3: Event Yesterday (Pacific Time)');
  console.log('-'.repeat(60));
  try {
    // Calculate yesterday in Pacific time
    const todayDate = new Date(todayLocale + 'T12:00:00');
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayLocale = yesterdayDate.toISOString().split('T')[0];

    const yesterdayEvent = {
      id: 'event-yesterday',
      title: 'Event Yesterday',
      start_date: yesterdayLocale,
      start_time: '14:00:00',
      end_date: null,
      end_time: null,
    };

    const filtered = filterCurrentAndFutureEvents([yesterdayEvent]);
    const isExcluded = filtered.length === 0;

    console.log(`Input: Event on ${yesterdayLocale} at 2pm Pacific`);
    console.log(`Filtered result: ${filtered.length} event(s)`);
    console.log(`Expected: 0 events (excluded)`);

    if (isExcluded) {
      console.log('✅ PASS: Yesterday\'s event is excluded\n');
    } else {
      console.log('❌ FAIL: Yesterday\'s event was included\n');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  // Test 4: Event today at 5pm Pacific (might be tomorrow in UTC) should be included
  console.log('📅 Test 4: Event Today at 5pm Pacific (Date Boundary Test)');
  console.log('-'.repeat(60));
  try {
    const { TZDate } = await import('@date-fns/tz');
    // This tests the critical case: event today at 5pm Pacific
    // In UTC, this might be tomorrow, but it should still be included
    const todayEvent5pm = {
      id: 'event-today-5pm',
      title: 'Event Today 5pm',
      start_date: todayLocale,
      start_time: '17:00:00', // 5pm Pacific - might be tomorrow in UTC
      end_date: null,
      end_time: null,
    };

    const filtered = filterCurrentAndFutureEvents([todayEvent5pm]);
    const isIncluded = filtered.length === 1 && filtered[0].id === 'event-today-5pm';

    // Check what this date would be in UTC
    const [year, month, day] = todayLocale.split('-').map(Number);
    const tzDate = new TZDate(year, month - 1, day, 17, 0, 0, localeTimeZone);
    const utcDate = new Date(tzDate.getTime());
    const utcDateStr = utcDate.toISOString().split('T')[0];

    console.log(`Input: Event on ${todayLocale} at 5pm Pacific`);
    console.log(`UTC equivalent: ${utcDateStr} (might be different date)`);
    console.log(`Filtered result: ${filtered.length} event(s)`);
    console.log(`Expected: 1 event (included, based on Pacific date, not UTC)`);

    if (isIncluded) {
      console.log('✅ PASS: Today\'s 5pm event is included (correctly using Pacific date)\n');
    } else {
      console.log('❌ FAIL: Today\'s 5pm event was filtered out (might be using UTC date)\n');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  // Test 5: Event with end_date extending into future should be included
  console.log('📅 Test 5: Event with end_date in Future');
  console.log('-'.repeat(60));
  try {
    // Calculate yesterday and tomorrow
    const todayDate = new Date(todayLocale + 'T12:00:00');
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayLocale = yesterdayDate.toISOString().split('T')[0];
    
    const tomorrowDate = new Date(todayDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowLocale = tomorrowDate.toISOString().split('T')[0];

    const multiDayEvent = {
      id: 'event-multiday',
      title: 'Multi-day Event',
      start_date: yesterdayLocale, // Started yesterday
      start_time: '10:00:00',
      end_date: tomorrowLocale, // Ends tomorrow
      end_time: '18:00:00',
    };

    const filtered = filterCurrentAndFutureEvents([multiDayEvent]);
    const isIncluded = filtered.length === 1 && filtered[0].id === 'event-multiday';

    console.log(`Input: Event from ${yesterdayLocale} to ${tomorrowLocale}`);
    console.log(`Filtered result: ${filtered.length} event(s)`);
    console.log(`Expected: 1 event (included because end_date is in future)`);

    if (isIncluded) {
      console.log('✅ PASS: Multi-day event with future end_date is included\n');
    } else {
      console.log('❌ FAIL: Multi-day event was filtered out\n');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  // Test 6: All-day event today should be included
  console.log('📅 Test 6: All-Day Event Today');
  console.log('-'.repeat(60));
  try {
    const allDayEvent = {
      id: 'event-allday-today',
      title: 'All-Day Event Today',
      start_date: todayLocale,
      start_time: null, // All-day event
      end_date: null,
      end_time: null,
    };

    const filtered = filterCurrentAndFutureEvents([allDayEvent]);
    const isIncluded = filtered.length === 1 && filtered[0].id === 'event-allday-today';

    console.log(`Input: All-day event on ${todayLocale}`);
    console.log(`Filtered result: ${filtered.length} event(s)`);
    console.log(`Expected: 1 event (included)`);

    if (isIncluded) {
      console.log('✅ PASS: Today\'s all-day event is included\n');
    } else {
      console.log('❌ FAIL: Today\'s all-day event was filtered out\n');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  // Test 7: Mixed events - some should be included, some excluded
  console.log('📅 Test 7: Mixed Events (Some Included, Some Excluded)');
  console.log('-'.repeat(60));
  try {
    const todayDate = new Date(todayLocale + 'T12:00:00');
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayLocale = yesterdayDate.toISOString().split('T')[0];
    
    const tomorrowDate = new Date(todayDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowLocale = tomorrowDate.toISOString().split('T')[0];

    const mixedEvents = [
      { id: 'past', title: 'Past Event', start_date: yesterdayLocale, start_time: '10:00:00' },
      { id: 'today', title: 'Today Event', start_date: todayLocale, start_time: '14:00:00' },
      { id: 'tomorrow', title: 'Tomorrow Event', start_date: tomorrowLocale, start_time: '16:00:00' },
    ];

    const filtered = filterCurrentAndFutureEvents(mixedEvents);
    const includedIds = filtered.map((e: any) => e.id).sort();
    const expectedIds = ['today', 'tomorrow'].sort();

    console.log(`Input: 3 events (past, today, tomorrow)`);
    console.log(`Filtered result: ${filtered.length} event(s) - IDs: ${includedIds.join(', ')}`);
    console.log(`Expected: 2 events - IDs: ${expectedIds.join(', ')}`);

    if (filtered.length === 2 && 
        includedIds[0] === expectedIds[0] && 
        includedIds[1] === expectedIds[1]) {
      console.log('✅ PASS: Correct events included/excluded\n');
    } else {
      console.log(`❌ FAIL: Expected ${expectedIds.join(', ')}, got ${includedIds.join(', ')}\n`);
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
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  runTests().then((success) => {
    process.exit(success ? 0 : 1);
  }).catch((error) => {
    console.error('Test execution error:', error);
    process.exit(1);
  });
}

export { runTests };

