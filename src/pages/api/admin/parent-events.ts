import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  try {
    // Check authentication
    const { isAdmin, error: authError } = await checkAdminAccess(cookies);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get approved events that can be used as parent events
    // Also include staged events that don't have a parent (so they can be parents)
    // Exclude events that are already children (have a parent_event_id)
    // Order by start_date descending to show most recent first
    
    // Get approved events
    const { data: approvedEvents, error: approvedError } = await supabaseAdmin
      .from('events')
      .select('id, title, start_date, start_time')
      .eq('status', 'approved')
      .is('parent_event_id', null) // Only top-level events can be parents
      .order('start_date', { ascending: false })
      .limit(400);

    // Get staged events that don't have a parent
    const { data: stagedEvents, error: stagedError } = await supabaseAdmin
      .from('events_staged')
      .select('id, title, start_date, start_time')
      .is('parent_event_id', null)
      .order('start_date', { ascending: false })
      .limit(100);

    if (approvedError || stagedError) {
      console.error('Error fetching parent events:', approvedError || stagedError);
      return new Response(JSON.stringify({ error: 'Failed to fetch parent events' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Combine and deduplicate by ID
    const allEvents = [...(approvedEvents || []), ...(stagedEvents || [])];
    const uniqueEvents = Array.from(
      new Map(allEvents.map(event => [event.id, event])).values()
    );

    return new Response(JSON.stringify(uniqueEvents), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in parent-events API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

