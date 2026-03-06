import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonError, jsonResponse } from '@/lib/api-utils';

export const prerender = false;

async function repointLocationReferences(fromId: string, toId: string): Promise<void> {
  const updates: Array<{ table: string; column: string }> = [
    { table: 'events', column: 'location_id' },
    { table: 'events_staged', column: 'location_id' },
    { table: 'organizations', column: 'location_id' },
    { table: 'locations', column: 'parent_location_id' },
    { table: 'activities', column: 'location_id' },
  ];

  for (const update of updates) {
    const { error } = await supabaseAdmin
      .from(update.table)
      .update({ [update.column]: toId })
      .eq(update.column, fromId);

    if (error) {
      throw new Error(`Failed to update ${update.table}.${update.column}: ${error.message}`);
    }
  }
}

export const POST = withAdminAuth(async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const duplicateId = typeof body.duplicateId === 'string' ? body.duplicateId : '';
  const canonicalId = typeof body.canonicalId === 'string' ? body.canonicalId : '';

  if (!duplicateId || !canonicalId) {
    return jsonError('duplicateId and canonicalId are required', 400);
  }
  if (duplicateId === canonicalId) {
    return jsonError('duplicateId and canonicalId must be different', 400);
  }

  const { data: duplicate, error: duplicateError } = await supabaseAdmin
    .from('locations')
    .select('id, status')
    .eq('id', duplicateId)
    .single();
  if (duplicateError || !duplicate) {
    return jsonError('Duplicate location not found', 404);
  }

  const { data: canonical, error: canonicalError } = await supabaseAdmin
    .from('locations')
    .select('id, status')
    .eq('id', canonicalId)
    .single();
  if (canonicalError || !canonical) {
    return jsonError('Canonical location not found', 404);
  }
  if (canonical.status !== 'approved') {
    return jsonError('Canonical location must be approved', 400);
  }

  try {
    await repointLocationReferences(duplicateId, canonicalId);

    const { error: archiveError } = await supabaseAdmin
      .from('locations')
      .update({
        status: 'archived',
        parent_location_id: canonicalId,
      })
      .eq('id', duplicateId);

    if (archiveError) {
      throw new Error(`Failed to archive duplicate location: ${archiveError.message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve duplicate location';
    return jsonError(message, 500);
  }

  return jsonResponse({ success: true });
});
