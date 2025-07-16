import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { announcementId } = await request.json();
    if (!announcementId) {
      return new Response(JSON.stringify({ error: 'Announcement ID is required' }), {
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
            'You must be logged in as an admin to reject announcements. Please log in with an admin account.',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    // TODO: Check if user is admin (implement your admin check logic here)
    // If not admin:
    // return new Response(JSON.stringify({ error: 'Only admins can reject announcements. Please log in with an admin account.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    // Delete the staged announcement
    const { error } = await db.announcementsStaged.delete(announcementId);
    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to delete staged announcement' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Optionally: log the reason or notify the submitter
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
