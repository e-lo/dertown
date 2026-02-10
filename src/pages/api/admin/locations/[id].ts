import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const prerender = false;

export const GET: APIRoute = async ({ params, cookies }) => {
  try {
    const { isAdmin } = await checkAdminAccess(cookies);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const id = params.id;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabaseAdmin.from('locations').select('*').eq('id', id).single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Location not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in locations [id] GET:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  try {
    const { isAdmin } = await checkAdminAccess(cookies);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const id = params.id;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json().catch(() => ({}));
    const update: Record<string, unknown> = {};

    if (typeof body.name === 'string') update.name = body.name.trim();
    if (body.status !== undefined) update.status = body.status;
    if (body.address !== undefined) update.address = body.address?.trim() || null;
    if (body.phone !== undefined) update.phone = body.phone?.trim() || null;
    if (body.website !== undefined) update.website = body.website?.trim() || null;
    if (body.parent_location_id !== undefined)
      update.parent_location_id = body.parent_location_id || null;
    if (typeof body.latitude === 'number' && typeof body.longitude === 'number') {
      update.latitude = body.latitude;
      update.longitude = body.longitude;
    } else if (body.latitude === null && body.longitude === null) {
      update.latitude = null;
      update.longitude = null;
    }

    if (Object.keys(update).length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabaseAdmin
      .from('locations')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating location:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in locations [id] PATCH:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
