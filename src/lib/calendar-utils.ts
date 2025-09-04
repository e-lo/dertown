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
  // Since the user is in Pacific timezone, we just create the Date object
  // and it will automatically represent the correct Pacific time
  const dateTimeStr = `${dateStr}T${time}`;
  return new Date(dateTimeStr);
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
// TIMEZONE HANDLING - PACIFIC TIMEZONE APPROACH (ALTERNATIVE)
// ============================================================================

/**
 * Convert a date and time to a Date object representing that time in Pacific timezone
 * @param dateStr - Date string (YYYY-MM-DD)
 * @param timeStr - Time string (HH:MM:SS or HH:MM)
 * @returns Date object representing the Pacific time (stored as UTC internally)
 */
export function createPacificDateTime(dateStr: string, timeStr?: string): Date {
  if (!dateStr) {
    throw new Error('Date string is required');
  }

  // If no time specified, default to start of day
  const time = timeStr || '00:00:00';

  // Create the datetime string and create a Date object
  const dateTimeStr = `${dateStr}T${time}`;
  return new Date(dateTimeStr);
}

/**
 * Parse event start and end times with Pacific timezone handling
 * @param event - Event data
 * @returns Object with startDate and endDate in Pacific timezone
 */
export function parseEventTimes(event: EventData): {
  startDate: Date;
  endDate: Date | null;
} {
  // Parse start date/time
  if (!event.start_date) {
    throw new Error('Event start date is required');
  }

  const startDate = createPacificDateTime(event.start_date, event.start_time || undefined);

  // Parse end date/time
  let endDate: Date | null = null;

  if (event.end_date && event.end_time) {
    // Both end_date and end_time specified
    endDate = createPacificDateTime(event.end_date, event.end_time);
  } else if (event.end_time) {
    // Only end_time specified, use start_date
    endDate = createPacificDateTime(event.start_date, event.end_time);
  } else if (event.end_date) {
    // Only end_date specified, use end of day
    endDate = createPacificDateTime(event.end_date, '23:59:59');
  }

  return { startDate, endDate };
}

/**
 * Get the Pacific timezone offset in minutes for a given date
 * @param date - Date to check
 * @returns Offset in minutes (negative for timezones ahead of UTC)
 */
export function getPacificTimezoneOffset(date: Date): number {
  // Check if we're in DST (March to November)
  const month = date.getMonth();
  const day = date.getDate();

  // DST starts second Sunday in March, ends first Sunday in November
  const isDST =
    (month > 2 && month < 10) ||
    (month === 2 && day >= getSecondSunday(date.getFullYear(), 2)) ||
    (month === 10 && day < getFirstSunday(date.getFullYear(), 10));

  // PST is UTC-8 (-480 minutes), PDT is UTC-7 (-420 minutes)
  return isDST ? -420 : -480;
}

/**
 * Get the day of the second Sunday in a given month/year
 */
function getSecondSunday(year: number, month: number): number {
  const firstDay = new Date(year, month, 1).getDay();
  const daysUntilFirstSunday = (7 - firstDay) % 7;
  return 1 + daysUntilFirstSunday + 7; // First Sunday + 7 days = Second Sunday
}

/**
 * Get the day of the first Sunday in a given month/year
 */
function getFirstSunday(year: number, month: number): number {
  const firstDay = new Date(year, month, 1).getDay();
  const daysUntilFirstSunday = (7 - firstDay) % 7;
  return 1 + daysUntilFirstSunday;
}

/**
 * Get the current Pacific timezone name (PST/PDT)
 */
export function getPacificTimezoneName(): string {
  const now = new Date();
  const pacificTime = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const pacificDate = new Date(pacificTime);

  // Check if we're in DST (March to November)
  const jan = new Date(pacificDate.getFullYear(), 0, 1);
  const jul = new Date(pacificDate.getFullYear(), 6, 1);

  const isDST =
    pacificDate.getTimezoneOffset() < Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());

  return isDST ? 'PDT' : 'PST';
}

// ============================================================================
// DATE FORMATTING FUNCTIONS - UTC APPROACH (RECOMMENDED)
// ============================================================================

/**
 * Format a Date object for iCal with UTC (YYYYMMDDTHHMMSSZ)
 * @param date - Date object in UTC
 * @returns Formatted string for iCal
 */
