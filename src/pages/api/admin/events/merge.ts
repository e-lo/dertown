import { supabaseAdmin } from '@/lib/supabase';
import { withSuperAdminAuth, jsonError, jsonResponse } from '@/lib/api-utils';

export const prerender = false;

type EventTable = 'events' | 'events_staged';

const VALID_TABLES: EventTable[] = ['events', 'events_staged'];

const MERGEABLE_FIELDS = [
  'title',
  'description',
  'start_date',
  'end_date',
  'start_time',
  'end_time',
  'location_id',
  'organization_id',
  'primary_tag_id',
  'secondary_tag_id',
  'email',
  'website',
  'registration_link',
  'cost',
  'external_image_url',
  'image_alt_text',
  'featured',
  'registration',
  'exclude_from_calendar',
] as const;


export const POST = withSuperAdminAuth(async ({ request }) => {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const b = body as Record<string, unknown>;

  const primaryId = typeof b.primaryId === 'string' ? b.primaryId : '';
  const primaryTable = typeof b.primaryTable === 'string' ? b.primaryTable : '';
  const secondaryId = typeof b.secondaryId === 'string' ? b.secondaryId : '';
  const secondaryTable = typeof b.secondaryTable === 'string' ? b.secondaryTable : '';
  const mergedFields =
    b.mergedFields !== null && typeof b.mergedFields === 'object' && !Array.isArray(b.mergedFields)
      ? (b.mergedFields as Record<string, unknown>)
      : null;

  // 1. Validate inputs
  if (!primaryId || !secondaryId) {
    return jsonError('primaryId and secondaryId are required', 400);
  }
  if (!VALID_TABLES.includes(primaryTable as EventTable)) {
    return jsonError('primaryTable must be "events" or "events_staged"', 400);
  }
  if (!VALID_TABLES.includes(secondaryTable as EventTable)) {
    return jsonError('secondaryTable must be "events" or "events_staged"', 400);
  }
  if (primaryId === secondaryId) {
    return jsonError('primaryId and secondaryId must not be the same', 400);
  }
  if (mergedFields === null) {
    return jsonError('mergedFields must be an object', 400);
  }

  // 2. Load both records
  const { data: primary, error: primaryError } = await supabaseAdmin
    .from(primaryTable as EventTable)
    .select('*')
    .eq('id', primaryId)
    .single();
  if (primaryError || !primary) {
    return jsonError('Primary event not found', 404);
  }

  const { data: secondary, error: secondaryError } = await supabaseAdmin
    .from(secondaryTable as EventTable)
    .select('*')
    .eq('id', secondaryId)
    .single();
  if (secondaryError || !secondary) {
    return jsonError('Secondary event not found', 404);
  }

  // 3. Build mergedData from mergeable fields
  const mergedData: Record<string, unknown> = {};
  for (const field of MERGEABLE_FIELDS) {
    const winner = mergedFields[field];
    if (winner === 'secondary') {
      mergedData[field] = secondary[field as keyof typeof secondary];
    } else {
      // default to primary
      mergedData[field] = primary[field as keyof typeof primary];
    }
  }

  // 5. If primary lacks source_id and secondary has one, copy source_id + source_title
  if (!primary.source_id && secondary.source_id) {
    mergedData.source_id = secondary.source_id;
    mergedData.source_title = secondary.source_title;
  }

  // 6. Append merge note to comments
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const secondaryTitle = typeof secondary.title === 'string' ? secondary.title : '';
  const mergeNote = `\n[Merged with: "${secondaryTitle}" on ${today}]`;
  const existingComments = typeof primary.comments === 'string' ? primary.comments : '';
  mergedData.comments = existingComments + mergeNote;

  // 4. Update primary record with mergedData
  const { error: primaryUpdateError } = await supabaseAdmin
    .from(primaryTable as EventTable)
    .update(mergedData)
    .eq('id', primaryId);

  if (primaryUpdateError) {
    console.error('Error updating primary event during merge:', primaryUpdateError);
    return jsonError(primaryUpdateError.message || 'Failed to update primary event', 500);
  }

  // 7. Archive secondary
  if (secondaryTable === 'events_staged') {
    const { error: archiveError } = await supabaseAdmin
      .from('events_staged')
      .update({
        status: 'duplicate',
        comments: `Merged into event: ${primaryId}`,
      })
      .eq('id', secondaryId);

    if (archiveError) {
      const isPastDateConstraint =
        archiveError.code === '23514' &&
        (archiveError.message || '').includes('events_staged_start_date_future');

      if (isPastDateConstraint) {
        const { error: deleteError } = await supabaseAdmin
          .from('events_staged')
          .delete()
          .eq('id', secondaryId);

        if (deleteError) {
          console.error('Error deleting staged secondary after constraint failure:', deleteError);
          return jsonError(deleteError.message || 'Failed to archive secondary staged event', 500);
        }
      } else {
        console.error('Error archiving secondary staged event:', archiveError);
        return jsonError(archiveError.message || 'Failed to archive secondary staged event', 500);
      }
    }
  } else {
    // secondaryTable === 'events'
    const { error: archiveError } = await supabaseAdmin
      .from('events')
      .update({ status: 'duplicate' })
      .eq('id', secondaryId);

    if (archiveError) {
      console.error('Error archiving secondary event:', archiveError);
      return jsonError(archiveError.message || 'Failed to archive secondary event', 500);
    }
  }

  // 8. Re-point parent_event_id from secondary to primary in both tables
  const repointTables: EventTable[] = ['events', 'events_staged'];
  for (const table of repointTables) {
    const { error: repointError } = await supabaseAdmin
      .from(table)
      .update({ parent_event_id: primaryId })
      .eq('parent_event_id', secondaryId);

    if (repointError) {
      console.error(`Error re-pointing parent_event_id in ${table}:`, repointError);
      return jsonError(
        repointError.message || `Failed to re-point parent_event_id in ${table}`,
        500
      );
    }
  }

  return jsonResponse({ success: true });
});
