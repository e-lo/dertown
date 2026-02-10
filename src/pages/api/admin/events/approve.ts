import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Check authentication
    const { isAdmin, error: authError } = await checkAdminAccess(cookies);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { eventId } = await request.json();

    if (!eventId) {
      return new Response(JSON.stringify({ error: 'Event ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // First check if event has primary_tag_id
    const { data: event, error: fetchError } = await supabaseAdmin
      .from('events')
      .select('primary_tag_id')
      .eq('id', eventId)
      .single();

    if (fetchError || !event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!event.primary_tag_id) {
      return new Response(
        JSON.stringify({ error: 'Event must have a primary tag selected before approval' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Update event status to approved using admin client
    const { data, error } = await supabaseAdmin
      .from('events')
      .update({ status: 'approved' })
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      console.error('Error approving event:', error);
      return new Response(JSON.stringify({ error: 'Failed to approve event' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ event: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in approve event API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
