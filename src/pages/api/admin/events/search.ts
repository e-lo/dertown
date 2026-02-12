import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const prerender = false;

/**
 * GET /api/admin/events/search?q=...
 * Returns events whose title matches the query (for autocomplete).
 * Limit 20 results.
 */
export const GET: APIRoute = async ({ url, cookies }) => {
  try {
    const { isAdmin } = await checkAdminAccess(cookies);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const q = (url.searchParams.get('q') || '').trim();
    if (!q) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabaseAdmin
      .from('events')
      .select('id, title, start_date, start_time, status')
      .ilike('title', `%${q}%`)
      .neq('status', 'cancelled')
      .order('start_date', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error searching events:', error);
      return new Response(JSON.stringify({ error: 'Failed to search events' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error in events search API:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
