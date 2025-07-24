import type { APIRoute } from 'astro';
import { db } from '../../lib/supabase.ts';

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

// Type for the event data structure
type EventData = {
  id: string;
  title: string;
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
    // Properly construct datetime strings for parsing
    const startDateTime = event.start_date && event.start_time 
      ? `${event.start_date}T${event.start_time}`
      : event.start_date 
        ? `${event.start_date}T00:00:00`
        : null;
    
    const endDateTime = event.end_date && event.end_time
      ? `${event.end_date}T${event.end_time}`
      : event.end_date
        ? `${event.end_date}T23:59:59`
        : null;

    // Parse dates safely
    const startDate = startDateTime ? new Date(startDateTime) : null;
    const endDate = endDateTime ? new Date(endDateTime) : null;

    // Skip events with invalid dates
    if (!startDate || isNaN(startDate.getTime())) {
      console.warn(`Skipping event ${event.id} with invalid start date: ${event.start_date} ${event.start_time}`);
      return;
    }

    // Clean description for XML
    const description = (event.description ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const title = (event.title ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    // Format dates for display
    const startDateFormatted = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const startTimeFormatted = event.start_time 
      ? startDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      : 'All day';

    const endDateFormatted = endDate && !isNaN(endDate.getTime())
      ? endDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : null;

    const endTimeFormatted = endDate && event.end_time && !isNaN(endDate.getTime())
      ? endDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      : null;

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
  });

  rss += `  </channel>
</rss>`;

  return rss;
}
