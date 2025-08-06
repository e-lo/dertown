import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    const { data: locations, error } = await supabaseAdmin
      .from('locations')
      .select('id, name, address')
      .eq('status', 'approved')
      .order('name');

    if (error) {
      console.error('Error fetching locations:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch locations' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(locations), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in locations API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
