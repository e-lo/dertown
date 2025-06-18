import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/database';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';

export const GET: APIRoute = async ({ request }) => {
  // Check authentication and admin status
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient<Database>(supabaseUrl, token);
  
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
  if (adminError || !isAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden: Admins only' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get all staged events
  const { data: stagedEvents, error } = await supabase
    .from('events_staged')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch staged events', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ events: stagedEvents }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}; 