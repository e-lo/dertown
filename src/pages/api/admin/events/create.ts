import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Check authentication
    const { isAdmin, error: authError } = await checkAdminAccess(cookies);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { location_added, organization_added, ...eventData } = await request.json();

    // Validate required fields
    if (!eventData.title || !eventData.start_date) {
      return new Response(JSON.stringify({ error: 'Title and start date are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let locationId = eventData.location_id;
    let organizationId = eventData.organization_id;

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
        return new Response(JSON.stringify({ error: 'Failed to create new location' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
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
        return new Response(JSON.stringify({ error: 'Failed to create new organization' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
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
      if (value === '' || value === null || value === undefined) {
        cleanedData[key] = null;
      } else {
        cleanedData[key] = value;
      }
    }

    // Set default status to 'approved' for admin-created events
    cleanedData.status = 'approved';

    // Create the event using admin client
    const { data, error } = await supabaseAdmin
      .from('events')
      .insert(cleanedData)
      .select(`
        *,
        primary_tag:tags!events_primary_tag_id_fkey(name),
        secondary_tag:tags!events_secondary_tag_id_fkey(name),
        location:locations!events_location_id_fkey(name, address),
        organization:organizations!events_organization_id_fkey(name)
      `)
      .single();

    if (error) {
      console.error('Error creating event:', error);
      return new Response(JSON.stringify({ error: 'Failed to create event', details: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ event: data }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in create event API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

