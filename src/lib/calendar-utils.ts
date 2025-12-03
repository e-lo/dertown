// ============================================================================
// TIMEZONE AND DATE UTILITIES
// ============================================================================
// This file handles all timezone and date/time functionality including:
// - Timezone constants and configuration
// - Date/time parsing (locale to UTC conversion)
// - Date/time formatting (for display)
// - Calendar export formatting (iCal, Google Calendar, Outlook)
// - Event generation utilities

import { TZDate, tz } from '@date-fns/tz';
import { format } from 'date-fns';

// ============================================================================
// TIMEZONE CONSTANTS
// ============================================================================

/**
 * Locale timezone constant - all event dates/times are stored and displayed in this timezone
 * Change this constant to use a different timezone if needed
 */
export const localeTimeZone = 'America/Los_Angeles';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface EventData {
  id: string | null;
  title: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  website: string | null;
  location?: { name: string; address: string | null } | null;
  primary_tag?: { name: string } | null;
  secondary_tag?: { name: string } | null;
}

// ============================================================================
// TIMEZONE HANDLING - UTC APPROACH (RECOMMENDED)
// ============================================================================

/**
 * Convert a date and time to a UTC Date object
 * @param dateStr - Date string (YYYY-MM-DD)
 * @param timeStr - Time string (HH:MM:SS or HH:MM)
 * @returns Date object in UTC
 */
export function createUTCDateTime(dateStr: string, timeStr?: string): Date {
  if (!dateStr) {
    throw new Error('Date string is required');
  }

  // If no time specified, default to start of day
  const time = timeStr || '00:00:00';

  // Parse the date string into components
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes, seconds] = time.split(':').map(Number);

  // Create a TZDate in locale timezone using individual components
  const localeDate = new TZDate(
    year,
    month - 1, // months are 0-indexed in TZDate
    day,
    hours,
    minutes,
    seconds,
    localeTimeZone
  );
  // Convert to a regular Date object representing the same moment in UTC
  return new Date(localeDate.getTime());
}

/**
 * Parse event start and end times with UTC timezone handling
 * @param event - Event data
 * @returns Object with startDate and endDate in UTC
 */
export function parseEventTimesUTC(event: EventData): {
  startDate: Date;
  endDate: Date | null;
} {
  // Parse start date/time
  if (!event.start_date) {
    throw new Error('Event start date is required');
  }

  // For all-day events (no start_time), use date-only at midnight UTC
  // This ensures the date represents the correct day in Pacific time
  const startDate = event.start_time 
    ? createUTCDateTime(event.start_date, event.start_time)
    : createUTCDateTime(event.start_date, '00:00:00'); // All-day events use midnight

  // Parse end date/time
  let endDate: Date | null = null;

  if (event.end_date && event.end_time) {
    // Both end_date and end_time specified
    endDate = createUTCDateTime(event.end_date, event.end_time);
  } else if (event.end_time) {
    // Only end_time specified, use start_date
    endDate = createUTCDateTime(event.start_date, event.end_time);
  } else if (event.end_date) {
    // Only end_date specified, use end of day
    endDate = createUTCDateTime(event.end_date, '23:59:59');
  } else if (!event.start_time && event.start_date) {
    // All-day event with no end_date - use start_date at end of day
    endDate = createUTCDateTime(event.start_date, '23:59:59');
  }

  return { startDate, endDate };
}

// ============================================================================
// DATE/TIME FORMATTING FOR DISPLAY
// ============================================================================

/**
 * Formats a date string (YYYY-MM-DD) that represents a locale time date
 * Since dates are stored in locale time, we parse them directly and format in locale timezone
 * @param date - Date string (YYYY-MM-DD) or Date object
 * @returns Formatted date components in locale timezone
 */
