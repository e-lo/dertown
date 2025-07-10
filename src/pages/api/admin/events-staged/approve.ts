import type { APIRoute } from 'astro';
import { db } from '../../../../lib/supabase';

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

    // Get the staged event
    const { data: stagedEvent, error: fetchError } = await db.eventsStaged.getById(eventId);

    if (fetchError || !stagedEvent) {
      return new Response(JSON.stringify({ error: 'Staged event not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create the approved event
    const { error: createError } = await db.events.create({
      title: stagedEvent.title,
      description: stagedEvent.description,
      start_date: stagedEvent.start_date,
      end_date: stagedEvent.end_date,
      start_time: stagedEvent.start_time,
      end_time: stagedEvent.end_time,
      location_id: stagedEvent.location_id,
      organization_id: stagedEvent.organization_id,
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
      google_calendar_event_id: stagedEvent.google_calendar_event_id,
      registration: stagedEvent.registration,
      cost: stagedEvent.cost,
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
