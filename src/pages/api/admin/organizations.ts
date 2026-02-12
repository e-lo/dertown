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
      .from('organizations')
      .select(
        'id, name, description, email, phone, website, location_id, parent_organization_id, status, updated_at'
      )
      .order('name');

    if (!all) {
      query = query.eq('status', 'approved');
    }

    const { data: organizations, error } = await query;

    if (error) {
      console.error('Error fetching organizations:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch organizations' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(organizations), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in organizations API:', error);
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

    const insert = {
      name,
      status: body.status ?? 'approved',
      description: body.description?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      website: body.website?.trim() || null,
      location_id: body.location_id || null,
      parent_organization_id: body.parent_organization_id || null,
    };

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .insert(insert)
      .select()
      .single();

    if (error) {
      console.error('Error creating organization:', error);
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
    console.error('Error in organizations POST:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
