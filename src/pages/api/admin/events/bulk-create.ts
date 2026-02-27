import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withAdminAuth(async ({ request }) => {
  let requestData;
  try {
    requestData = await request.json();
  } catch (parseError) {
    console.error('[BULK CREATE] JSON parse error:', parseError);
    return jsonError('Invalid JSON in request body', 400);
  }

  const { events, location_added, organization_added } = requestData;

  if (!events || !Array.isArray(events) || events.length === 0) {
    return jsonError('Events array is required and must not be empty', 400);
  }

  // Validate required fields for all events
  for (const event of events) {
    if (!event.title || !event.start_date) {
      return jsonError('Title and start date are required for all events', 400);
    }
  }

  let locationId: string | null = null;
  let organizationId: string | null = null;

  // Handle new location if present
  if (location_added && location_added.trim()) {
    const { data: newLocation, error: locationError } = await supabaseAdmin
      .from('locations')
      .insert({
        name: location_added.trim(),
        status: 'approved' as const,
      })
      .select()
      .single();

    if (locationError) {
      console.error('[BULK CREATE] Location creation error:', locationError);
      return jsonResponse(
        { error: 'Failed to create new location', details: locationError.message },
        500
      );
    }

    if (newLocation) {
      locationId = newLocation.id;
    }
  }

  // Handle new organization if present
  if (organization_added && organization_added.trim()) {
    const { data: newOrganization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: organization_added.trim(),
        status: 'approved' as const,
      })
      .select()
      .single();

    if (orgError) {
      console.error('[BULK CREATE] Organization creation error:', orgError);
      return jsonResponse(
        { error: 'Failed to create new organization', details: orgError.message },
        500
      );
    }

    if (newOrganization) {
      organizationId = newOrganization.id;
    }
  }

  // Prepare events for insertion
  const eventsToInsert = events.map((eventData: Record<string, unknown>) => {
    const cleanedData: any = {};

    // Copy all event fields
    for (const [key, value] of Object.entries(eventData)) {
      if (key === 'location_added' || key === 'organization_added') {
        continue;
      }
      // Status should be preserved as-is
      if (key === 'status') {
        cleanedData[key] = value || 'approved';
      } else if (value === '' || value === null || value === undefined) {
        cleanedData[key] = null;
      } else {
        cleanedData[key] = value;
      }
    }

    // Override location/organization if new ones were created
    if (locationId !== null) {
      cleanedData.location_id = locationId;
    }
    if (organizationId !== null) {
      cleanedData.organization_id = organizationId;
    }

    // Set default status if not provided
    if (!cleanedData.status) {
      cleanedData.status = 'approved' as const;
    }

    return cleanedData;
  });

  // Insert all events
  const { data, error } = await supabaseAdmin.from('events').insert(eventsToInsert).select(`
      *,
      primary_tag:tags!events_primary_tag_id_fkey(name),
      secondary_tag:tags!events_secondary_tag_id_fkey(name),
      location:locations!events_location_id_fkey(name, address),
      organization:organizations!events_organization_id_fkey(name)
    `);

  if (error) {
    console.error('[BULK CREATE] Error creating events:', error);
    console.error('[BULK CREATE] Events data:', JSON.stringify(eventsToInsert, null, 2));
    return jsonResponse({ error: 'Failed to create events', details: error.message }, 500);
  }

  return jsonResponse({ events: data || [], count: data?.length || 0 }, 201);
});
