import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async (_) => {
  const { data, error } = await db.admin.getEventsWithPrivateFields();

  if (error) {
    console.error('Database error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch staged events' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ events: data || [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