export function formatEventDate(date: string | Date): {
  month: string;
  day: string;
  dayOfWeek: string;
} {
  // Parse event date string as locale date (stored in locale time)
  // Since dates are stored in Pacific time, we parse them directly without timezone conversion
  let localeTZDate: TZDate;
  if (typeof date === 'string') {
    // Parse the date string directly: "2025-12-02" -> Dec 2, 2025
    const [year, month, day] = date.split('-').map(Number);
    // Create a TZDate in locale timezone at noon to avoid DST edge cases
    localeTZDate = new TZDate(
      year,
      month - 1, // months are 0-indexed
      day,
      12, // noon
      0,
      0,
      localeTimeZone
    );
  } else {
    // If it's already a Date, we need to interpret it as Pacific time
    // Get the date components and create a TZDate in Pacific timezone
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    localeTZDate = new TZDate(year, month, day, 12, 0, 0, localeTimeZone);
  }

  // Format TZDate with explicit timezone context to ensure correct formatting
  // TZDate represents a moment in Pacific time, and we format it as Pacific time
  return {
    month: format(localeTZDate, 'MMM', { in: tz(localeTimeZone) }),
    day: format(localeTZDate, 'd', { in: tz(localeTimeZone) }),
    dayOfWeek: format(localeTZDate, 'EEE', { in: tz(localeTimeZone) }),
  };
}

/**
 * Formats a time string (HH:MM:SS) as locale time (stored in locale timezone)
 * @param time - Time string in HH:MM:SS format
 * @returns Formatted time string in 12-hour format
 */
export function formatTime(time: string | null | undefined): string {
  // Handle null/undefined time
  if (!time) {
    return '';
  }
  
  // Parse event time as locale time (stored in locale timezone)
  // Since times are stored in Pacific time, we parse them directly
  const [hours, minutes, seconds] = time.split(':').map(Number);
  const localeTZDate = new TZDate(
    2000, // Use a fixed year for time-only formatting
    0,    // January
    1,    // Day 1
    hours,
    minutes,
    seconds || 0,
    localeTimeZone
  );
  // Format TZDate with explicit timezone context to ensure correct formatting
  // TZDate represents a moment in Pacific time, and we format it as Pacific time
  return format(localeTZDate, 'h:mm a', { in: tz(localeTimeZone) });
}

/**
 * Checks if a date is today in locale timezone
 * Uses UTC for current date to be independent of server location, then converts to locale date
 * @param date - Date string (YYYY-MM-DD) or Date object
 * @returns true if the date is today in locale timezone
 */
export function isToday(date: string | Date): boolean {
  // Get current UTC date/time (independent of server location)
  const nowUtc = new Date();
  // Convert to locale date (locale timezone) as YYYY-MM-DD
  const todayLocaleDate = nowUtc.toLocaleDateString('en-CA', { 
    timeZone: localeTimeZone
  }); // 'en-CA' gives YYYY-MM-DD format

  // Handle date strings - treat them as locale time dates
  let eventLocaleDate: string;
  if (typeof date === 'string') {
    eventLocaleDate = date; // Already in YYYY-MM-DD format
  } else {
    // Convert Date object to locale date string (locale timezone) as YYYY-MM-DD
    eventLocaleDate = date.toLocaleDateString('en-CA', {
      timeZone: localeTimeZone
    });
  }

  // Compare locale date strings (YYYY-MM-DD format)
  return todayLocaleDate === eventLocaleDate;
}

/**
 * Format event date/time as 'Fri June 5th at 5:00PM' (in locale time)
 * Since dates/times are stored in locale time, we parse them as locale dates/times
 * @param event - Event with locale date/time strings (stored in locale timezone)
 * @returns Formatted date/time string
 */
