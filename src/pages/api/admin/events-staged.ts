import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const { data: events, error } = await db.eventsStaged.getAll();

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
