import type { APIRoute } from 'astro';
import { db } from '../../lib/supabase.ts';
import { type EventData, parseEventTimesUTC } from '../../lib/calendar-utils.ts';
import { format } from 'date-fns';
import { tz } from '@date-fns/tz';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    // Fetch all approved events (using public view that excludes private fields)
    const { data: events, error } = await db.events.getCurrentAndFuture();

    if (error) {
      return new Response('Error fetching events', { status: 500 });
    }

    // Generate RSS content
    const rssContent = generateRSSContent(events || []);

    return new Response(rssContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    return new Response('Internal server error', { status: 500 });
  }
};


function generateRSSContent(events: EventData[]): string {
  const now = new Date();
  const siteUrl = import.meta.env.SITE || 'http://www.dertown.org';

  let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Der Town Community Events</title>
    <link>${siteUrl}</link>
    <description>Community events and activities in Der Town</description>
    <language>en-US</language>
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/api/rss.xml" rel="self" type="application/rss+xml" />
`;

  events.forEach((event) => {
    try {
      // Parse event times with proper timezone handling
      const { startDate, endDate } = parseEventTimesUTC(event);

      // Skip events with invalid dates
      if (!startDate || isNaN(startDate.getTime())) {
        console.warn(
          `Skipping event ${event.id} with invalid start date: ${event.start_date} ${event.start_time}`
        );
        return;
      }

      // Clean description for XML
      const description = (event.description ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

      const title = (event.title ?? 'Untitled Event')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

      // Format dates for display in Pacific Time
      const startDateFormatted = format(startDate, 'eeee, MMMM d, yyyy', {
        in: tz('America/Los_Angeles'),
      });

      const startTimeFormatted = event.start_time
        ? format(startDate, 'h:mm a', { in: tz('America/Los_Angeles') })
        : 'All day';

      let endDateFormatted = null;
      let endTimeFormatted = null;

      if (endDate && !isNaN(endDate.getTime())) {
        endDateFormatted = format(endDate, 'eeee, MMMM d, yyyy', { in: tz('America/Los_Angeles') });
        if (event.end_time) {
          endTimeFormatted = format(endDate, 'h:mm a', { in: tz('America/Los_Angeles') });
        }
      }

      // Build description with location if available
      let fullDescription = description;
      if (event.location?.name) {
        fullDescription += `<br/><strong>Location:</strong> ${event.location.name}`;
      }
      fullDescription += `<br/><strong>Date:</strong> ${startDateFormatted} at ${startTimeFormatted}`;
      if (endDateFormatted) {
        fullDescription += `<br/><strong>Ends:</strong> ${endDateFormatted}${endTimeFormatted ? ` at ${endTimeFormatted}` : ''}`;
      }

      rss += `    <item>
      <title>${title}</title>
      <link>${event.website ?? `${siteUrl}/events/${event.id}`}</link>
      <guid>${event.id}</guid>
      <pubDate>${startDate.toUTCString()}</pubDate>
      <description><![CDATA[${fullDescription}]]></description>
    </item>
`;
    } catch (error) {
      console.warn(`Error processing event ${event.id}:`, error);
      return;
    }
  });

  rss += `  </channel>
</rss>`;

  return rss;
}
