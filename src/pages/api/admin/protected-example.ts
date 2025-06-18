import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/database';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';

export const GET: APIRoute = async ({ request }) => {
  // Get the JWT from the Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const token = authHeader.replace('Bearer ', '');

  // Create a Supabase client with the user's JWT
  const supabase = createClient<Database>(supabaseUrl, token);
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if the user is an admin using the is_admin Postgres function
  const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
  if (adminError || !isAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden: Admins only' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Return protected resource
  return new Response(JSON.stringify({ message: 'You are an admin and can access this resource.' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}; 