export function formatEventDateTime(event: {
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
}): string {
  function ordinal(n: number) {
    if (n > 3 && n < 21) return n + 'th';
    switch (n % 10) {
      case 1:
        return n + 'st';
      case 2:
        return n + 'nd';
      case 3:
        return n + 'rd';
      default:
        return n + 'th';
    }
  }
  
  // Check if this is an all-day event (no start_time)
  const isAllDay = !event.start_time;
  
  // Parse event locale date/time strings (stored in locale time) into Date objects
  // Use TZDate to create dates directly in locale timezone to avoid date shifts
  const [startYear, startMonthNum, startDayNum] = event.start_date.split('-').map(Number);
  
  // For all-day events, we don't need to create a TZDate with a time
  // We'll just format the date without time
  const startEventLocaleDay = format(new TZDate(startYear, startMonthNum - 1, startDayNum, 12, 0, 0, localeTimeZone), 'EEE', { in: tz(localeTimeZone) });
  const startEventLocaleMonth = format(new TZDate(startYear, startMonthNum - 1, startDayNum, 12, 0, 0, localeTimeZone), 'MMMM', { in: tz(localeTimeZone) });
  const startEventLocaleDateNum = parseInt(format(new TZDate(startYear, startMonthNum - 1, startDayNum, 12, 0, 0, localeTimeZone), 'd', { in: tz(localeTimeZone) }));
  
  let result: string;
  
  if (isAllDay) {
    // All-day event: just show the date(s), no time
    result = `${startEventLocaleDay} ${startEventLocaleMonth} ${ordinal(startEventLocaleDateNum)}`;
    
    // If there's an end_date, show the date range
    if (event.end_date) {
      const [endYear, endMonthNum, endDayNum] = event.end_date.split('-').map(Number);
      const endEventLocaleDay = format(new TZDate(endYear, endMonthNum - 1, endDayNum, 12, 0, 0, localeTimeZone), 'EEE', { in: tz(localeTimeZone) });
      const endEventLocaleMonth = format(new TZDate(endYear, endMonthNum - 1, endDayNum, 12, 0, 0, localeTimeZone), 'MMMM', { in: tz(localeTimeZone) });
      const endEventLocaleDateNum = parseInt(format(new TZDate(endYear, endMonthNum - 1, endDayNum, 12, 0, 0, localeTimeZone), 'd', { in: tz(localeTimeZone) }));
      result += ` – ${endEventLocaleDay} ${endEventLocaleMonth} ${ordinal(endEventLocaleDateNum)}`;
    }
  } else {
    // Timed event: show date and time
    // We know start_time is not null here because isAllDay check above
    const startTimeParts = event.start_time!.split(':').map(Number);
    const startLocaleTZDate = new TZDate(
      startYear,
      startMonthNum - 1, // months are 0-indexed
      startDayNum,
      startTimeParts[0],
      startTimeParts[1],
      startTimeParts[2] || 0,
      localeTimeZone
    );
    
    const startEventLocaleTime = format(startLocaleTZDate, 'h:mm a', { in: tz(localeTimeZone) });
    result = `${startEventLocaleDay} ${startEventLocaleMonth} ${ordinal(startEventLocaleDateNum)} at ${startEventLocaleTime}`;
    
    // Keep track of whether we have an end date/time for later formatting
    let hasEndDate = false;
    let endLocaleTZDate: TZDate | null = null;
    if (event.end_date) {
      const [endYear, endMonthNum, endDayNum] = event.end_date.split('-').map(Number);
      const endTimeParts = event.end_time ? event.end_time.split(':').map(Number) : [23, 59, 59];
      endLocaleTZDate = new TZDate(
        endYear,
        endMonthNum - 1, // months are 0-indexed
        endDayNum,
        endTimeParts[0],
        endTimeParts[1],
        endTimeParts[2] || 0,
        localeTimeZone
      );
      hasEndDate = true;
    } else if (event.end_time) {
      const endTimeParts = event.end_time.split(':').map(Number);
      endLocaleTZDate = new TZDate(
        startYear,
        startMonthNum - 1, // months are 0-indexed
        startDayNum,
        endTimeParts[0],
        endTimeParts[1],
        endTimeParts[2] || 0,
        localeTimeZone
      );
      hasEndDate = false; // Same day, only time matters
    }
    
    if (endLocaleTZDate) {
      const endEventLocaleDay = format(endLocaleTZDate, 'EEE', { in: tz(localeTimeZone) });
      const endEventLocaleMonth = format(endLocaleTZDate, 'MMMM', { in: tz(localeTimeZone) });
      const endEventLocaleDateNum = parseInt(format(endLocaleTZDate, 'd', { in: tz(localeTimeZone) }));
      const endEventLocaleTime = format(endLocaleTZDate, 'h:mm a', { in: tz(localeTimeZone) });
      
      const startEventLocaleDateStr = format(startLocaleTZDate, 'yyyy-MM-dd', { in: tz(localeTimeZone) });
      const endEventLocaleDateStr = format(endLocaleTZDate, 'yyyy-MM-dd', { in: tz(localeTimeZone) });
      
      if (hasEndDate && endEventLocaleDateStr !== startEventLocaleDateStr) {
        result += ` – ${endEventLocaleDay} ${endEventLocaleMonth} ${ordinal(endEventLocaleDateNum)} at ${endEventLocaleTime}`;
      } else if (event.end_time) {
        result += ` – ${endEventLocaleTime}`;
      }
    }
  }
  
  return result;
}

// ============================================================================
// CALENDAR EXPORT FORMATTING
// ============================================================================

/**
 * Format a Date object for iCal with locale timezone (YYYYMMDDTHHMMSS)
 * @param date - Date object
 * @returns Formatted string for iCal
 */
