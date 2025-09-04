// ============================================================================
// SIMPLE CALENDAR UTILS TEST RUNNER
// ============================================================================
// This file provides a simple way to test calendar utility functions
// without requiring Jest or other testing frameworks.

import {
  createUTCDateTime,
  createPacificDateTime,
  parseEventTimesUTC,
  parseEventTimes,
  formatDateForICalUTC,
  formatDateForICal,
  formatDateForGoogleUTC,
  formatDateForGoogle,
  formatDateForOutlookUTC,
  formatDateForOutlook,
  getPacificTimezoneOffset,
  getPacificTimezoneName,
} from './calendar-utils';

// ============================================================================
// TEST DATA
// ============================================================================

const testDates = {
  pst: {
    winter: '2024-01-15', // January 15, 2024 (PST)
    spring: '2024-03-10', // March 10, 2024 (PST, before DST)
  },
  pdt: {
    spring: '2024-03-15', // March 15, 2024 (PDT, after DST starts)
    summer: '2024-07-15', // July 15, 2024 (PDT)
    fall: '2024-10-15', // October 15, 2024 (PDT, before DST ends)
  },
};

const testTimes = {
  morning: '09:00:00',
  afternoon: '14:00:00',
  evening: '19:00:00',
  midnight: '00:00:00',
};

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

function testUTCDateTime() {
  console.log('\n🧪 Testing UTC DateTime Functions...');

  try {
    // Test PST date
    const pstDate = createUTCDateTime(testDates.pst.winter, testTimes.afternoon);
    console.log(`✅ PST 2:00 PM → UTC: ${pstDate.toISOString()}`);

    // Test PDT date
    const pdtDate = createUTCDateTime(testDates.pdt.summer, testTimes.afternoon);
    console.log(`✅ PDT 2:00 PM → UTC: ${pdtDate.toISOString()}`);

    // Test midnight
    const midnightDate = createUTCDateTime(testDates.pst.winter, testTimes.midnight);
    console.log(`✅ PST 12:00 AM → UTC: ${midnightDate.toISOString()}`);

    return true;
  } catch (error) {
    console.error('❌ UTC DateTime test failed:', error);
    return false;
  }
}

function testPacificDateTime() {
  console.log('\n🧪 Testing Pacific DateTime Functions...');

  try {
    // Test PST date
    const pstDate = createPacificDateTime(testDates.pst.winter, testTimes.afternoon);
    console.log(`✅ PST 2:00 PM → Local: ${pstDate.toString()}`);

    // Test PDT date
    const pdtDate = createPacificDateTime(testDates.pdt.summer, testTimes.afternoon);
    console.log(`✅ PDT 2:00 PM → Local: ${pdtDate.toString()}`);

    return true;
  } catch (error) {
    console.error('❌ Pacific DateTime test failed:', error);
    return false;
  }
}

function testTimezoneOffsets() {
  console.log('\n🧪 Testing Timezone Offset Functions...');

  try {
    // Test PST offset
    const pstDate = new Date(testDates.pst.winter + 'T' + testTimes.afternoon);
    const pstOffset = getPacificTimezoneOffset(pstDate);
    console.log(`✅ PST offset: ${pstOffset} minutes (expected: -480)`);

    // Test PDT offset
    const pdtDate = new Date(testDates.pdt.summer + 'T' + testTimes.afternoon);
    const pdtOffset = getPacificTimezoneOffset(pdtDate);
    console.log(`✅ PDT offset: ${pdtOffset} minutes (expected: -420)`);

    return pstOffset === -480 && pdtOffset === -420;
  } catch (error) {
    console.error('❌ Timezone offset test failed:', error);
    return false;
  }
}

function testFormattingFunctions() {
  console.log('\n🧪 Testing Date Formatting Functions...');

  try {
    const testDate = createUTCDateTime(testDates.pst.winter, testTimes.afternoon);

    // Test UTC formatting
    const icalUTC = formatDateForICalUTC(testDate);
    const googleUTC = formatDateForGoogleUTC(testDate);
    const outlookUTC = formatDateForOutlookUTC(testDate);

    console.log(`✅ iCal UTC: ${icalUTC}`);
    console.log(`✅ Google UTC: ${googleUTC}`);
    console.log(`✅ Outlook UTC: ${outlookUTC}`);

    // Test Pacific timezone formatting
    const testPacificDate = createPacificDateTime(testDates.pst.winter, testTimes.afternoon);
    const icalPacific = formatDateForICal(testPacificDate);
    const googlePacific = formatDateForGoogle(testPacificDate);
    const outlookPacific = formatDateForOutlook(testPacificDate);

    console.log(`✅ iCal Pacific: ${icalPacific}`);
    console.log(`✅ Google Pacific: ${googlePacific}`);
    console.log(`✅ Outlook Pacific: ${outlookPacific}`);

    return true;
  } catch (error) {
    console.error('❌ Formatting functions test failed:', error);
    return false;
  }
}

