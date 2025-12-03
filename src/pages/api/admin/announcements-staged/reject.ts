import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Check authentication
    const { isAdmin, error: authError } = await checkAdminAccess(cookies);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { announcementId } = await request.json();
    if (!announcementId) {
      return new Response(JSON.stringify({ error: 'Announcement ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete the staged announcement using admin client (bypasses RLS)
    const { error } = await supabaseAdmin
      .from('announcements_staged')
      .delete()
      .eq('id', announcementId);

    if (error) {
      console.error('Error deleting staged announcement:', error);
      return new Response(JSON.stringify({ error: 'Failed to delete staged announcement' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in admin reject announcement API:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
