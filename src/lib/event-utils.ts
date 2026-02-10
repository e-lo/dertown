/**
 * Event-specific utilities
 * Date/time formatting is handled in calendar-utils.ts
 */
import {
  createUTCDateTime,
  formatEventDate,
  formatTime,
  isToday,
  formatEventDateTime,
  localeTimeZone,
} from './calendar-utils';
import { TZDate } from '@date-fns/tz';

// Re-export date/time formatting functions for convenience
export { formatEventDate, formatTime, isToday, formatEventDateTime };

export function getEventUrl(eventId: string): string {
  return `/events/${eventId}`;
}

/**
 * Convert category name to a slug-based variant for consistent styling
 * Simple approach: known variants list with logging for unknown categories
 */
export function getCategoryBadgeVariant(
  categoryName: string
):
  | 'default'
  | 'featured'
  | 'success'
  | 'warning'
  | 'info'
  | 'white'
  | 'today'
  | 'arts-culture'
  | 'civic'
  | 'family'
  | 'nature'
  | 'outdoors'
  | 'school'
  | 'sports'
  | 'town' {
  if (!categoryName) return 'default';

  // Convert to slug: lowercase, replace spaces/special chars with hyphens
  const slug = categoryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  // Define available color variants (matching theme.css classes)
  const knownVariants = [
    'arts-culture',
    'civic',
    'family',
    'nature',
    'outdoors',
    'school',
    'sports',
    'town',
  ];

  // If the slug matches a known variant, use it
  if (knownVariants.includes(slug)) {
    return slug as
      | 'arts-culture'
      | 'civic'
      | 'family'
      | 'nature'
      | 'outdoors'
      | 'school'
      | 'sports'
      | 'town';
  }

  // Use default for unmapped categories
  return 'default';
}

/**
 * Transform event data for FullCalendar by combining dates and times
 * FullCalendar requires UTC dates, so we convert locale dates/times to UTC
 * @param event - Event data with locale date/time strings (stored in locale timezone)
 * @returns Event data formatted for FullCalendar with UTC ISO strings
 */
