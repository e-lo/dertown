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

    // Get approved events that are missing location_id or primary_tag_id
    // Query the base events table to ensure we get NULL values
    // The public_events view might filter out some NULL cases due to joins
    const { data: allApproved, error } = await supabaseAdmin
      .from('events')
      .select(`
        *,
        primary_tag:tags!events_primary_tag_id_fkey(name),
        secondary_tag:tags!events_secondary_tag_id_fkey(name),
        location:locations!events_location_id_fkey(name, address),
        organization:organizations!events_organization_id_fkey(name)
      `)
      .eq('status', 'approved')
      .gte('start_date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // Last 14 days or future
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error fetching approved events:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch incomplete events' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Filter in JavaScript: events missing location_id OR primary_tag_id
    // Check for null, undefined, or empty string
    const incomplete = (allApproved || []).filter(event => {
      const missingLocation = !event.location_id || event.location_id === null || event.location_id === '';
      const missingPrimaryTag = !event.primary_tag_id || event.primary_tag_id === null || event.primary_tag_id === '';
      return missingLocation || missingPrimaryTag;
    });

    return new Response(JSON.stringify({ events: incomplete }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in incomplete events API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

