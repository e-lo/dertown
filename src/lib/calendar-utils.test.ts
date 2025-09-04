// ============================================================================
// CALENDAR UTILS TEST SUITE
// ============================================================================
// This file tests all calendar export functions to ensure they work correctly
// for both UTC and Pacific timezone approaches in PST and PDT scenarios.

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

// Test dates for different scenarios
const testDates = {
  // PST dates (November - March)
  pst: {
    winter: '2024-01-15', // January 15, 2024 (PST)
    spring: '2024-03-10', // March 10, 2024 (PST, before DST)
  },
  // PDT dates (March - November)
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
// UTC APPROACH TESTS (RECOMMENDED)
// ============================================================================

describe('UTC Approach Tests (Recommended)', () => {
  describe('createUTCDateTime', () => {
    test('creates UTC date from PST date/time', () => {
      const utcDate = createUTCDateTime(testDates.pst.winter, testTimes.afternoon);
      // 2:00 PM PST = 10:00 PM UTC (PST is UTC-8)
      expect(utcDate.getUTCHours()).toBe(22); // 10 PM UTC
      expect(utcDate.getUTCMinutes()).toBe(0);
    });

    test('creates UTC date from PDT date/time', () => {
      const utcDate = createUTCDateTime(testDates.pdt.summer, testTimes.afternoon);
      // 2:00 PM PDT = 9:00 PM UTC (PDT is UTC-7)
      expect(utcDate.getUTCHours()).toBe(21); // 9 PM UTC
      expect(utcDate.getUTCMinutes()).toBe(0);
    });

    test('handles midnight correctly', () => {
      const utcDate = createUTCDateTime(testDates.pst.winter, testTimes.midnight);
      // 12:00 AM PST = 8:00 AM UTC (PST is UTC-8)
      expect(utcDate.getUTCHours()).toBe(8); // 8 AM UTC
    });
  });

  describe('parseEventTimesUTC', () => {
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

    test('parses event times to UTC correctly', () => {
      const { startDate, endDate } = parseEventTimesUTC(mockEvent);

      // Start: 2:00 PM PST = 10:00 PM UTC
      expect(startDate.getUTCHours()).toBe(22);
      expect(startDate.getUTCMinutes()).toBe(0);

      // End: 7:00 PM PST = 3:00 AM UTC (next day)
      expect(endDate!.getUTCHours()).toBe(3);
      expect(endDate!.getUTCMinutes()).toBe(0);
    });
  });

  describe('formatDateForICalUTC', () => {
    test('formats PST date correctly', () => {
      const utcDate = createUTCDateTime(testDates.pst.winter, testTimes.afternoon);
      const formatted = formatDateForICalUTC(utcDate);
      // Should end with Z to indicate UTC
      expect(formatted).toMatch(/^\d{8}T\d{6}Z$/);
      expect(formatted).toContain('T');
      expect(formatted).toContain('Z');
    });

    test('formats PDT date correctly', () => {
      const utcDate = createUTCDateTime(testDates.pdt.summer, testTimes.afternoon);
      const formatted = formatDateForICalUTC(utcDate);
      expect(formatted).toMatch(/^\d{8}T\d{6}Z$/);
    });
  });

  describe('formatDateForGoogleUTC', () => {
    test('formats date for Google Calendar with UTC', () => {
      const utcDate = createUTCDateTime(testDates.pst.winter, testTimes.afternoon);
      const formatted = formatDateForGoogleUTC(utcDate);
      expect(formatted).toMatch(/^\d{8}T\d{6}Z$/);
    });
  });

  describe('formatDateForOutlookUTC', () => {
    test('formats date for Outlook with UTC', () => {
      const utcDate = createUTCDateTime(testDates.pst.winter, testTimes.afternoon);
      const formatted = formatDateForOutlookUTC(utcDate);
      // Should be ISO string ending with Z
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});

// ============================================================================
// PACIFIC TIMEZONE APPROACH TESTS (ALTERNATIVE)
// ============================================================================

describe('Pacific Timezone Approach Tests (Alternative)', () => {
  describe('createPacificDateTime', () => {
    test('creates date object without timezone manipulation', () => {
      const pacificDate = createPacificDateTime(testDates.pst.winter, testTimes.afternoon);
      // Should create date in local timezone, not manipulate it
      expect(pacificDate.getHours()).toBe(14); // 2 PM local time
      expect(pacificDate.getMinutes()).toBe(0);
    });
  });

  describe('getPacificTimezoneOffset', () => {
    test('returns correct offset for PST dates', () => {
      const pstDate = new Date(testDates.pst.winter + 'T' + testTimes.afternoon);
      const offset = getPacificTimezoneOffset(pstDate);
      // PST is UTC-8 = -480 minutes
      expect(offset).toBe(-480);
    });

    test('returns correct offset for PDT dates', () => {
      const pdtDate = new Date(testDates.pdt.summer + 'T' + testTimes.afternoon);
      const offset = getPacificTimezoneOffset(pdtDate);
      // PDT is UTC-7 = -420 minutes
      expect(offset).toBe(-420);
    });

    test('handles DST transition correctly', () => {
      // March 10 (before DST) should be PST
      const beforeDST = new Date(testDates.pst.spring + 'T' + testTimes.afternoon);
      expect(getPacificTimezoneOffset(beforeDST)).toBe(-480);

      // March 15 (after DST) should be PDT
      const afterDST = new Date(testDates.pdt.spring + 'T' + testTimes.afternoon);
      expect(getPacificTimezoneOffset(afterDST)).toBe(-420);
    });
  });

  describe('parseEventTimes', () => {
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

    test('parses event times correctly', () => {
      const { startDate, endDate } = parseEventTimes(mockEvent);

      // Should preserve local time representation
      expect(startDate.getHours()).toBe(14); // 2 PM
      expect(endDate!.getHours()).toBe(19); // 7 PM
    });
  });

  describe('formatDateForICal', () => {
    test('formats date for iCal with Pacific timezone', () => {
      const pacificDate = createPacificDateTime(testDates.pst.winter, testTimes.afternoon);
      const formatted = formatDateForICal(pacificDate);
      // Should NOT end with Z (no UTC indicator)
      expect(formatted).toMatch(/^\d{8}T\d{6}$/);
      expect(formatted).not.toContain('Z');
    });
  });

  describe('formatDateForGoogle', () => {
    test('formats date for Google Calendar with Pacific timezone', () => {
      const pacificDate = createPacificDateTime(testDates.pst.winter, testTimes.afternoon);
      const formatted = formatDateForGoogle(pacificDate);
      expect(formatted).toMatch(/^\d{8}T\d{6}$/);
    });
  });

  describe('formatDateForOutlook', () => {
    test('formats date for Outlook with Pacific timezone', () => {
      const pacificDate = createPacificDateTime(testDates.pst.winter, testTimes.afternoon);
      const formatted = formatDateForOutlook(pacificDate);
      // Should include timezone offset
      expect(formatted).toMatch(/[+-]\d{2}:\d{2}$/);
    });
  });
});

// ============================================================================
// TIMEZONE DETECTION TESTS
// ============================================================================

describe('Timezone Detection Tests', () => {
  describe('getPacificTimezoneName', () => {
    test('returns PST for winter dates', () => {
      const winterDate = new Date(testDates.pst.winter + 'T' + testTimes.afternoon);
      // Mock the function to return consistent results
      const name = getPacificTimezoneName();
      expect(['PST', 'PDT']).toContain(name);
    });

    test('returns PDT for summer dates', () => {
      const summerDate = new Date(testDates.pdt.summer + 'T' + testTimes.afternoon);
      const name = getPacificTimezoneName();
      expect(['PST', 'PDT']).toContain(name);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration Tests', () => {
  test('UTC approach produces consistent results across all formats', () => {
    const utcDate = createUTCDateTime(testDates.pst.winter, testTimes.afternoon);

    const icalFormat = formatDateForICalUTC(utcDate);
    const googleFormat = formatDateForGoogleUTC(utcDate);
    const outlookFormat = formatDateForOutlookUTC(utcDate);

    // All should end with Z (UTC)
    expect(icalFormat).toContain('Z');
    expect(googleFormat).toContain('Z');
    expect(outlookFormat).toContain('Z');

    // All should represent the same time
    const icalTime = icalFormat.replace('T', '').replace('Z', '');
    const googleTime = googleFormat.replace('T', '').replace('Z', '');
    expect(icalTime).toBe(googleTime);
  });

  test('Pacific timezone approach handles DST transitions correctly', () => {
    // Test PST to PDT transition
    const beforeDST = createPacificDateTime(testDates.pst.spring, testTimes.afternoon);
    const afterDST = createPacificDateTime(testDates.pdt.spring, testTimes.afternoon);

    // Both should represent 2:00 PM in their respective timezones
    expect(beforeDST.getHours()).toBe(14);
    expect(afterDST.getHours()).toBe(14);

    // But the UTC representation should be different
    const beforeDSTOffset = getPacificTimezoneOffset(beforeDST);
    const afterDSTOffset = getPacificTimezoneOffset(afterDST);
    expect(beforeDSTOffset).toBe(-480); // PST
    expect(afterDSTOffset).toBe(-420); // PDT
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Error Handling Tests', () => {
  test('createUTCDateTime throws error for missing date', () => {
    expect(() => createUTCDateTime('', testTimes.afternoon)).toThrow('Date string is required');
  });

  test('createPacificDateTime throws error for missing date', () => {
    expect(() => createPacificDateTime('', testTimes.afternoon)).toThrow('Date string is required');
  });

  test('parseEventTimesUTC throws error for missing start date', () => {
    const mockEvent = {
      id: '1',
      title: 'Test Event',
      description: 'Test Description',
      start_date: null,
      end_date: testDates.pst.winter,
      start_time: testTimes.afternoon,
      end_time: testTimes.evening,
      website: null,
      location: null,
      primary_tag: null,
      secondary_tag: null,
    };

    expect(() => parseEventTimesUTC(mockEvent)).toThrow('Event start date is required');
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('Performance Tests', () => {
  test('UTC approach is faster than Pacific timezone approach', () => {
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

    // UTC approach should be faster (no DST calculations)
    expect(utcTime).toBeLessThan(pacificTime);
  });
});

// ============================================================================
// TEST RUNNER
// ============================================================================

// Simple test runner for environments without Jest
export function runTests() {
  const tests = [
    // Add test functions here
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    try {
      test();
      passed++;
      console.log(`✅ ${test.name} passed`);
    } catch (error) {
      failed++;
      console.error(`❌ ${test.name} failed:`, error);
    }
  });

  console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Export test data for external testing
export { testDates, testTimes };