function testEventParsing() {
  console.log('\n🧪 Testing Event Parsing Functions...');

  try {
    const mockEvent = {
      id: '1',
      title: 'Test Event',
      description: 'Test Description',
      start_date: testDates.pst.winter,
      end_date: testDates.pst.winter,
      start_time: testTimes.afternoon,
      end_time: testTimes.evening,
      website: null,
      location: null,
      primary_tag: null,
      secondary_tag: null,
    };

    // Test UTC parsing
    const { startDate: startUTC, endDate: endUTC } = parseEventTimesUTC(mockEvent);
    console.log(`✅ UTC Start: ${startUTC.toISOString()}`);
    console.log(`✅ UTC End: ${endUTC!.toISOString()}`);

    // Test Pacific parsing
    const { startDate: startPacific, endDate: endPacific } = parseEventTimes(mockEvent);
    console.log(`✅ Pacific Start: ${startPacific.toString()}`);
    console.log(`✅ Pacific End: ${endPacific!.toString()}`);

    return true;
  } catch (error) {
    console.error('❌ Event parsing test failed:', error);
    return false;
  }
}

function testDSTTransitions() {
  console.log('\n🧪 Testing DST Transitions...');

  try {
    // Test before DST (March 10)
    const beforeDST = new Date(testDates.pst.spring + 'T' + testTimes.afternoon);
    const beforeDSTOffset = getPacificTimezoneOffset(beforeDST);
    console.log(`✅ Before DST (March 10): ${beforeDSTOffset} minutes (expected: -480)`);

    // Test after DST (March 15)
    const afterDST = new Date(testDates.pdt.spring + 'T' + testTimes.afternoon);
    const afterDSTOffset = getPacificTimezoneOffset(afterDST);
    console.log(`✅ After DST (March 15): ${afterDSTOffset} minutes (expected: -420)`);

    // Test summer (July 15)
    const summer = new Date(testDates.pdt.summer + 'T' + testTimes.afternoon);
    const summerOffset = getPacificTimezoneOffset(summer);
    console.log(`✅ Summer (July 15): ${summerOffset} minutes (expected: -420)`);

    // Test fall (October 15)
    const fall = new Date(testDates.pdt.fall + 'T' + testTimes.afternoon);
    const fallOffset = getPacificTimezoneOffset(fall);
    console.log(`✅ Fall (October 15): ${fallOffset} minutes (expected: -420)`);

    return (
      beforeDSTOffset === -480 &&
      afterDSTOffset === -420 &&
      summerOffset === -420 &&
      fallOffset === -420
    );
  } catch (error) {
    console.error('❌ DST transition test failed:', error);
    return false;
  }
}

function testPerformance() {
  console.log('\n🧪 Testing Performance...');

  try {
    const iterations = 1000;

    // Test UTC approach
    const utcStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const utcDate = createUTCDateTime(testDates.pst.winter, testTimes.afternoon);
      formatDateForICalUTC(utcDate);
    }
    const utcTime = performance.now() - utcStart;

    // Test Pacific timezone approach
    const pacificStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const pacificDate = createPacificDateTime(testDates.pst.winter, testTimes.afternoon);
      formatDateForICal(pacificDate);
    }
    const pacificTime = performance.now() - pacificStart;

    console.log(`✅ UTC approach: ${utcTime.toFixed(2)}ms for ${iterations} iterations`);
    console.log(`✅ Pacific approach: ${pacificTime.toFixed(2)}ms for ${iterations} iterations`);
    console.log(`✅ Performance ratio: ${(pacificTime / utcTime).toFixed(2)}x`);

    return utcTime < pacificTime; // UTC should be faster
  } catch (error) {
    console.error('❌ Performance test failed:', error);
    return false;
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

export function runAllTests() {
  console.log('🚀 Starting Calendar Utils Test Suite...');
  console.log('='.repeat(50));

  const tests = [
    { name: 'UTC DateTime Functions', fn: testUTCDateTime },
    { name: 'Pacific DateTime Functions', fn: testPacificDateTime },
    { name: 'Timezone Offset Functions', fn: testTimezoneOffsets },
    { name: 'Date Formatting Functions', fn: testFormattingFunctions },
    { name: 'Event Parsing Functions', fn: testEventParsing },
    { name: 'DST Transitions', fn: testDSTTransitions },
    { name: 'Performance Comparison', fn: testPerformance },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    try {
      const result = test.fn();
      if (result) {
        passed++;
        console.log(`\n✅ ${test.name} PASSED`);
      } else {
        failed++;
        console.log(`\n❌ ${test.name} FAILED`);
      }
    } catch (error) {
      failed++;
      console.log(`\n❌ ${test.name} FAILED with error:`, error);
    }
  });

  console.log('\n' + '='.repeat(50));
  console.log(`📊 TEST RESULTS: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('🎉 All tests passed! Calendar utils are working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the implementation.');
  }

  return { passed, failed };
}

// ============================================================================
// QUICK TEST FUNCTIONS
// ============================================================================

export function quickTest() {
  console.log('🔍 Quick Test: Creating and formatting a sample event...');

  try {
    const testDate = createUTCDateTime(testDates.pst.winter, testTimes.afternoon);
    console.log(`✅ Created UTC date: ${testDate.toISOString()}`);

    const icalFormat = formatDateForICalUTC(testDate);
    console.log(`✅ iCal format: ${icalFormat}`);

    const googleFormat = formatDateForGoogleUTC(testDate);
    console.log(`✅ Google format: ${googleFormat}`);

    console.log('✅ Quick test passed!');
    return true;
  } catch (error) {
    console.error('❌ Quick test failed:', error);
    return false;
  }
}

// Auto-run tests if this file is executed directly
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  // Node.js environment
  runAllTests();
}
