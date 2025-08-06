import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Activity ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Call the database function to get effective location
    const { data: effectiveLocation, error } = await supabaseAdmin.rpc('get_effective_location', {
      activity_uuid: id,
    });

    if (error) {
      console.error('Error fetching effective location:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch effective location' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Return the first (and only) result
    const location =
      effectiveLocation && effectiveLocation.length > 0 ? effectiveLocation[0] : null;

    return new Response(JSON.stringify(location), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in effective location API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
