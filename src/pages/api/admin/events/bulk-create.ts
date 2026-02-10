import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Check authentication
    const { isAdmin, error: authError } = await checkAdminAccess(cookies);
    if (!isAdmin) {
      console.error('[BULK CREATE] Authentication failed:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let requestData;
    try {
      requestData = await request.json();
    } catch (parseError) {
      console.error('[BULK CREATE] JSON parse error:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { events, location_added, organization_added } = requestData;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Events array is required and must not be empty' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate required fields for all events
    for (const event of events) {
      if (!event.title || !event.start_date) {
        return new Response(
          JSON.stringify({ error: 'Title and start date are required for all events' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
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
        return new Response(
          JSON.stringify({
            error: 'Failed to create new location',
            details: locationError.message,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
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
        return new Response(
          JSON.stringify({
            error: 'Failed to create new organization',
            details: orgError.message,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (newOrganization) {
        organizationId = newOrganization.id;
      }
    }

    // Prepare events for insertion
    const eventsToInsert = events.map((eventData) => {
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
      return new Response(
        JSON.stringify({ error: 'Failed to create events', details: error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ events: data || [], count: data?.length || 0 }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[BULK CREATE] Unexpected error:', error);
    if (error instanceof Error) {
      console.error('[BULK CREATE] Error message:', error.message);
      console.error('[BULK CREATE] Error stack:', error.stack);
    }
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