export function transformEventForCalendar(event: {
  id: string;
  title: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  description?: string | null;
  location?: { name: string } | null;
  primary_tag?: { name: string } | null;
  [key: string]: any;
}): {
  id: string;
  title: string;
  description?: string;
  location: string;
  category: string;
  start: string;
  end: string | null;
  allDay: boolean;
  url: string;
} | null {
  if (!event.start_date || !event.title) {
    return null; // Skip events without a start date or title
  }

  // Check if this is an all-day event
  // All-day: start_time is null or undefined (no time specified)
  // Timed event: start_time is a string, even if it's "00:00:00" (midnight is still a specific time)
  const isAllDay = event.start_time === null || event.start_time === undefined;

  let start: string;
  let end: string | null = null;

  if (isAllDay) {
    // For all-day events, send ISO 8601 strings with locale timezone offset at midnight
    // Format: '2025-12-02T00:00:00-08:00' for midnight Pacific Dec 2
    const [year, month, day] = event.start_date.split('-').map(Number);

    // Create TZDate at midnight in locale timezone
    const localeTZDate = new TZDate(year, month - 1, day, 0, 0, 0, localeTimeZone);

    // Get timezone offset
    const offsetMinutes = localeTZDate.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetMins = Math.abs(offsetMinutes) % 60;
    const offsetSign = offsetMinutes > 0 ? '-' : '+';
    const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

    // Format as ISO 8601 with locale timezone offset
    start = `${event.start_date}T00:00:00${offsetStr}`;

    // For all-day events, end should be the end_date if specified, or null
    if (event.end_date) {
      const [endYear, endMonth, endDay] = event.end_date.split('-').map(Number);
      // For end date, use midnight of the day after (exclusive end)
      const endLocaleTZDate = new TZDate(
        endYear,
        endMonth - 1,
        endDay + 1,
        0,
        0,
        0,
        localeTimeZone
      );
      const endOffsetMinutes = endLocaleTZDate.getTimezoneOffset();
      const endOffsetHours = Math.floor(Math.abs(endOffsetMinutes) / 60);
      const endOffsetMins = Math.abs(endOffsetMinutes) % 60;
      const endOffsetSign = endOffsetMinutes > 0 ? '-' : '+';
      const endOffsetStr = `${endOffsetSign}${String(endOffsetHours).padStart(2, '0')}:${String(endOffsetMins).padStart(2, '0')}`;
      end = `${event.end_date}T00:00:00${endOffsetStr}`;
    }
  } else {
    // For timed events, send ISO 8601 strings with locale timezone offset
    // Format: '2025-12-02T16:00:00-08:00' for 4pm Pacific
    // This is ISO 8601 compliant and FullCalendar can interpret it correctly

    const [year, month, day] = event.start_date.split('-').map(Number);
    const [hours, minutes, seconds] = event.start_time!.split(':').map(Number);

    // Create TZDate in locale timezone to get the correct offset
    const localeTZDate = new TZDate(
      year,
      month - 1,
      day,
      hours,
      minutes,
      seconds || 0,
      localeTimeZone
    );

    // Get timezone offset in minutes (positive for PST/PDT means we're behind UTC)
    const offsetMinutes = localeTZDate.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetMins = Math.abs(offsetMinutes) % 60;
    // ISO 8601 uses negative offset for timezones behind UTC (PST/PDT)
    const offsetSign = offsetMinutes > 0 ? '-' : '+';
    const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

    // Format as ISO 8601 with locale timezone offset
    const timeStr = event.start_time!.padEnd(8, '00').substring(0, 8);
    start = `${event.start_date}T${timeStr}${offsetStr}`;

    // Determine end date and time
    if (event.end_date && event.end_time) {
      const [endYear, endMonth, endDay] = event.end_date.split('-').map(Number);
      const [endHours, endMinutes, endSeconds] = event.end_time.split(':').map(Number);
      const endLocaleTZDate = new TZDate(
        endYear,
        endMonth - 1,
        endDay,
        endHours,
        endMinutes,
        endSeconds || 0,
        localeTimeZone
      );
      const endOffsetMinutes = endLocaleTZDate.getTimezoneOffset();
      const endOffsetHours = Math.floor(Math.abs(endOffsetMinutes) / 60);
      const endOffsetMins = Math.abs(endOffsetMinutes) % 60;
      const endOffsetSign = endOffsetMinutes > 0 ? '-' : '+';
      const endOffsetStr = `${endOffsetSign}${String(endOffsetHours).padStart(2, '0')}:${String(endOffsetMins).padStart(2, '0')}`;
      end = `${event.end_date}T${event.end_time.padEnd(8, '00').substring(0, 8)}${endOffsetStr}`;
    } else if (event.end_date) {
      const [endYear, endMonth, endDay] = event.end_date.split('-').map(Number);
      const endLocaleTZDate = new TZDate(endYear, endMonth - 1, endDay, 23, 59, 59, localeTimeZone);
      const endOffsetMinutes = endLocaleTZDate.getTimezoneOffset();
      const endOffsetHours = Math.floor(Math.abs(endOffsetMinutes) / 60);
      const endOffsetMins = Math.abs(endOffsetMinutes) % 60;
      const endOffsetSign = endOffsetMinutes > 0 ? '-' : '+';
      const endOffsetStr = `${endOffsetSign}${String(endOffsetHours).padStart(2, '0')}:${String(endOffsetMins).padStart(2, '0')}`;
      end = `${event.end_date}T23:59:59${endOffsetStr}`;
    } else if (event.end_time) {
      const [endHours, endMinutes, endSeconds] = event.end_time.split(':').map(Number);
      const endLocaleTZDate = new TZDate(
        year,
        month - 1,
        day,
        endHours,
        endMinutes,
        endSeconds || 0,
        localeTimeZone
      );
      const endOffsetMinutes = endLocaleTZDate.getTimezoneOffset();
      const endOffsetHours = Math.floor(Math.abs(endOffsetMinutes) / 60);
      const endOffsetMins = Math.abs(endOffsetMinutes) % 60;
      const endOffsetSign = endOffsetMinutes > 0 ? '-' : '+';
      const endOffsetStr = `${endOffsetSign}${String(endOffsetHours).padStart(2, '0')}:${String(endOffsetMins).padStart(2, '0')}`;
      end = `${event.start_date}T${event.end_time.padEnd(8, '00').substring(0, 8)}${endOffsetStr}`;
    } else {
      // If we have start time but no end time, assume 1 hour duration
      const endTimeStr = calculateEndTime(event.start_time!);
      const [endHours, endMinutes] = endTimeStr.split(':').map(Number);
      const endLocaleTZDate = new TZDate(
        year,
        month - 1,
        day,
        endHours,
        endMinutes,
        0,
        localeTimeZone
      );
      const endOffsetMinutes = endLocaleTZDate.getTimezoneOffset();
      const endOffsetHours = Math.floor(Math.abs(endOffsetMinutes) / 60);
      const endOffsetMins = Math.abs(endOffsetMinutes) % 60;
      const endOffsetSign = endOffsetMinutes > 0 ? '-' : '+';
      const endOffsetStr = `${endOffsetSign}${String(endOffsetHours).padStart(2, '0')}:${String(endOffsetMins).padStart(2, '0')}`;
      end = `${event.start_date}T${endTimeStr.padEnd(8, '00').substring(0, 8)}${endOffsetStr}`;
    }
  }

  return {
    id: event.id,
    title: event.title,
    description: event.description || undefined,
    location: event.location?.name || '',
    category: event.primary_tag?.name || '',
    start: start,
    end: end,
    allDay: isAllDay, // Mark as all-day if no start time
    url: `/events/${event.id}`, // Add URL for event click navigation
  };
}

// Helper function to calculate end time for 1-hour duration
function calculateEndTime(startTime: string): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const date = new Date();
  date.setUTCHours(hours, minutes, 0, 0);
  date.setUTCHours(date.getUTCHours() + 1);
  const endHours = String(date.getUTCHours()).padStart(2, '0');
  const endMinutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${endHours}:${endMinutes}:00`;
}
