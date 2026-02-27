import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ url }) => {
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
    return jsonError('Failed to fetch organizations');
  }

  return jsonResponse(organizations);
});

export const POST = withAdminAuth(async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return jsonError('Name is required', 400);
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
    return jsonError(error.message);
  }

  return jsonResponse(data, 201);
});
