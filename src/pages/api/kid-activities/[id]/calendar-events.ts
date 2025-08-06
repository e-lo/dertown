import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { generateEventsFromPatterns } from '../../../../lib/calendar-utils';

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

    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: 'start_date and end_date are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch the activity
    const { data: activity, error: activityError } = await supabase
      .from('public_kid_activities')
      .select('*')
      .eq('id', id)
      .single();

    if (activityError || !activity) {
      return new Response(JSON.stringify({ error: 'Activity not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch meeting patterns for this activity
    const { data: patterns, error: patternsError } = await supabase
      .from('meeting_pattern')
      .select(
        `
        *,
        meeting_day(*)
      `
      )
      .eq('activity_id', id)
      .order('start_time');

    if (patternsError) {
      console.error('Error fetching meeting patterns:', patternsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch meeting patterns' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch calendar exceptions for this activity
    const { data: exceptions, error: exceptionsError } = await supabase
      .from('calendar_exception')
      .select('*')
      .or(`activity_id.eq.${id},gym_wide.eq.true`)
      .lte('start_date', endDate)
      .gte('end_date', startDate)
      .order('start_date');

    if (exceptionsError) {
      console.error('Error fetching calendar exceptions:', exceptionsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch calendar exceptions' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate calendar events
    const events = generateEventsFromPatterns(
      patterns || [],
      activity,
      new Date(startDate),
      new Date(endDate),
      exceptions || []
    );

    return new Response(JSON.stringify(events), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in calendar events GET:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
