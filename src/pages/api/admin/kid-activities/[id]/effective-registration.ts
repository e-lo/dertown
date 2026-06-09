// src/pages/api/admin/kid-activities/[id]/effective-registration.ts
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ params }) => {
  const { id } = params;

  if (!id) return jsonError('id is required', 400);

  const { data, error } = await supabaseAdmin
    .rpc('get_effective_registration', { activity_uuid: id });

  if (error) {
    console.error('[effective-registration]', error);
    return jsonError('Failed to fetch effective registration', 500);
  }

  const result = data?.[0] ?? null;
  return jsonResponse({
    registration: result ? {
      opens: result.registration_opens ?? null,
      closes: result.registration_closes ?? null,
      link: result.registration_link ?? null,
      info: result.registration_info ?? null,
      required: result.registration_required ?? false,
      source_id: result.source_id ?? null,
      source_level: result.source_level ?? null,
    } : null,
  });
});
