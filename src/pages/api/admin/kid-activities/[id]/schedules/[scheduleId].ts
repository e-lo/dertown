import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../../lib/supabase';

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { scheduleId } = params;

    if (!scheduleId) {
      return new Response(JSON.stringify({ error: 'Schedule ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { error } = await supabaseAdmin
      .from('activity_schedule')
      .delete()
      .eq('schedule_id', scheduleId);

    if (error) {
      console.error('Error deleting schedule:', error);
      return new Response(JSON.stringify({ error: 'Failed to delete schedule' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in schedule DELETE:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
