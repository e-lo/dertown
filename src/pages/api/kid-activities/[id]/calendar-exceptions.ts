import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const { id } = params;
    const searchParams = new URL(url).searchParams;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Activity ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let query = supabase
      .from('calendar_exception')
      .select('*')
      .or(`activity_id.eq.${id},gym_wide.eq.true`);

    // Add date range filter if provided
    if (startDate && endDate) {
      query = query.lte('start_date', endDate).gte('end_date', startDate);
    }

    const { data: exceptions, error } = await query.order('start_date');

    if (error) {
      console.error('Error fetching calendar exceptions:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch calendar exceptions' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(exceptions), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in calendar exceptions GET:', error);
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
    const { name, gym_wide = false, start_date, end_date, start_time, end_time, notes } = body;

    // Validate required fields
    if (!name || !start_date || !end_date) {
      return new Response(
        JSON.stringify({ error: 'name, start_date, and end_date are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate date logic
    if (new Date(start_date) > new Date(end_date)) {
      return new Response(
        JSON.stringify({ error: 'start_date must be before or equal to end_date' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate time logic if both times are provided
    if (start_time && end_time && start_time >= end_time) {
      return new Response(JSON.stringify({ error: 'start_time must be before end_time' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create calendar exception
    const { data: exception, error } = await supabase
      .from('calendar_exception')
      .insert({
        name,
        gym_wide,
        activity_id: gym_wide ? null : id,
        start_date,
        end_date,
        start_time,
        end_time,
        notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating calendar exception:', error);
      return new Response(JSON.stringify({ error: 'Failed to create calendar exception' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(exception), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in calendar exceptions POST:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
