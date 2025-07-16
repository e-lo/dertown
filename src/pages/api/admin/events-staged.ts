import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/database';

export const prerender = false;

const supabaseUrl = import.meta.env.SUPABASE_URL || 'http://127.0.0.1:54321';

export const GET: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({
        error:
          'You must be logged in as an admin to view staged events. Please log in with an admin account.',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient<Database>(supabaseUrl, token);
  try {
    const { data: events, error } = await supabase.from('events_staged').select(`
        *,
        location:locations(name),
        organization:organizations(name)
      `);
    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch staged events' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ events: events || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in admin events-staged API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
