import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const { isAdmin } = await checkAdminAccess(cookies);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const all = url.searchParams.get('all') === 'true';
    let query = supabaseAdmin
      .from('locations')
      .select('id, name, address, phone, website, latitude, longitude, parent_location_id, status')
      .order('name');

    if (!all) {
      query = query.eq('status', 'approved');
    }

    const { data: locations, error } = await query;

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

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { isAdmin } = await checkAdminAccess(cookies);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const insert: Record<string, unknown> = {
      name,
      status: body.status ?? 'approved',
      address: body.address?.trim() || null,
      phone: body.phone?.trim() || null,
      website: body.website?.trim() || null,
      parent_location_id: body.parent_location_id || null,
    };
    if (typeof body.latitude === 'number' && typeof body.longitude === 'number') {
      insert.latitude = body.latitude;
      insert.longitude = body.longitude;
    } else {
      insert.latitude = null;
      insert.longitude = null;
    }

    const { data, error } = await supabaseAdmin.from('locations').insert(insert).select().single();

    if (error) {
      console.error('Error creating location:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in locations POST:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
