import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../../lib/supabase';

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const { id, eventId } = params;

    if (!id || !eventId) {
      return new Response(JSON.stringify({ error: 'Activity ID and Event ID are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    console.log('API received event update body:', body);

    const {
      event_type,
      name,
      description,
      start_datetime,
      end_datetime,
      waitlist_status,
      ignore_exceptions,
      // Recurrence pattern fields
      start_time,
      end_time,
      freq,
      interval,
      weekdays,
      until,
    } = body;

    // Validate required fields
    if (!event_type || !name) {
      return new Response(JSON.stringify({ error: 'Event type and name are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the existing event to check if we need to update the recurrence pattern
    const { data: existingEvent, error: fetchError } = await supabaseAdmin
      .from('activity_events')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (fetchError || !existingEvent) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update recurrence pattern if needed
    if (event_type === 'RECURRING' && existingEvent.recurrence_pattern_id) {
      const { error: patternError } = await supabaseAdmin
        .from('recurrence_patterns')
        .update({
          start_time,
          end_time,
          freq: freq || 'WEEKLY',
          interval: interval || 1,
          weekdays,
          until,
        })
        .eq('pattern_id', existingEvent.recurrence_pattern_id);

      if (patternError) {
        console.error('Error updating recurrence pattern:', patternError);
        return new Response(JSON.stringify({ error: 'Failed to update recurrence pattern' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Update the event
    const eventData = {
      event_type,
      name,
      description: description || null,
      start_datetime: event_type === 'ONE_OFF' ? start_datetime : null,
      end_datetime: event_type === 'ONE_OFF' ? end_datetime : null,
      waitlist_status: waitlist_status || null,
      ignore_exceptions: ignore_exceptions || false,
    };

    const { data: event, error: eventError } = await supabaseAdmin
      .from('activity_events')
      .update(eventData)
      .eq('event_id', eventId)
      .select(
        `
        *,
        recurrence_patterns (
          pattern_id,
          start_time,
          end_time,
          freq,
          interval,
          weekdays,
          until
        )
      `
      )
      .single();

    if (eventError) {
      console.error('Error updating event:', eventError);
      return new Response(JSON.stringify({ error: 'Failed to update event' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(event), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in PUT /api/admin/kid-activities/[id]/events/[eventId]:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id, eventId } = params;

    if (!id || !eventId) {
      return new Response(JSON.stringify({ error: 'Activity ID and Event ID are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the event to check if it has a recurrence pattern
    const { data: event, error: fetchError } = await supabaseAdmin
      .from('activity_events')
      .select('recurrence_pattern_id')
      .eq('event_id', eventId)
      .single();

    if (fetchError) {
      console.error('Error fetching event:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch event' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete the event (this will cascade to event_exceptions)
    const { error: deleteError } = await supabaseAdmin
      .from('activity_events')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) {
      console.error('Error deleting event:', deleteError);
      return new Response(JSON.stringify({ error: 'Failed to delete event' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete the recurrence pattern if it exists
    if (event?.recurrence_pattern_id) {
      const { error: patternError } = await supabaseAdmin
        .from('recurrence_patterns')
        .delete()
        .eq('pattern_id', event.recurrence_pattern_id);

      if (patternError) {
        console.error('Error deleting recurrence pattern:', patternError);
        // Don't fail the request if pattern deletion fails
      }
    }

    return new Response(JSON.stringify({ message: 'Event deleted successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in DELETE /api/admin/kid-activities/[id]/events/[eventId]:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
