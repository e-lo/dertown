import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  try {
    // For Outlook, we'll redirect to the iCal feed which Outlook can subscribe to
    // The user can then subscribe to this URL in Outlook
    const icalUrl = new URL('/api/calendar/ical', import.meta.env.SITE || 'http://localhost:4321');
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': icalUrl.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating Outlook Calendar URL:', error);
    return new Response('Internal server error', { status: 500 });
  }
}; 