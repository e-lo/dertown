import type { APIRoute } from 'astro';
import { db } from '../../../lib/supabase';
import { validateEventForm } from '../../../lib/validation';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const validation = validateEventForm(data);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: validation.error.flatten() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    // Insert into events_staged
    const { error } = await db.eventsStaged.create({ ...validation.data });
    if (error) {
      return new Response(
        JSON.stringify({ error: 'Database insert failed', details: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid request', details: String(err) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
