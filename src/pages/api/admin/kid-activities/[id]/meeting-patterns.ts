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

    const { data: patterns, error } = await supabaseAdmin
      .from('meeting_pattern')
      .select(
        `
        *,
        meeting_day(*)
      `
      )
      .eq('activity_id', id)
      .order('start_time');

    if (error) {
      console.error('Error fetching meeting patterns:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch meeting patterns' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(patterns), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in meeting patterns GET:', error);
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

    // Create meeting pattern
    const { data: pattern, error: patternError } = await supabaseAdmin
      .from('meeting_pattern')
      .insert({
        activity_id: id,
        start_time,
        end_time,
        freq,
        interval,
        until,
      })
      .select()
      .single();

    if (patternError) {
      console.error('Error creating meeting pattern:', patternError);
      return new Response(JSON.stringify({ error: 'Failed to create meeting pattern' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create meeting days
    const meetingDays = weekdays.map((weekday) => ({
      pattern_id: pattern.pattern_id,
      weekday,
    }));

    const { error: daysError } = await supabaseAdmin.from('meeting_day').insert(meetingDays);

    if (daysError) {
      console.error('Error creating meeting days:', daysError);
      // Clean up the pattern if days creation fails
      await supabaseAdmin.from('meeting_pattern').delete().eq('pattern_id', pattern.pattern_id);
      return new Response(JSON.stringify({ error: 'Failed to create meeting days' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch the complete pattern with days
    const { data: completePattern, error: fetchError } = await supabaseAdmin
      .from('meeting_pattern')
      .select(
        `
        *,
        meeting_day(*)
      `
      )
      .eq('pattern_id', pattern.pattern_id)
      .single();

    if (fetchError) {
      console.error('Error fetching complete pattern:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch created pattern' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(completePattern), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in meeting patterns POST:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
