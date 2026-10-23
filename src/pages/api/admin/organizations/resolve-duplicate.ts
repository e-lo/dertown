import { supabaseAdmin } from '@/lib/supabase';
import { withSuperAdminAuth, jsonError, jsonResponse } from '@/lib/api-utils';
import { mergeEntities, MergeError } from '@/lib/entity-merge';

export const prerender = false;

// Folds a pending duplicate into an approved canonical organization, keeping the canonical's values.
export const POST = withSuperAdminAuth(async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const duplicateId = typeof body.duplicateId === 'string' ? body.duplicateId : '';
  const canonicalId = typeof body.canonicalId === 'string' ? body.canonicalId : '';

  if (!duplicateId || !canonicalId) {
    return jsonError('duplicateId and canonicalId are required', 400);
  }

  const { data: canonical } = await supabaseAdmin
    .from('organizations')
    .select('status')
    .eq('id', canonicalId)
    .maybeSingle();
  if (canonical && canonical.status !== 'approved') {
    return jsonError('Canonical organization must be approved', 400);
  }

  try {
    await mergeEntities('organization', canonicalId, duplicateId);
  } catch (error) {
    if (error instanceof MergeError) return jsonError(error.message, error.status);
    const message =
      error instanceof Error ? error.message : 'Failed to resolve duplicate organization';
    return jsonError(message, 500);
  }

  return jsonResponse({ success: true });
});
