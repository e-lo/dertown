import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  try {
    // Check authentication
    const { isAdmin, error: authError } = await checkAdminAccess(cookies);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get published announcements that are scheduled to show in the future
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .select('*')
      .eq('status', 'published')
      .gte('show_at', now) // show_at is in the future
      .order('show_at', { ascending: true });

    if (error) {
      console.error('Error fetching upcoming announcements:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch upcoming announcements' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ announcements: data || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in upcoming announcements API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

