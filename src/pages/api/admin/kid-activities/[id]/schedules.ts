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

    const { data: schedules, error } = await supabaseAdmin
      .from('activity_schedule')
      .select('*')
      .eq('activity_id', id)
      .order('start_time');

    if (error) {
      console.error('Error fetching schedules:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch schedules' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(schedules), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in schedules GET:', error);
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
    const { name, start_time, end_time, max_capacity, waitlist_available } = body;

    // Validate required fields
    if (!name || !start_time || !end_time) {
      return new Response(
        JSON.stringify({ error: 'name, start_time, and end_time are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create schedule
    const { data: schedule, error } = await supabaseAdmin
      .from('activity_schedule')
      .insert({
        activity_id: id,
        name,
        start_time,
        end_time,
        max_capacity,
        waitlist_available: waitlist_available || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating schedule:', error);
      return new Response(JSON.stringify({ error: 'Failed to create schedule' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(schedule), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in schedules POST:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
