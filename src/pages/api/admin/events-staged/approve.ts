import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../../types/database';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';

export const POST: APIRoute = async ({ request }) => {
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

  try {
    const { eventId } = await request.json();
    if (!eventId) {
      return new Response(JSON.stringify({ error: 'Event ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the staged event
    const { data: stagedEvent, error: fetchError } = await supabase
      .from('events_staged')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchError || !stagedEvent) {
      return new Response(JSON.stringify({ error: 'Staged event not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Insert into events table with approved status
    const eventData = {
      ...stagedEvent,
      status: 'approved' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    delete (eventData as any).submitted_at; // Remove staged-specific field

    const { error: insertError } = await supabase
      .from('events')
      .insert(eventData);

    if (insertError) {
      return new Response(JSON.stringify({ error: 'Failed to approve event', details: insertError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete from events_staged
    const { error: deleteError } = await supabase
      .from('events_staged')
      .delete()
      .eq('id', eventId);

    if (deleteError) {
      return new Response(JSON.stringify({ error: 'Failed to remove staged event', details: deleteError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Event approved successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid request', details: String(err) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}; 