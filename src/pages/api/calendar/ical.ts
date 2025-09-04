import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase.ts';
import { parseEventTimesUTC, formatDateForICalUTC } from '../../../lib/calendar-utils.ts';

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

    // Generate iCal content with UTC timezone
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
    ].join('\r\n') + '\r\n';

  events.forEach((event, index) => {
    try {
      const eventId = `${calendarId}-${index}`;

      // Parse event times with UTC timezone handling (recommended approach)
      const { startDate, endDate } = parseEventTimesUTC(event);

      // Skip events with invalid dates
      if (!startDate || isNaN(startDate.getTime())) {
        console.warn(
          `Skipping event ${event.id} with invalid start date: ${event.start_date} ${event.start_time}`
        );
        return;
      }

      const eventDetailUrl = `${siteUrl}/events/${event.id}`;
      const externalUrl = event.website ?? eventDetailUrl;

      // Compose description with optional learn more link
      let description = (event.description ?? '').replace(/\n/g, '\\n');
      if (externalUrl) {
        // iCal line folding: max 75 octets per line, but for simplicity, just add the link
        description += `\\nLearn more: ${externalUrl}`;
      }
      const location = (event.location?.name ?? '').replace(/;/g, '\\;').replace(/,/g, '\\,');
      const title = (event.title ?? 'Untitled Event').replace(/;/g, '\\;').replace(/,/g, '\\,');

      // Determine end date - if no end date/time, default to 1 hour after start
      const eventEndDate =
        endDate && !isNaN(endDate.getTime())
          ? endDate
          : new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour default

      ical +=
        [
          'BEGIN:VEVENT',
          `UID:${eventId}`,
          `DTSTAMP:${formatDateForICalUTC(now)}`,
          `DTSTART:${formatDateForICalUTC(startDate)}`,
          `DTEND:${formatDateForICalUTC(eventEndDate)}`,
          `SUMMARY:${title}`,
          `DESCRIPTION:${description}`,
          location ? `LOCATION:${location}` : '',
          // Always use event detail page for URL (per iCal spec)
          `URL:${eventDetailUrl}`,
          'END:VEVENT',
        ]
          .filter((line) => line !== '')
          .join('\r\n') + '\r\n';
    } catch (error) {
      console.warn(`Error processing event ${event.id}:`, error);
      return;
    }
  });

  ical += 'END:VCALENDAR\r\n';

  return ical;
}
