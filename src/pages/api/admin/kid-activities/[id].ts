import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../../types/database';

const supabaseUrl = import.meta.env.SUPABASE_URL || 'http://127.0.0.1:54321';

// Function to check authentication and admin status
async function checkAuth(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 };
  }
  const token = authHeader.replace('Bearer ', '');

  // Create a Supabase client with the user's JWT
  const supabase = createClient<Database>(supabaseUrl, token);
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: 'Invalid or expired token', status: 401 };
  }

  // Check if the user is an admin using the is_admin Postgres function
  const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
  if (adminError || !isAdmin) {
    return { error: 'Forbidden: Admins only', status: 403 };
  }

  return { supabase, user };
}

export const GET: APIRoute = async ({ params, request }) => {
  try {
    // Check authentication
    const authResult = await checkAuth(request);
    if ('error' in authResult) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { supabase } = authResult;
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Activity ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: activity, error } = await supabase
      .from('kid_activities')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching activity:', error);
      return new Response(JSON.stringify({ error: 'Activity not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(activity), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in activity GET:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    // Check authentication
    const authResult = await checkAuth(request);
    if ('error' in authResult) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { supabase } = authResult;
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Activity ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    console.log('PUT request body:', body); // Debug log

    // Validate required fields - allow empty names for CLASS_INSTANCE and SESSION
    if (
      !body.name &&
      body.activity_hierarchy_type !== 'CLASS_INSTANCE' &&
      body.activity_hierarchy_type !== 'SESSION'
    ) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Clean up UUID fields for session_id
    const updateData = {
      ...body,
      session_id:
        body.session_id &&
        body.session_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          ? body.session_id
          : null,
      updated_at: new Date().toISOString(),
    };

    // Validate session_id exists if provided
    if (updateData.session_id) {
      const { data: sessionExists, error: sessionError } = await supabase
        .from('kid_activities')
        .select('id')
        .eq('id', updateData.session_id)
        .eq('activity_hierarchy_type', 'SESSION')
        .single();

      if (sessionError || !sessionExists) {
        return new Response(
          JSON.stringify({ error: 'Invalid session_id: session does not exist' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    console.log('Update data:', updateData); // Debug log

    // Update the activity
    const { data: activity, error } = await supabase
      .from('kid_activities')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating activity:', error);
      return new Response(
        JSON.stringify({ error: `Failed to update activity: ${error.message}` }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify(activity), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in activity PUT:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    // Check authentication
    const authResult = await checkAuth(request);
    if ('error' in authResult) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { supabase } = authResult;
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Activity ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { error } = await supabase.from('kid_activities').delete().eq('id', id);

    if (error) {
      console.error('Error deleting activity:', error);
      return new Response(JSON.stringify({ error: 'Failed to delete activity' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ message: 'Activity deleted successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in activity DELETE:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
