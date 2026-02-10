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

    const { eventId } = await request.json();

    if (!eventId) {
      return new Response(JSON.stringify({ error: 'Event ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the staged event using admin client (bypasses RLS)
    const { data: stagedEvent, error: fetchError } = await supabaseAdmin
      .from('events_staged')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchError || !stagedEvent) {
      return new Response(JSON.stringify({ error: 'Staged event not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate that primary_tag_id is set
    if (!stagedEvent.primary_tag_id) {
      return new Response(
        JSON.stringify({ error: 'Event must have a primary tag selected before approval' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    let locationId = stagedEvent.location_id;
    let organizationId = stagedEvent.organization_id;

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
        return new Response(JSON.stringify({ error: 'Failed to create new organization' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
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

    // Delete the staged event using admin client
    const { error: deleteError } = await supabaseAdmin
      .from('events_staged')
      .delete()
      .eq('id', eventId);

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
