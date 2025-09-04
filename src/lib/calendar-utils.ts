// ============================================================================
// CALENDAR EXPORT UTILITIES
// ============================================================================
// This file handles all calendar export functionality including:
// - iCal generation
// - Google Calendar exports
// - Outlook Calendar exports
// - RSS feed generation
// - UTC-based timezone handling (recommended)
// - Pacific timezone handling with DST support (alternative)

import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

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

  // The date and time strings represent times in Pacific timezone
  // Convert Pacific time string to a Date object representing that time in 'America/Los_Angeles'
  const pacificDate = toZonedTime(`${dateStr}T${time}`, 'America/Los_Angeles');
  // toZonedTime returns a Date object with its internal UTC timestamp set to the equivalent wall-clock time in the target timezone.
  // Since we want a UTC Date object that represents the *same moment in time* as the Pacific wall-clock time,
  // we can simply return the result of toZonedTime, as JavaScript Date objects are inherently UTC.
  return pacificDate;
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

  const startDate = createUTCDateTime(event.start_date, event.start_time || undefined);

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
  }

  return { startDate, endDate };
}

// ============================================================================
// DATE FORMATTING FUNCTIONS - PACIFIC TIMEZONE APPROACH (ALTERNATIVE)
// ============================================================================

/**
 * Format a Date object for iCal with Pacific timezone (YYYYMMDDTHHMMSS)
 * @param date - Date object
 * @returns Formatted string for iCal
 */
export function formatDateForICal(date: Date): string {
  // Use formatInTimeZone to get the correct Pacific time string
  return formatInTimeZone(date, 'America/Los_Angeles', "yyyyMMdd'T'HHmmss");
}

/**
 * Format a Date object for Google Calendar with Pacific timezone (YYYYMMDDTHHMMSS)
 * @param date - Date object
 * @returns Formatted string for Google Calendar
 */
export function formatDateForGoogle(date: Date): string {
  // Use formatInTimeZone to get the correct Pacific time string
  return formatInTimeZone(date, 'America/Los_Angeles', "yyyyMMdd'T'HHmmss");
}

/**
 * Format a Date object for Outlook Calendar with Pacific timezone (ISO string with timezone)
 * @param date - Date object
 * @returns ISO string for Outlook
 */
export function formatDateForOutlook(date: Date): string {
  // Use formatInTimeZone to get the correct Pacific time string with timezone offset
  return formatInTimeZone(date, 'America/Los_Angeles', "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
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
