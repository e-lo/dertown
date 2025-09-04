import type { APIRoute } from 'astro';
import { db } from '../../../../lib/supabase.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { eventId } = await request.json();

    if (!eventId) {
      return new Response(JSON.stringify({ error: 'Event ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the JWT from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          error:
            'You must be logged in as an admin to approve events. Please log in with an admin account.',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if the user is an admin (replace with your admin check logic)
    // If not admin:
    // return new Response(JSON.stringify({ error: 'Only admins can approve events. Please log in with an admin account.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });

    // Get the staged event
    const { data: stagedEvent, error: fetchError } = await db.eventsStaged.getById(eventId);

    if (fetchError || !stagedEvent) {
      return new Response(JSON.stringify({ error: 'Staged event not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let locationId = stagedEvent.location_id;
    let organizationId = stagedEvent.organization_id;

    // Handle new location if present
    if (stagedEvent.location_added) {
      console.log('[APPROVE DEBUG] Creating new location:', stagedEvent.location_added);
      const { data: newLocation, error: locationError } = await db.locations.create({
        name: stagedEvent.location_added,
        status: 'approved',
      } as any);

      if (locationError) {
        console.error('[APPROVE DEBUG] Location creation error:', locationError);
        return new Response(JSON.stringify({ error: 'Failed to create new location' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (newLocation) {
        const locationArray = newLocation as unknown as { id: string }[];
        if (locationArray && locationArray.length > 0) {
          locationId = locationArray[0].id;
          console.log('[APPROVE DEBUG] Created location with ID:', locationId);
        }
      }
    }

    // Handle new organization if present
    if (stagedEvent.organization_added) {
      console.log('[APPROVE DEBUG] Creating new organization:', stagedEvent.organization_added);
      const { data: newOrganization, error: orgError } = await db.organizations.create({
        name: stagedEvent.organization_added,
        status: 'approved',
      } as any);

      if (orgError) {
        console.error('[APPROVE DEBUG] Organization creation error:', orgError);
        return new Response(JSON.stringify({ error: 'Failed to create new organization' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (newOrganization) {
        const orgArray = newOrganization as unknown as { id: string }[];
        if (orgArray && orgArray.length > 0) {
          organizationId = orgArray[0].id;
          console.log('[APPROVE DEBUG] Created organization with ID:', organizationId);
        }
      }
    }

    // Create the approved event
    const { error: createError } = await db.events.create({
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
      parent_event_id: stagedEvent.parent_event_id,
      exclude_from_calendar: stagedEvent.exclude_from_calendar,
      registration: stagedEvent.registration,
      cost: stagedEvent.cost,
      comments: stagedEvent.comments,
      status: 'approved',
      source_id: stagedEvent.source_id,
    });

    if (createError) {
      return new Response(JSON.stringify({ error: 'Failed to create approved event' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete the staged event
    const { error: deleteError } = await db.eventsStaged.delete(eventId);

    if (deleteError) {
      console.error('Failed to delete staged event after approval:', deleteError);
      // Don't fail the request if deletion fails, as the event was already created
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in admin approve API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
