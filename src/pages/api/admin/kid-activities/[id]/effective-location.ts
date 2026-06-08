// src/pages/api/admin/kid-activities/[id]/effective-location.ts
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ params }) => {
  const { id } = params;

  if (!id) return jsonError('id is required', 400);

  const { data, error } = await supabaseAdmin
    .rpc('get_effective_location', { activity_uuid: id });

  if (error) {
    console.error('[effective-location]', error);
    return jsonError('Failed to fetch effective location', 500);
  }

  const result = data?.[0] ?? null;
  return jsonResponse({
    location: result?.location_name ?? null,
    location_id: result?.location_id ?? null,
    location_details: result?.location_details ?? null,
    source_level: result?.source_level ?? null,
  });
});
