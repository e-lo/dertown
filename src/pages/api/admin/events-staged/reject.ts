import type { APIRoute } from 'astro';
import { db } from '../../../../lib/supabase.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { eventId } = await request.json();

    if (!eventId) {
      return new Response(JSON.stringify({ error: 'Event ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the JWT from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          error:
            'You must be logged in as an admin to reject events. Please log in with an admin account.',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if the user is an admin (replace with your admin check logic)
    // If not admin:
    // return new Response(JSON.stringify({ error: 'Only admins can reject events. Please log in with an admin account.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });

    // Update the staged event status to rejected
    const { error: updateError } = await db.eventsStaged.update(eventId, {
      status: 'rejected',
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Failed to reject event' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in admin reject API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
