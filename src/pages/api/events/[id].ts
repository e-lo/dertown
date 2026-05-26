import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase.ts';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) return jsonError('Missing event id', 400);

  try {
    const { data: event, error } = await db.events.getById(id);

    if (error || !event) {
      return jsonError('Event not found', 404);
    }

    return jsonResponse({ event });
  } catch (err) {
    console.error('Error fetching event:', err);
    return jsonError('Internal server error', 500);
  }
};
