import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../../lib/supabase';

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const { id, patternId } = params;

    if (!id || !patternId) {
      return new Response(JSON.stringify({ error: 'Activity ID and Pattern ID are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { start_time, end_time, freq = 'WEEKLY', interval = 1, until, weekdays } = body;

    // Validate required fields
    if (!start_time || !end_time || !weekdays || !Array.isArray(weekdays)) {
      return new Response(
        JSON.stringify({ error: 'start_time, end_time, and weekdays array are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate weekdays
    const validWeekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
    if (!weekdays.every((day) => validWeekdays.includes(day))) {
      return new Response(JSON.stringify({ error: 'Invalid weekday values' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update meeting pattern
    const { data: pattern, error: patternError } = await supabaseAdmin
      .from('meeting_pattern')
      .update({
        start_time,
        end_time,
        freq,
        interval,
        until,
      })
      .eq('pattern_id', patternId)
      .eq('activity_id', id)
      .select()
      .single();

    if (patternError) {
      console.error('Error updating meeting pattern:', patternError);
      return new Response(JSON.stringify({ error: 'Failed to update meeting pattern' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete existing meeting days
    const { error: deleteDaysError } = await supabaseAdmin
      .from('meeting_day')
      .delete()
      .eq('pattern_id', patternId);

    if (deleteDaysError) {
      console.error('Error deleting existing meeting days:', deleteDaysError);
      return new Response(JSON.stringify({ error: 'Failed to update meeting days' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create new meeting days
    const meetingDays = weekdays.map((weekday) => ({
      pattern_id: patternId,
      weekday,
    }));

    const { error: daysError } = await supabaseAdmin.from('meeting_day').insert(meetingDays);

    if (daysError) {
      console.error('Error creating meeting days:', daysError);
      return new Response(JSON.stringify({ error: 'Failed to update meeting days' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch the complete updated pattern with days
    const { data: completePattern, error: fetchError } = await supabaseAdmin
      .from('meeting_pattern')
      .select(
        `
        *,
        meeting_day(*)
      `
      )
      .eq('pattern_id', patternId)
      .single();

    if (fetchError) {
      console.error('Error fetching updated pattern:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch updated pattern' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(completePattern), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in meeting pattern PUT:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id, patternId } = params;

    if (!id || !patternId) {
      return new Response(JSON.stringify({ error: 'Activity ID and Pattern ID are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete meeting days first (due to foreign key constraint)
    const { error: daysError } = await supabaseAdmin
      .from('meeting_day')
      .delete()
      .eq('pattern_id', patternId);

    if (daysError) {
      console.error('Error deleting meeting days:', daysError);
      return new Response(JSON.stringify({ error: 'Failed to delete meeting days' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete the pattern
    const { error: patternError } = await supabaseAdmin
      .from('meeting_pattern')
      .delete()
      .eq('pattern_id', patternId)
      .eq('activity_id', id);

    if (patternError) {
      console.error('Error deleting meeting pattern:', patternError);
      return new Response(JSON.stringify({ error: 'Failed to delete meeting pattern' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in meeting pattern DELETE:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
