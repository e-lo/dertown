// src/pages/api/admin/kid-activities.ts
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ url }) => {
  const status = url.searchParams.get('status');

  let query = supabaseAdmin
    .from('activities')
    .select('*')
    .order('name', { ascending: true });

  if (status && ['pending', 'approved', 'duplicate', 'archived', 'cancelled'].includes(status)) {
    query = query.eq('status', status as any);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[kid-activities GET]', error);
    return jsonError('Failed to fetch activities');
  }
  return jsonResponse({ activities: data ?? [] });
});

export const POST = withAdminAuth(async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  if (!body.name || !body.activity_hierarchy_type) {
    return jsonError('name and activity_hierarchy_type are required', 400);
  }

  // Clean empty strings to null
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    cleaned[k] = v === '' ? null : v;
  }
  cleaned.status = cleaned.status ?? 'pending';

  const { data, error } = await supabaseAdmin
    .from('activities')
    .insert(cleaned as any)
    .select()
    .single();

  if (error) {
    console.error('[kid-activities POST]', error);
    return jsonError(`Failed to create activity: ${error.message}`, 500);
  }
  return jsonResponse({ activity: data }, 201);
});

const VALID_STATUSES = ['pending', 'approved', 'duplicate', 'archived', 'cancelled'];

export const DELETE = withAdminAuth(async ({ url }) => {
  const status = url.searchParams.get('status');
  if (!status) return jsonError('status query param required', 400);
  if (!VALID_STATUSES.includes(status)) return jsonError(`Invalid status: ${status}`, 400);

  const { error } = await supabaseAdmin
    .from('activities')
    .delete()
    .eq('status', status as any);

  if (error) {
    console.error('[kid-activities bulk DELETE]', error);
    return jsonError(`Failed to bulk delete: ${error.message}`, 500);
  }
  return jsonResponse({ ok: true });
});
