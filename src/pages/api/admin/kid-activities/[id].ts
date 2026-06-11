// src/pages/api/admin/kid-activities/[id].ts
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import { stripScheduleFields } from '@/lib/activity-fields';

export const prerender = false;

export const GET = withAdminAuth(async ({ params }) => {
  const { id } = params;

  if (!id) {
    return jsonError('Activity ID is required', 400);
  }

  const { data, error } = await supabaseAdmin
    .from('activities')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[kid-activities GET]', error);
    return jsonError('Failed to fetch activity', 500);
  }
  if (!data) return jsonError('Activity not found', 404);
  return jsonResponse({ activity: data });
});

export const PUT = withAdminAuth(async ({ request, params }) => {
  const { id } = params;

  if (!id) {
    return jsonError('Activity ID is required', 400);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  // Clean empty strings to null, remove id from update payload, then drop
  // schedule-only fields (not columns on `activities`) so the form's hidden
  // schedule inputs can't break the write.
  const { id: _id, ...rest } = body;
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    cleaned[k] = v === '' ? null : v;
  }
  const payload = stripScheduleFields(cleaned);

  const { data, error } = await supabaseAdmin
    .from('activities')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[kid-activities PUT]', error);
    return jsonError(`Failed to update: ${error.message}`, 500);
  }
  return jsonResponse({ activity: data });
});

export const DELETE = withAdminAuth(async ({ params }) => {
  const { id } = params;

  if (!id) {
    return jsonError('Activity ID is required', 400);
  }

  const { error } = await supabaseAdmin
    .from('activities')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[kid-activities DELETE]', error);
    return jsonError(`Failed to delete: ${error.message}`, 500);
  }
  return jsonResponse({ ok: true });
});
