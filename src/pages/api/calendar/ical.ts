import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase.ts';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const tagsParam = url.searchParams.get('tags');
    let tagNames: string[] = [];
    if (tagsParam) {
      tagNames = tagsParam.split(',').map((t) => decodeURIComponent(t));
    }
    // Fetch all approved events (using public view that excludes private fields)
    const { data: events, error } = await db.events.getCurrentAndFuture();

    if (error) {
      return new Response('Error fetching events', { status: 500 });
    }

    // Filter by tags if specified
    let filteredEvents = events;
    if (tagNames.length > 0) {
      filteredEvents =
        events?.filter((event: any) => {
          const primary = event.primary_tag?.name;
          const secondary = event.secondary_tag?.name;
          return tagNames.includes(primary) || tagNames.includes(secondary);
        }) || [];
    }

    // Generate iCal content
    const icalContent = generateICalContent(
      filteredEvents || [],
      tagNames.length > 0 ? tagNames[0] : null
    );

    return new Response(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="der-town-events${tagNames.length > 0 ? `-${tagNames.join('-')}` : ''}.ics"`,
      },
    });
  } catch (error) {
    console.error('Error generating iCal feed:', error);
    return new Response('Internal server error', { status: 500 });
  }
};

// Type for the event data structure
type EventData = {
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
};

function generateICalContent(events: EventData[], tagName?: string | null): string {
  const now = new Date();
  const siteUrl = import.meta.env.SITE || 'http://localhost:4321';
  const calendarId = `der-town-events-${now.getTime()}`;
  const calendarName =
    tagName && tagName !== 'all' ? `Der Town ${tagName} Events` : 'Der Town Community Events';
  const calendarDesc =
    tagName && tagName !== 'all'
      ? `${tagName} events and activities in Der Town`
      : 'Community events and activities in Der Town';

  let ical =
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Der Town//Community Events//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${calendarName}`,
      `X-WR-CALDESC:${calendarDesc}`,
      'X-WR-TIMEZONE:America/Los_Angeles',
    ].join('\r\n') + '\r\n';

  events.forEach((event, index) => {
    const eventId = `${calendarId}-${index}`;

    // Properly construct datetime strings for parsing
    const startDateTime =
      event.start_date && event.start_time
        ? `${event.start_date}T${event.start_time}`
        : event.start_date
          ? `${event.start_date}T00:00:00`
          : null;

    const endDateTime =
      event.end_date && event.end_time
        ? `${event.end_date}T${event.end_time}`
        : event.end_date
          ? `${event.end_date}T23:59:59`
          : null;

    // Parse dates safely - treat as Pacific time
    const startDate = startDateTime ? new Date(startDateTime + '-07:00') : null;
    const endDate = endDateTime ? new Date(endDateTime + '-07:00') : null;

    // Skip events with invalid dates
    if (!startDate || isNaN(startDate.getTime())) {
      console.warn(
        `Skipping event ${event.id} with invalid start date: ${event.start_date} ${event.start_time}`
      );
      return;
    }

    // Format dates for iCal (YYYYMMDDTHHMMSSZ)
    const formatDate = (date: Date) => {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hour = String(date.getUTCHours()).padStart(2, '0');
      const minute = String(date.getUTCMinutes()).padStart(2, '0');
      const second = String(date.getUTCSeconds()).padStart(2, '0');

      return `${year}${month}${day}T${hour}${minute}${second}Z`;
    };

    const eventDetailUrl = `${siteUrl}/events/${event.id}`;
    const externalUrl = event.website ?? eventDetailUrl;

    // Compose description with optional learn more link
    let description = (event.description ?? '').replace(/\n/g, '\\n');
    if (externalUrl) {
      // iCal line folding: max 75 octets per line, but for simplicity, just add the link
      description += `\\nLearn more: ${externalUrl}`;
    }
    const location = (event.location?.name ?? '').replace(/;/g, '\\;').replace(/,/g, '\\,');
    const title = (event.title ?? '').replace(/;/g, '\\;').replace(/,/g, '\\,');

    // Determine end date - if no end date/time, default to 1 hour after start
    const eventEndDate =
      endDate && !isNaN(endDate.getTime())
        ? endDate
        : new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour default

    ical +=
      [
        'BEGIN:VEVENT',
        `UID:${eventId}`,
        `DTSTAMP:${formatDate(now)}`,
        `DTSTART:${formatDate(startDate)}`,
        `DTEND:${formatDate(eventEndDate)}`,
        `SUMMARY:${title}`,
        `DESCRIPTION:${description}`,
        location ? `LOCATION:${location}` : '',
        // Always use event detail page for URL (per iCal spec)
        `URL:${eventDetailUrl}`,
        'END:VEVENT',
      ]
        .filter((line) => line !== '')
        .join('\r\n') + '\r\n';
  });

  ical += 'END:VCALENDAR\r\n';

  return ical;
}
