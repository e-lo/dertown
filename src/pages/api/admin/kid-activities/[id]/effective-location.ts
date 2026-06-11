// src/pages/api/admin/kid-activities/[id]/effective-location.ts
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

const MAX_DEPTH = 10;

/**
 * Resolve an activity's effective location by walking UP the parent chain to the
 * nearest ancestor that has a location_id (falling back to free-text
 * location_details). Implemented as a bounded app-level walk rather than the
 * recursive `get_effective_location` SQL function, which has no cycle/depth
 * guard and was 500-ing for every row. Degrades to a null location instead of
 * erroring so the admin list never 500-storms.
 */
export const GET = withAdminAuth(async ({ params }) => {
  const { id } = params;
  if (!id) return jsonError('id is required', 400);

  try {
    let currentId: string | null = id;
    let locationId: string | null = null;
    let locationDetails: string | null = null;
    let sourceLevel: string | null = null;
    let depth = 0;

    while (currentId && depth < MAX_DEPTH) {
      const { data, error } = await supabaseAdmin
        .from('activities')
        .select('location_id, location_details, parent_activity_id, activity_hierarchy_type')
        .eq('id', currentId)
        .single();

      if (error || !data) break;

      const act = data as {
        location_id: string | null;
        location_details: string | null;
        parent_activity_id: string | null;
        activity_hierarchy_type: string | null;
      };

      if (act.location_id) {
        locationId = act.location_id;
        locationDetails = act.location_details ?? locationDetails;
        sourceLevel = act.activity_hierarchy_type ?? null;
        break;
      }

      // Remember the nearest free-text location_details as a fallback.
      if (locationDetails == null && act.location_details) {
        locationDetails = act.location_details;
        sourceLevel = act.activity_hierarchy_type ?? null;
      }

      currentId = act.parent_activity_id;
      depth++;
    }

    let locationName: string | null = null;
    if (locationId) {
      const { data: loc } = await supabaseAdmin
        .from('locations')
        .select('name')
        .eq('id', locationId)
        .single();
      locationName = loc?.name ?? null;
    }

    return jsonResponse({
      location: locationName,
      location_id: locationId,
      location_details: locationDetails,
      source_level: sourceLevel,
    });
  } catch (err) {
    // Never 500 the admin list over a location lookup — log and degrade.
    console.error('[effective-location]', err);
    return jsonResponse({
      location: null,
      location_id: null,
      location_details: null,
      source_level: null,
    });
  }
});
