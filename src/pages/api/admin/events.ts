import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async () => {
  // Get events that are pending (need approval) using admin client (bypasses RLS)
  // Include all pending events regardless of date, and other non-approved events that are upcoming
  const today = new Date().toISOString().split('T')[0];

  // Get pending events (all dates)
  const { data: pendingEvents, error: pendingError } = await supabaseAdmin
    .from('events')
    .select(
      `
      *,
      primary_tag:tags!events_primary_tag_id_fkey(name),
      secondary_tag:tags!events_secondary_tag_id_fkey(name),
      location:locations!events_location_id_fkey(name, address),
      organization:organizations!events_organization_id_fkey(name)
    `
    )
    .eq('status', 'pending')
    .order('start_date', { ascending: true });

  // Get other non-approved upcoming events (exclude archived)
  const { data: otherEvents, error: otherError } = await supabaseAdmin
    .from('events')
    .select(
      `
      *,
      primary_tag:tags!events_primary_tag_id_fkey(name),
      secondary_tag:tags!events_secondary_tag_id_fkey(name),
      location:locations!events_location_id_fkey(name, address),
      organization:organizations!events_organization_id_fkey(name)
    `
    )
    .neq('status', 'approved')
    .neq('status', 'pending') // Exclude pending since we already got them
    .neq('status', 'archived') // Exclude archived events
    .neq('status', 'cancelled') // Exclude cancelled events from dashboard
    .gte('start_date', today)
    .order('start_date', { ascending: true });

  const error = pendingError || otherError;
  const data = [...(pendingEvents || []), ...(otherEvents || [])];

  if (error) {
    console.error('Error fetching events:', error);
    return jsonError('Failed to fetch events');
  }

  return jsonResponse({ events: data || [] });
});

export const PUT = withAdminAuth(async ({ request }) => {
  const { id, location_added, organization_added, ...updateData } = await request.json();

  if (!id) {
    return jsonError('Event ID is required', 400);
  }

  let locationId = updateData.location_id;
  let organizationId = updateData.organization_id;

  // Handle new location if present
  if (location_added && location_added.trim()) {
    const { data: newLocation, error: locationError } = await supabaseAdmin
      .from('locations')
      .insert({
        name: location_added.trim(),
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
  if (organization_added && organization_added.trim()) {
    const { data: newOrganization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: organization_added.trim(),
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

  // Update the updateData with the resolved IDs
  if (locationId !== undefined) {
    updateData.location_id = locationId;
  }
  if (organizationId !== undefined) {
    updateData.organization_id = organizationId;
  }

  // Convert empty strings to null for nullable fields (required by database constraints)
  // Email must be either NULL or a valid email format - empty string fails the constraint
  const cleanedData: any = {};
  for (const [key, value] of Object.entries(updateData)) {
    // Skip location_added and organization_added - we've already handled them
    if (key === 'location_added' || key === 'organization_added') {
      continue;
    }
    // For email, website, registration_link, and other text fields that can be null
    if (value === '' || value === null || value === undefined) {
      cleanedData[key] = null;
    } else {
      cleanedData[key] = value;
    }
  }

  // Update the event using admin client (bypasses RLS)
  const { data, error } = await supabaseAdmin
    .from('events')
    .update(cleanedData)
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating event:', error);
    return jsonError('Failed to update event');
  }

  if (!data || data.length === 0) {
    return jsonError('Event not found', 404);
  }

  return jsonResponse({ event: data[0] });
});
