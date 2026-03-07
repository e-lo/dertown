import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;
const APPROVED_PARENT_MARKER_REGEX = /\[SCRAPER_APPROVED_PARENT_ID:[0-9a-f-]{36}\]/gi;

function applyApprovedParentMarker(
  comments: string | null | undefined,
  approvedParentId: string
): string {
  const cleaned = (comments || '').replace(APPROVED_PARENT_MARKER_REGEX, '').trim();
  const marker = `[SCRAPER_APPROVED_PARENT_ID:${approvedParentId}]`;
  return cleaned ? `${cleaned}\n${marker}` : marker;
}

function stripApprovedParentMarker(comments: string | null | undefined): string | null {
  const cleaned = (comments || '').replace(APPROVED_PARENT_MARKER_REGEX, '').trim();
  return cleaned || null;
}

export const PUT = withAdminAuth(async ({ request }) => {
  const { id, ...updateData } = await request.json();

  if (!id) {
    return jsonError('Event ID is required', 400);
  }

  const { data: currentEvent, error: currentEventError } = await supabaseAdmin
    .from('events_staged')
    .select('id, comments')
    .eq('id', id)
    .single();

  if (currentEventError || !currentEvent) {
    return jsonError('Event not found', 404);
  }

  let approvedParentId: string | null = null;
  if (updateData.parent_event_id) {
    const { data: stagedParent } = await supabaseAdmin
      .from('events_staged')
      .select('id')
      .eq('id', updateData.parent_event_id)
      .eq('status', 'pending')
      .single();

    if (!stagedParent) {
      const { data: approvedParent } = await supabaseAdmin
        .from('events')
        .select('id')
        .eq('id', updateData.parent_event_id)
        .eq('status', 'approved')
        .is('parent_event_id', null)
        .maybeSingle();

      if (approvedParent?.id) {
        approvedParentId = approvedParent.id;
        // events_staged.parent_event_id can only point to events_staged rows.
        updateData.parent_event_id = null;
      } else {
        return jsonError(
          'Parent event must be an approved top-level event or pending staged event',
          400
        );
      }
    }
  }

  if (approvedParentId) {
    const baseComments =
      typeof updateData.comments === 'string' ? updateData.comments : currentEvent.comments;
    updateData.comments = applyApprovedParentMarker(baseComments, approvedParentId);
  } else if (Object.prototype.hasOwnProperty.call(updateData, 'parent_event_id')) {
    // Parent selection was explicitly changed/cleared — remove any prior approved-parent marker.
    const baseComments =
      typeof updateData.comments === 'string' ? updateData.comments : currentEvent.comments;
    updateData.comments = stripApprovedParentMarker(baseComments);
    if (!updateData.parent_event_id && updateData.comments === null) {
      // Keep comments as empty string so normal cleaner can coerce to null.
      updateData.comments = '';
    }
  }

  if (updateData.parent_event_id) {
    const { data: stagedParent, error: parentError } = await supabaseAdmin
      .from('events_staged')
      .select('id')
      .eq('id', updateData.parent_event_id)
      .eq('status', 'pending')
      .single();

    if (parentError || !stagedParent) {
      return jsonError(
        'Parent event must be selected from pending staged events when editing a staged event',
        400
      );
    }
  }

  // Convert empty strings to null for nullable fields (required by database constraints)
  // Email must be either NULL or a valid email format - empty string fails the constraint
  const cleanedData: any = {};
  for (const [key, value] of Object.entries(updateData)) {
    // For email, website, registration_link, and other text fields that can be null
    if (value === '' || value === null || value === undefined) {
      cleanedData[key] = null;
    } else {
      cleanedData[key] = value;
    }
  }

  // Update the staged event using admin client (bypasses RLS)
  const { data, error } = await supabaseAdmin
    .from('events_staged')
    .update(cleanedData)
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating staged event:', error);
    return jsonError(error.message || 'Failed to update event');
  }

  if (!data || data.length === 0) {
    return jsonError('Event not found', 404);
  }

  return jsonResponse({ event: data[0] });
});
