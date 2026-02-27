import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ params }) => {
  const id = params.id;
  if (!id) {
    return jsonError('Missing id', 400);
  }

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return jsonError('Organization not found', 404);
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
  if (body.description !== undefined) update.description = body.description?.trim() || null;
  if (body.email !== undefined) update.email = body.email?.trim() || null;
  if (body.phone !== undefined) update.phone = body.phone?.trim() || null;
  if (body.website !== undefined) update.website = body.website?.trim() || null;
  if (body.location_id !== undefined) update.location_id = body.location_id || null;
  if (body.parent_organization_id !== undefined)
    update.parent_organization_id = body.parent_organization_id || null;

  if (Object.keys(update).length === 0) {
    return jsonError('No fields to update', 400);
  }

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating organization:', error);
    return jsonError(error.message);
  }

  return jsonResponse(data);
});
