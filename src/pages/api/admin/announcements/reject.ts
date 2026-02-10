import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const prerender = false;

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

    const { announcementId, reason } = await request.json();

    if (!announcementId) {
      return new Response(JSON.stringify({ error: 'Announcement ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update announcement status to archived using admin client (bypasses RLS)
    // Note: "rejected" is not a valid status, so we use "archived" instead
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .update({
        status: 'archived' as const,
        comments: reason ? `Rejected: ${reason}` : 'Rejected by admin',
      })
      .eq('id', announcementId)
      .select()
      .single();

    if (error) {
      console.error('Error rejecting announcement:', error);
      return new Response(JSON.stringify({ error: 'Failed to reject announcement' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ announcement: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in reject announcement API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
