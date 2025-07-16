/**
 * Date and time formatting utilities
 */

export function formatEventDate(date: string | Date): {
  month: string;
  day: string;
  dayOfWeek: string;
} {
  const eventDate = new Date(date);
  return {
    month: eventDate.toLocaleDateString('en-US', { month: 'short' }),
    day: eventDate.toLocaleDateString('en-US', { day: 'numeric' }),
    dayOfWeek: eventDate.toLocaleDateString('en-US', { weekday: 'short' }),
  };
}

export function formatTime(time: string): string {
  return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function isToday(date: string | Date): boolean {
  const today = new Date();
  const eventDate = new Date(date);
  return today.toDateString() === eventDate.toDateString();
}

export function getEventUrl(eventId: string): string {
  return `/events/${eventId}`;
}

/**
 * Map category name to badge variant for consistent styling
 */
export function getCategoryBadgeVariant(
  categoryName: string
):
  | 'default'
  | 'arts-culture'
  | 'civic'
  | 'family'
  | 'nature'
  | 'outdoors'
  | 'school'
  | 'sports'
  | 'town' {
  //console.log('getCategoryBadgeVariant called with:', categoryName);

  const categoryMap: Record<
    string,
    | 'default'
    | 'arts-culture'
    | 'civic'
    | 'family'
    | 'nature'
    | 'outdoors'
    | 'school'
    | 'sports'
    | 'town'
  > = {
    'Arts+Culture': 'arts-culture',
    Civic: 'civic',
    Family: 'family',
    Nature: 'nature',
    Outdoors: 'outdoors',
    School: 'school',
    Sports: 'sports',
    Town: 'town',
  };

  const result = categoryMap[categoryName] || 'default';
  console.log('getCategoryBadgeVariant result:', result);
  return result;
}

/**
 * Transform event data for FullCalendar by combining dates and times
 * and handling cases where end times are not provided
 */
export function transformEventForCalendar(event: {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  location: { name: string } | null;
  primary_tag: { name: string } | null;
}): {
  id: string;
  title: string;
  description?: string;
  location: string;
  category: string;
  start: string;
  end: string | null;
} {
  // Combine date and time for start
  let start = event.start_date;
  if (event.start_time) {
    start = `${event.start_date}T${event.start_time}`;
  }

  // Combine date and time for end (if both exist)
  let end = null;
  if (event.end_date && event.end_time) {
    end = `${event.end_date}T${event.end_time}`;
  } else if (event.end_date) {
    end = event.end_date;
  } else if (event.start_time && !event.end_time) {
    // If we have start time but no end time, assume 1 hour duration
    const startDate = new Date(start);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour
    end = endDate.toISOString();
  }

  return {
    id: event.id,
    title: event.title,
    description: event.description || undefined,
    location: event.location?.name || '',
    category: event.primary_tag?.name || '',
    start: start,
    end: end,
  };
}

/**
 * Filter events to only those in the future (including today)
 */
export function filterFutureEvents(
  events: {
    start_date: string;
    start_time: string | null;
    end_date: string | null;
    end_time: string | null;
  }[]
): {
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
}[] {
  const now = new Date();
  return events.filter((e) => {
    const startDate = new Date(e.start_date + (e.start_time ? 'T' + e.start_time : ''));
    // If end_date or end_time exists, use it for comparison
    let endDate: Date | null = null;
    if (e.end_date) {
      endDate = new Date(e.end_date + (e.end_time ? 'T' + e.end_time : ''));
    } else if (e.end_time) {
      // If only end_time exists, use start_date with end_time
      endDate = new Date(e.start_date + 'T' + e.end_time);
    }
    // Show if event hasn't started yet, or is ongoing (endDate in future)
    if (endDate) {
      return endDate >= now;
    } else {
      // If event has a time, compare full datetime; otherwise, compare date only
      if (e.start_time) {
        return startDate >= now;
      } else {
        return startDate.toDateString() >= now.toDateString();
      }
    }
  });
}

// Format event date/time as 'Fri June 5th at 5:00PM'
export function formatEventDateTime(event: {
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
}): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
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
  const start = new Date(event.start_date + (event.start_time ? 'T' + event.start_time : ''));
  const end = event.end_date
    ? new Date(event.end_date + (event.end_time ? 'T' + event.end_time : ''))
    : null;
  const day = days[start.getDay()];
  const month = months[start.getMonth()];
  const date = ordinal(start.getDate());
  const time = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  let result = `${day} ${month} ${date} at ${time}`;
  if (end && end.toDateString() !== start.toDateString()) {
    const endDay = days[end.getDay()];
    const endMonth = months[end.getMonth()];
    const endDate = ordinal(end.getDate());
    const endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    result += ` – ${endDay} ${endMonth} ${endDate} at ${endTime}`;
  } else if (end && event.end_time) {
    const endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    result += ` – ${endTime}`;
  }
  return result;
}
