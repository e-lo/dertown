import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ params }) => {
  const id = params.id;
  if (!id) {
    return jsonError('Missing id', 400);
  }

  const { data, error } = await supabaseAdmin.from('locations').select('*').eq('id', id).single();

  if (error || !data) {
    return jsonError('Location not found', 404);
  }

  return jsonResponse(data);
});

export const PATCH = withAdminAuth(async ({ params, request }) => {
  const id = params.id;
  if (!id) {
    return jsonError('Missing id', 400);
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
    return jsonError('No fields to update', 400);
  }

  const { data, error } = await supabaseAdmin
    .from('locations')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating location:', error);
    return jsonError(error.message);
  }

  return jsonResponse(data);
});
