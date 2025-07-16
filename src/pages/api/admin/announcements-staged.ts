import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/database';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';

export const GET: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({
        error:
          'You must be logged in as an admin to view staged announcements. Please log in with an admin account.',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient<Database>(supabaseUrl, token);
  const { data, error } = await supabase.from('announcements_staged').select('*');
  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch staged announcements' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ announcements: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
