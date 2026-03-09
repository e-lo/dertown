import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

const SCRAPER_APPROVED_PARENT_ID_REGEX = /\[SCRAPER_APPROVED_PARENT_ID:([0-9a-f-]{36})\]/i;

function extractScraperApprovedParentId(comments: string | null): string | null {
  if (!comments) return null;
  const match = comments.match(SCRAPER_APPROVED_PARENT_ID_REGEX);
  return match?.[1] || null;
}

export const POST = withAdminAuth(async ({ request }) => {
  const { eventId } = await request.json();

  if (!eventId) {
    return jsonError('Event ID is required', 400);
  }

  // Get the staged event using admin client (bypasses RLS)
  const { data: stagedEvent, error: fetchError } = await supabaseAdmin
    .from('events_staged')
    .select('*')
    .eq('id', eventId)
    .single();

  if (fetchError || !stagedEvent) {
    return jsonError('Staged event not found', 404);
  }

  // Validate that primary_tag_id is set
  if (!stagedEvent.primary_tag_id) {
    return jsonError('Event must have a primary tag selected before approval', 400);
  }

  let locationId = stagedEvent.location_id;
  let organizationId = stagedEvent.organization_id;
  let parentEventId = stagedEvent.parent_event_id;

  // If scraper staged comments include an approved parent marker, apply it at approval time.
  if (!parentEventId) {
    const markedApprovedParentId = extractScraperApprovedParentId(stagedEvent.comments);
    if (markedApprovedParentId) {
      const { data: approvedParent } = await supabaseAdmin
        .from('events')
        .select('id')
        .eq('id', markedApprovedParentId)
        .eq('status', 'approved')
        .is('parent_event_id', null)
        .maybeSingle();

      if (approvedParent?.id) {
        parentEventId = approvedParent.id;
      }
    }
  }

  // If parent_event_id references a staged event (not yet approved), clear it.
  // The events.parent_event_id FK references events.id, so a staged-only parent would fail.
  if (parentEventId) {
    const { data: parentInEvents } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('id', parentEventId)
      .maybeSingle();

    if (!parentInEvents) {
      parentEventId = null;
    }
  }

  // Handle new location if present
  if (stagedEvent.location_added) {
    const { data: newLocation, error: locationError } = await supabaseAdmin
      .from('locations')
      .insert({
        name: stagedEvent.location_added,
        status: 'approved',
      })
      .select()
      .single();

    if (locationError) {
      console.error('Location creation error:', locationError);
      return jsonError('Failed to create new location');
    }

    if (newLocation) {
      locationId = newLocation.id;
    }
  }

  // Handle new organization if present
  if (stagedEvent.organization_added) {
    const { data: newOrganization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: stagedEvent.organization_added,
        status: 'approved',
      })
      .select()
      .single();

    if (orgError) {
      console.error('Organization creation error:', orgError);
      return jsonError('Failed to create new organization');
    }

    if (newOrganization) {
      organizationId = newOrganization.id;
    }
  }

  // Create the approved event using admin client
  const { error: createError } = await supabaseAdmin.from('events').insert({
    title: stagedEvent.title,
    description: stagedEvent.description,
    start_date: stagedEvent.start_date,
    end_date: stagedEvent.end_date,
    start_time: stagedEvent.start_time,
    end_time: stagedEvent.end_time,
    location_id: locationId,
    organization_id: organizationId,
    email: stagedEvent.email,
    website: stagedEvent.website,
    registration_link: stagedEvent.registration_link,
    primary_tag_id: stagedEvent.primary_tag_id,
    secondary_tag_id: stagedEvent.secondary_tag_id,
    image_id: stagedEvent.image_id,
    external_image_url: stagedEvent.external_image_url,
    featured: stagedEvent.featured,
    parent_event_id: parentEventId,
    exclude_from_calendar: stagedEvent.exclude_from_calendar,
    registration: stagedEvent.registration,
    cost: stagedEvent.cost,
    comments: stagedEvent.comments,
    status: 'approved',
    source_id: stagedEvent.source_id,
    source_title: stagedEvent.source_title,
  });

  if (createError) {
    return jsonError('Failed to create approved event');
  }

  // Delete the staged event using admin client
  const { error: deleteError } = await supabaseAdmin
    .from('events_staged')
    .delete()
    .eq('id', eventId);

  if (deleteError) {
    console.error('Failed to delete staged event after approval:', deleteError);
    // Don't fail the request if deletion fails, as the event was already created
  }

  return jsonResponse({ success: true });
});
