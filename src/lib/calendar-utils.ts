import type { Database } from '../types/database';

type MeetingPattern = Database['public']['Tables']['meeting_pattern']['Row'] & {
  meeting_day: Database['public']['Tables']['meeting_day']['Row'][];
};

type CalendarException = Database['public']['Tables']['calendar_exception']['Row'];

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  activity_id: string;
  pattern_id?: string;
  exception_id?: string;
  isException: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps: {
    activity_name: string;
    location?: string;
    description?: string;
    registration_required?: boolean;
    registration_link?: string;
    exception_notes?: string;
  };
}

/**
 * Generate calendar events from meeting patterns for a given date range
 */
export function generateEventsFromPatterns(
  patterns: MeetingPattern[],
  activity: Database['public']['Views']['public_kid_activities']['Row'],
  startDate: Date,
  endDate: Date,
  exceptions: CalendarException[] = []
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const pattern of patterns) {
    const patternEvents = generateEventsFromPattern(pattern, activity, startDate, endDate);
    events.push(...patternEvents);
  }

  // Apply exceptions
  const eventsWithExceptions = applyExceptionsToEvents(events, exceptions);

  return eventsWithExceptions;
}

/**
 * Generate events from a single meeting pattern
 */
function generateEventsFromPattern(
  pattern: MeetingPattern,
  activity: Database['public']['Views']['public_kid_activities']['Row'],
  startDate: Date,
  endDate: Date
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  // Get the pattern start date (use activity season dates or fallback to provided start date)
  let patternStartDate = startDate;
  if (activity.season_start_month && activity.season_start_year) {
    patternStartDate = new Date(activity.season_start_year, activity.season_start_month - 1, 1);
  }

  // Get the pattern end date
  let patternEndDate = endDate;
  if (pattern.until) {
    patternEndDate = new Date(pattern.until);
  } else if (activity.season_end_month && activity.season_end_year) {
    patternEndDate = new Date(activity.season_end_year, activity.season_end_month, 0);
  }

  // Ensure we don't exceed the requested date range
  patternStartDate = new Date(Math.max(patternStartDate.getTime(), startDate.getTime()));
  patternEndDate = new Date(Math.min(patternEndDate.getTime(), endDate.getTime()));

  // Convert weekday codes to day numbers (0 = Sunday, 1 = Monday, etc.)
  const weekdayMap: Record<string, number> = {
    SU: 0,
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6,
  };

  const weekdays = pattern.meeting_day.map((day) => weekdayMap[day.weekday]);

  // Generate events for each occurrence
  const currentDate = new Date(patternStartDate);

  while (currentDate <= patternEndDate) {
    const dayOfWeek = currentDate.getDay();

    if (weekdays.includes(dayOfWeek)) {
      // Create event for this occurrence
      const eventStart = new Date(currentDate);
      const eventEnd = new Date(currentDate);

      // Set the time
      const [startHour, startMinute] = pattern.start_time.split(':').map(Number);
      const [endHour, endMinute] = pattern.end_time.split(':').map(Number);

      eventStart.setHours(startHour, startMinute, 0, 0);
      eventEnd.setHours(endHour, endMinute, 0, 0);

      const event: CalendarEvent = {
        id: `${pattern.pattern_id}-${eventStart.toISOString()}`,
        title: activity.name,
        start: eventStart,
        end: eventEnd,
        allDay: false,
        activity_id: activity.id,
        pattern_id: pattern.pattern_id,
        isException: false,
        backgroundColor: getActivityColor(activity.activity_type || undefined),
        borderColor: getActivityColor(activity.activity_type || undefined),
        textColor: '#ffffff',
        extendedProps: {
          activity_name: activity.name,
          location: activity.location_details || undefined,
          description: activity.description || undefined,
          registration_required: activity.registration_required || false,
          registration_link: activity.registration_link || undefined,
        },
      };

      events.push(event);
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return events;
}

/**
 * Apply calendar exceptions to events
 */
function applyExceptionsToEvents(
  events: CalendarEvent[],
  exceptions: CalendarException[]
): CalendarEvent[] {
  const modifiedEvents: CalendarEvent[] = [];

  for (const event of events) {
    let eventModified = false;

    for (const exception of exceptions) {
      const eventDate = new Date(event.start);
      const exceptionStart = new Date(exception.start_date);
      const exceptionEnd = new Date(exception.end_date);

      // Check if event falls within exception date range
      if (eventDate >= exceptionStart && eventDate <= exceptionEnd) {
        // Check if exception has specific time constraints
        if (exception.start_time && exception.end_time) {
          const eventStartTime = event.start.getHours() * 60 + event.start.getMinutes();
          const eventEndTime = event.end.getHours() * 60 + event.end.getMinutes();
          const exceptionStartTime =
            parseInt(exception.start_time.split(':')[0]) * 60 +
            parseInt(exception.start_time.split(':')[1]);
          const exceptionEndTime =
            parseInt(exception.end_time.split(':')[0]) * 60 +
            parseInt(exception.end_time.split(':')[1]);

          // Check if event overlaps with exception time
          if (eventStartTime < exceptionEndTime && eventEndTime > exceptionStartTime) {
            // Event is affected by exception
            const exceptionEvent: CalendarEvent = {
              ...event,
              id: `${event.id}-exception-${exception.exception_id}`,
              title: `${event.title} - ${exception.name}`,
              backgroundColor: '#ff6b6b',
              borderColor: '#ff6b6b',
              exception_id: exception.exception_id,
              isException: true,
              extendedProps: {
                ...event.extendedProps,
                exception_notes: exception.notes || undefined,
              },
            };

            modifiedEvents.push(exceptionEvent);
            eventModified = true;
            break;
          }
        } else {
          // All-day exception - event is cancelled
          eventModified = true;
          break;
        }
      }
    }

    // If event wasn't modified by any exception, add it as-is
    if (!eventModified) {
      modifiedEvents.push(event);
    }
  }

  return modifiedEvents;
}

/**
 * Get color for activity type
 */
function getActivityColor(activityType?: string): string {
  const colorMap: Record<string, string> = {
    sports: '#4CAF50',
    arts: '#9C27B0',
    academic: '#2196F3',
    outdoor: '#FF9800',
    music: '#E91E63',
    dance: '#FF5722',
    swimming: '#00BCD4',
    skiing: '#607D8B',
    soccer: '#8BC34A',
    basketball: '#FFC107',
    baseball: '#795548',
    gymnastics: '#FF4081',
    martial_arts: '#3F51B5',
    scouting: '#009688',
  };

  return colorMap[activityType?.toLowerCase() || ''] || '#757575';
}

/**
 * Generate RRULE string from meeting pattern
 */
export function generateRRule(pattern: MeetingPattern): string {
  const weekdays = pattern.meeting_day.map((day) => day.weekday).join(',');
  const interval = pattern.interval > 1 ? `;INTERVAL=${pattern.interval}` : '';
  const until = pattern.until ? `;UNTIL=${pattern.until.replace(/-/g, '')}T000000Z` : '';

  return `FREQ=${pattern.freq};BYDAY=${weekdays}${interval}${until}`;
}

/**
 * Parse RRULE string to meeting pattern data
 */
export function parseRRule(rrule: string): Partial<MeetingPattern> & { weekdays: string[] } {
  const parts = rrule.split(';');
  const pattern: Partial<MeetingPattern> & { weekdays: string[] } = { weekdays: [] };

  for (const part of parts) {
    const [key, value] = part.split('=');

    switch (key) {
      case 'FREQ':
        pattern.freq = value;
        break;
      case 'BYDAY':
        pattern.weekdays = value.split(',');
        break;
      case 'INTERVAL':
        pattern.interval = parseInt(value);
        break;
      case 'UNTIL':
        // Convert YYYYMMDDTHHMMSSZ to YYYY-MM-DD
        const dateStr = value.substring(0, 8);
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        pattern.until = `${year}-${month}-${day}`;
        break;
    }
  }

  return pattern;
}
