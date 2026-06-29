// src/pages/api/admin/kid-activities/[id]/merge.ts
// Merge one activity into another: reparent the source's direct children onto
// the target, then delete the now-empty source. Used to combine duplicate
// programs created by separate imports.
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withAdminAuth(async ({ request, params }) => {
  const { id } = params;
  if (!id) return jsonError('Activity ID is required', 400);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const targetId = typeof body.target_id === 'string' ? body.target_id : '';
  if (!targetId) return jsonError('target_id is required', 400);
  if (targetId === id) return jsonError('Cannot merge an activity into itself', 400);

  // Both must exist.
  const { data: rows, error: fetchErr } = await supabaseAdmin
    .from('activities')
    .select('id, name')
    .in('id', [id, targetId]);
  if (fetchErr) return jsonError(`Lookup failed: ${fetchErr.message}`, 500);
  if (!rows || rows.length < 2) return jsonError('Source or target activity not found', 404);

  // Guard against cycles: the target must not be a descendant of the source
  // (otherwise reparenting + deleting the source would orphan or loop the tree).
  const { data: childRows } = await supabaseAdmin
    .from('activities')
    .select('id')
    .eq('parent_activity_id', id);
  const childIds = (childRows ?? []).map((c) => c.id);
  let descendantIds = [...childIds];
  if (childIds.length) {
    const { data: grandRows } = await supabaseAdmin
      .from('activities')
      .select('id')
      .in('parent_activity_id', childIds);
    descendantIds = descendantIds.concat((grandRows ?? []).map((g) => g.id));
  }
  if (descendantIds.includes(targetId)) {
    return jsonError('Cannot merge an activity into one of its own children', 400);
  }

  // Reparent the source's direct children onto the target.
  const { data: moved, error: moveErr } = await supabaseAdmin
    .from('activities')
    .update({ parent_activity_id: targetId })
    .eq('parent_activity_id', id)
    .select('id');
  if (moveErr) return jsonError(`Failed to move children: ${moveErr.message}`, 500);

  // Delete the now-empty source shell.
  const { error: delErr } = await supabaseAdmin.from('activities').delete().eq('id', id);
  if (delErr) return jsonError(`Failed to delete source after moving children: ${delErr.message}`, 500);

  return jsonResponse({ ok: true, movedChildren: moved?.length ?? 0, target_id: targetId });
});