export function formatDateForICalUTC(date: Date): string {
  // For UTC-based iCal, we use the Z suffix to indicate UTC time
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

/**
 * Format a Date object for Google Calendar with UTC (YYYYMMDDTHHMMSSZ)
 * @param date - Date object in UTC
 * @returns Formatted string for Google Calendar
 */
export function formatDateForGoogleUTC(date: Date): string {
  // For Google Calendar with UTC, we use the Z suffix
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

/**
 * Format a Date object for Outlook Calendar with UTC (ISO string)
 * @param date - Date object in UTC
 * @returns ISO string for Outlook
 */
export function formatDateForOutlookUTC(date: Date): string {
  // For Outlook with UTC, we use the Z suffix
  return date.toISOString();
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
  // For iCal with TZID=America/Los_Angeles, we need to format the date
  // as if it's in Pacific timezone. The Date object represents the time
  // in the user's local timezone, so we convert it to Pacific time.

  // Get the user's current timezone offset
  const userOffset = date.getTimezoneOffset();

  // Get Pacific timezone offset for this date
  const pacificOffset = getPacificTimezoneOffset(date);

  // Calculate the time difference between user timezone and Pacific timezone
  const offsetDifference = (userOffset - pacificOffset) * 60 * 1000;

  // Create a new date representing the same wall-clock time in Pacific timezone
  const pacificTime = new Date(date.getTime() + offsetDifference);

  // Format the Pacific time
  const year = pacificTime.getFullYear();
  const month = String(pacificTime.getMonth() + 1).padStart(2, '0');
  const day = String(pacificTime.getDate()).padStart(2, '0');
  const hour = String(pacificTime.getHours()).padStart(2, '0');
  const minute = String(pacificTime.getMinutes()).padStart(2, '0');
  const second = String(pacificTime.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hour}${minute}${second}`;
}

/**
 * Format a Date object for Google Calendar with Pacific timezone (YYYYMMDDTHHMMSS)
 * @param date - Date object
 * @returns Formatted string for Google Calendar
 */
export function formatDateForGoogle(date: Date): string {
  // For Google Calendar, we format the date as if it's in Pacific timezone
  // We need to calculate what the time would be in Pacific timezone
  const pacificOffset = getPacificTimezoneOffset(date);
  const userOffset = date.getTimezoneOffset();

  // Calculate the time difference between user timezone and Pacific timezone
  const offsetDifference = (userOffset - pacificOffset) * 60 * 1000;
  const pacificTime = new Date(date.getTime() + offsetDifference);

  const year = pacificTime.getFullYear();
  const month = String(pacificTime.getMonth() + 1).padStart(2, '0');
  const day = String(pacificTime.getDate()).padStart(2, '0');
  const hour = String(pacificTime.getHours()).padStart(2, '0');
  const minute = String(pacificTime.getMinutes()).padStart(2, '0');
  const second = String(pacificTime.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hour}${minute}${second}`;
}

/**
 * Format a Date object for Outlook Calendar with Pacific timezone (ISO string with timezone)
 * @param date - Date object
 * @returns ISO string for Outlook
 */
export function formatDateForOutlook(date: Date): string {
  // For Outlook, we format the date as if it's in Pacific timezone
  // We need to calculate what the time would be in Pacific timezone
  const pacificOffset = getPacificTimezoneOffset(date);
  const userOffset = date.getTimezoneOffset();

  // Calculate the time difference between user timezone and Pacific timezone
  const offsetDifference = (userOffset - pacificOffset) * 60 * 1000;
  const pacificTime = new Date(date.getTime() + offsetDifference);

  const year = pacificTime.getFullYear();
  const month = String(pacificTime.getMonth() + 1).padStart(2, '0');
  const day = String(pacificTime.getDate()).padStart(2, '0');
  const hour = String(pacificTime.getHours()).padStart(2, '0');
  const minute = String(pacificTime.getMinutes()).padStart(2, '0');
  const second = String(pacificTime.getSeconds()).padStart(2, '0');
  const millisecond = String(pacificTime.getMilliseconds()).padStart(3, '0');

  // Format with Pacific timezone offset
  const offsetHours = Math.abs(Math.floor(pacificOffset / 60));
  const offsetMinutes = Math.abs(pacificOffset % 60);
  const offsetSign = pacificOffset <= 0 ? '+' : '-';

  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond}${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
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
          const eventStart = new Date(currentDate);
          const [startHour, startMinute] = pattern.start_time.split(':').map(Number);
          eventStart.setHours(startHour, startMinute, 0, 0);

          const eventEnd = new Date(currentDate);
          const [endHour, endMinute] = pattern.end_time.split(':').map(Number);
          eventEnd.setHours(endHour, endMinute, 0, 0);

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
      const eventStart = new Date(exception.start_date);
      const [startHour, startMinute] = exception.start_time.split(':').map(Number);
      eventStart.setHours(startHour, startMinute, 0, 0);

      const eventEnd = new Date(exception.end_date);
      const [endHour, endMinute] = exception.end_time.split(':').map(Number);
      eventEnd.setHours(endHour, endMinute, 0, 0);

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