export function formatDateForICal(date: Date): string {
  // Use format with locale timezone context
  return format(date, "yyyyMMdd'T'HHmmss", { in: tz(localeTimeZone) });
}

/**
 * Format a Date object for Google Calendar with locale timezone (YYYYMMDDTHHMMSS)
 * @param date - Date object
 * @returns Formatted string for Google Calendar
 */
export function formatDateForGoogle(date: Date): string {
  // Use format with locale timezone context
  return format(date, "yyyyMMdd'T'HHmmss", { in: tz(localeTimeZone) });
}

/**
 * Format a Date object for Outlook Calendar with locale timezone (ISO string with timezone)
 * @param date - Date object
 * @returns ISO string for Outlook
 */
export function formatDateForOutlook(date: Date): string {
  // Use format with locale timezone context
  return format(date, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX", { in: tz(localeTimeZone) });
}

// ============================================================================
// DATE FORMATTING FUNCTIONS - UTC
// ============================================================================

/**
 * Formats a Date object as a UTC string for Google Calendar (YYYYMMDDTHHMMSSZ).
 */
export function formatDateForGoogleUTC(date: Date): string {
  // Use format with UTC timezone context
  return format(date, "yyyyMMdd'T'HHmmss'Z'", { in: tz('UTC') });
}

/**
 * Formats a Date object as a UTC string for iCal (YYYYMMDDTHHMMSSZ).
 */
export function formatDateForICalUTC(date: Date): string {
  // Use format with UTC timezone context
  return format(date, "yyyyMMdd'T'HHmmss'Z'", { in: tz('UTC') });
}

/**
 * Formats a Date object as a UTC ISO string for Outlook (YYYY-MM-DDTHH:mm:ssZ).
 */
export function formatDateForOutlookUTC(date: Date): string {
  // Use format with UTC timezone context
  return format(date, "yyyy-MM-dd'T'HH:mm:ss'Z'", { in: tz('UTC') });
}

// ============================================================================
// CALENDAR EVENT GENERATION
// ============================================================================

/**
 * Generate calendar events from recurring meeting patterns
 * @param patterns - Array of meeting patterns
 * @param activity - Activity data
 * @param startDate - Start date for event generation
 * @param endDate - End date for event generation
 * @param exceptions - Array of calendar exceptions
 * @returns Array of calendar events
 */
export function generateEventsFromPatterns(
  patterns: any[],
  activity: any,
  startDate: Date,
  endDate: Date,
  exceptions: any[]
): any[] {
  const events: any[] = [];

  patterns.forEach((pattern) => {
    // Generate events for each pattern within the date range
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      // Check if this date matches the pattern's weekday
      const weekday = currentDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const patternWeekdays = pattern.meeting_day?.map((d: any) => d.weekday) || [];

      if (patternWeekdays.includes(weekday)) {
        // Check if this date is cancelled by an exception
        const isCancelled = exceptions.some((exception) => {
          const exceptionStart = new Date(exception.start_date);
          const exceptionEnd = new Date(exception.end_date);
          return currentDate >= exceptionStart && currentDate <= exceptionEnd;
        });

        if (!isCancelled) {
          // Create event for this date
          const dateStr = currentDate.toISOString().split('T')[0]; // Get YYYY-MM-DD from the UTC date
          const eventStart = createUTCDateTime(dateStr, pattern.start_time);
          const eventEnd = createUTCDateTime(dateStr, pattern.end_time);

          events.push({
            id: `${pattern.pattern_id}-${currentDate.toISOString().split('T')[0]}`,
            title: activity.name,
            description: activity.description,
            start: eventStart.toISOString(),
            end: eventEnd.toISOString(),
            allDay: false,
            pattern_id: pattern.pattern_id,
            activity_id: activity.id,
          });
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  // Add one-time exceptions as events
  exceptions.forEach((exception) => {
    if (exception.start_time && exception.end_time) {
      const eventStart = createUTCDateTime(exception.start_date, exception.start_time);
      const eventEnd = createUTCDateTime(exception.end_date, exception.end_time);

      events.push({
        id: `exception-${exception.exception_id}`,
        title: exception.name,
        description: exception.notes,
        start: eventStart.toISOString(),
        end: eventEnd.toISOString(),
        allDay: false,
        isException: true,
        exception_id: exception.exception_id,
      });
    }
  });

  return events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}
