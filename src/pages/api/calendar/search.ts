import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase.ts';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const query = url.searchParams.get('q')?.toLowerCase().trim() ?? '';

    if (query.length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: events, error } = await db.events.getAll();
    if (error || !events) {
      return new Response(JSON.stringify({ results: [] }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results = events
      .filter(e =>
        e.title?.toLowerCase().includes(query) ||
        e.location?.name?.toLowerCase().includes(query) ||
        e.organization?.name?.toLowerCase().includes(query)
      )
      .slice(0, 8)
      .map(e => ({
        id: e.id,
        title: e.title ?? '',
        start_date: e.start_date ?? '',
        start_time: e.start_time ?? null,
        primaryTag: e.primary_tag?.name ?? '',
        url: `/events/${e.id}`,
      }));

    return new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ results: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
