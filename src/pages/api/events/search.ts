import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase';

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q')?.toLowerCase() || '';
  const start_date = url.searchParams.get('start_date');
  const end_date = url.searchParams.get('end_date');
  const tag = url.searchParams.get('tag');
  const location = url.searchParams.get('location');

  const { data, error } = await db.events.getAll();
  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch events', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  let events = data || [];
  if (q) {
    events = events.filter(e =>
      e.title?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q)
    );
  }
  if (start_date) {
    events = events.filter(e => e.start_date >= start_date);
  }
  if (end_date) {
    events = events.filter(e => e.end_date && e.end_date <= end_date);
  }
  if (tag) {
    events = events.filter(e => e.primary_tag_id === tag || e.secondary_tag_id === tag);
  }
  if (location) {
    events = events.filter(e => e.location_id === location);
  }
  return new Response(JSON.stringify({ events }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}; 