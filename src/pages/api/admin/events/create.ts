import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const POST = withAdminAuth(async ({ request }) => {
  let requestData;
  try {
    requestData = await request.json();
  } catch (parseError) {
    console.error('[CREATE EVENT] JSON parse error:', parseError);
    return jsonError('Invalid JSON in request body', 400);
  }

  const { location_added, organization_added, ...eventData } = requestData;

  // Validate required fields
  if (!eventData.title || !eventData.start_date) {
    return jsonError('Title and start date are required', 400);
  }

  let locationId = eventData.location_id;
  let organizationId = eventData.organization_id;

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
      console.error('[CREATE EVENT] Location creation error:', locationError);
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
      console.error('[CREATE EVENT] Organization creation error:', orgError);
      return jsonResponse(
        { error: 'Failed to create new organization', details: orgError.message },
        500
      );
    }

    if (newOrganization) {
      organizationId = newOrganization.id;
    }
  }

  // Set the resolved IDs
  if (locationId !== undefined) {
    eventData.location_id = locationId;
  }
  if (organizationId !== undefined) {
    eventData.organization_id = organizationId;
  }

  // Convert empty strings to null for nullable fields
  const cleanedData: any = {};
  for (const [key, value] of Object.entries(eventData)) {
    if (key === 'location_added' || key === 'organization_added') {
      continue;
    }
    // Status should be preserved as-is (it's a required enum field)
    if (key === 'status') {
      cleanedData[key] = value || 'approved';
    } else if (value === '' || value === null || value === undefined) {
      cleanedData[key] = null;
    } else {
      cleanedData[key] = value;
    }
  }

  // Set default status to 'approved' if not provided
  if (!cleanedData.status) {
    cleanedData.status = 'approved' as const;
  }

  // Create the event using admin client
  const { data, error } = await supabaseAdmin
    .from('events')
    .insert(cleanedData)
    .select(
      `
      *,
      primary_tag:tags!events_primary_tag_id_fkey(name),
      secondary_tag:tags!events_secondary_tag_id_fkey(name),
      location:locations!events_location_id_fkey(name, address),
      organization:organizations!events_organization_id_fkey(name)
    `
    )
    .single();

  if (error) {
    console.error('[CREATE EVENT] Error creating event:', error);
    console.error('[CREATE EVENT] Event data:', JSON.stringify(cleanedData, null, 2));
    return jsonResponse({ error: 'Failed to create event', details: error.message }, 500);
  }

  return jsonResponse({ event: data }, 201);
});
