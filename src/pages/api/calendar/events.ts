import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase';

export const GET: APIRoute = async () => {
  const { data, error } = await db.events.getAll();
  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch events', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return new Response(JSON.stringify({ events: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}; 