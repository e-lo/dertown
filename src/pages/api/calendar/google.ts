import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    // Fetch all approved events
    const { data: events, error } = await db.events.getAll();
    
    if (error) {
      return new Response('Error fetching events', { status: 500 });
    }

    // Generate Google Calendar URL with all events
    const googleCalendarUrl = generateGoogleCalendarUrl(events || []);

    return new Response(null, {
      status: 302,
      headers: {
        'Location': googleCalendarUrl,
      },
    });
  } catch (error) {
    console.error('Error generating Google Calendar URL:', error);
    return new Response('Internal server error', { status: 500 });
  }
};

function generateGoogleCalendarUrl(events: any[]): string {
  const baseUrl = 'https://calendar.google.com/calendar/render';
  const params = new URLSearchParams();
  
  // Add calendar name
  params.append('action', 'TEMPLATE');
  params.append('text', 'Der Town Community Events');
  params.append('details', 'Community events and activities in Der Town');
  
  // If we have events, use the first one as the template
  if (events.length > 0) {
    const firstEvent = events[0];
    const startDate = new Date(firstEvent.start_time);
    const endDate = new Date(firstEvent.end_time);
    
    // Format dates for Google Calendar (YYYYMMDDTHHMMSS)
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');
    };
    
    params.set('text', firstEvent.title);
    params.set('details', firstEvent.description || '');
    params.set('location', firstEvent.location || '');
    params.set('dates', `${formatDate(startDate)}/${formatDate(endDate)}`);
  }
  
  return `${baseUrl}?${params.toString()}`;
} 