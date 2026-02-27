import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ url }) => {
  const all = url.searchParams.get('all') === 'true';
  let query = supabaseAdmin
    .from('locations')
    .select(
      'id, name, address, phone, website, latitude, longitude, parent_location_id, status, updated_at'
    )
    .order('name');

  if (!all) {
    query = query.eq('status', 'approved');
  }

  const { data: locations, error } = await query;

  if (error) {
    console.error('Error fetching locations:', error);
    return jsonError('Failed to fetch locations');
  }

  return jsonResponse(locations);
});

export const POST = withAdminAuth(async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return jsonError('Name is required', 400);
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
    return jsonError(error.message);
  }

  return jsonResponse(data, 201);
});
