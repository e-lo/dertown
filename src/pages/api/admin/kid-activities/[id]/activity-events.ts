import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Activity ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get events for the activity
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('activity_events')
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
      .eq('activity_id', id)
      .order('created_at', { ascending: false });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch events' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(events), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in GET /api/admin/kid-activities/[id]/events:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Activity ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    console.log('API received event body:', body);

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

    // Validate event type specific fields
    if (event_type === 'RECURRING') {
      if (!start_time || !end_time || !weekdays || weekdays.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Recurring events require start_time, end_time, and weekdays' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    } else if (event_type === 'ONE_OFF') {
      if (!start_datetime || !end_datetime) {
        return new Response(
          JSON.stringify({ error: 'One-off events require start_datetime and end_datetime' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    let recurrence_pattern_id = null;

    // Create recurrence pattern if needed
    if (event_type === 'RECURRING') {
      const { data: pattern, error: patternError } = await supabaseAdmin
        .from('recurrence_patterns')
        .insert({
          start_time,
          end_time,
          freq: freq || 'WEEKLY',
          interval: interval || 1,
          weekdays,
          until: until && until.trim() !== '' ? until : null,
        })
        .select()
        .single();

      if (patternError) {
        console.error('Error creating recurrence pattern:', patternError);
        return new Response(JSON.stringify({ error: 'Failed to create recurrence pattern' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      recurrence_pattern_id = pattern.pattern_id;
    }

    // Create the event
    const eventData = {
      activity_id: id,
      event_type,
      name,
      description: description || null,
      recurrence_pattern_id,
      start_datetime: event_type === 'ONE_OFF' ? start_datetime : null,
      end_datetime: event_type === 'ONE_OFF' ? end_datetime : null,
      waitlist_status: waitlist_status || null,
      ignore_exceptions: ignore_exceptions || false,
    };

    const { data: event, error: eventError } = await supabaseAdmin
      .from('activity_events')
      .insert(eventData)
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
      console.error('Error creating event:', eventError);
      return new Response(JSON.stringify({ error: 'Failed to create event' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(event), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in POST /api/admin/kid-activities/[id]/events:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
