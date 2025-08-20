import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../../types/database';

const supabaseUrl = import.meta.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Function to check authentication and admin status using server-side auth
async function checkAuth(request: Request) {
  try {
    // Create a Supabase client with service role key for server-side operations
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Get the session from cookies or headers
    const authHeader = request.headers.get('Authorization');
    const session = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser(token);
      if (userError || !user) {
        return { error: 'Invalid or expired token', status: 401 };
      }

      // Check if the user is an admin using the is_admin Postgres function
      const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
      if (adminError || !isAdmin) {
        return { error: 'Forbidden: Admins only', status: 403 };
      }

      return { supabase, user };
    } else {
      // Try to get session from cookies (for server-side rendering)
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const {
          data: { session: cookieSession },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError || !cookieSession) {
          return { error: 'No valid session found', status: 401 };
        }

        const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
        if (adminError || !isAdmin) {
          return { error: 'Forbidden: Admins only', status: 403 };
        }

        return { supabase, user: cookieSession.user };
      }
    }

    return { error: 'Authentication required', status: 401 };
  } catch (error) {
    console.error('Authentication error:', error);
    return { error: 'Authentication failed', status: 401 };
  }
}

// Function to generate smart names for class instances and sessions based on schedule data
function generateSmartName(activityData: any): string {
  // If we have schedule information, use it to generate a meaningful name
  if (activityData.start_time && activityData.end_time) {
    const startTime = activityData.start_time.substring(0, 5); // Get HH:MM
    const endTime = activityData.end_time.substring(0, 5); // Get HH:MM

    // If we have weekdays, include them
    if (activityData.weekdays && activityData.weekdays.length > 0) {
      const dayAbbrevs = activityData.weekdays.map((day: string) => {
        const dayMap: { [key: string]: string } = {
          MO: 'Mon',
          TU: 'Tue',
          WE: 'Wed',
          TH: 'Thu',
          FR: 'Fri',
          SA: 'Sat',
          SU: 'Sun',
        };
        return dayMap[day] || day;
      });
      return `${dayAbbrevs.join('/')} ${startTime}-${endTime}`;
    }

    // Just time if no weekdays
    return `${startTime}-${endTime}`;
  }

  // For sessions without schedule data, generate a generic session name
  if (activityData.activity_hierarchy_type === 'SESSION') {
    return 'Session';
  }

  // For class instances without schedule data, generate a generic name
  if (activityData.activity_hierarchy_type === 'CLASS_INSTANCE') {
    return 'Class Instance';
  }

  return 'Activity';
}

export const GET: APIRoute = async ({ request }) => {
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
    const { data: activities, error } = await supabase
      .from('kid_activities')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching activities:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch activities' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(activities), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in activities GET:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
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
    const body = await request.json();
    console.log('API received body:', body); // Debug log

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

    // Extract schedule data for smart name generation (but don't include in activity data)
    const scheduleData = {
      start_time: body.start_time,
      end_time: body.end_time,
      weekdays: body.weekdays,
    };

    // Remove schedule fields from activity data (they don't belong in kid_activities table)
    const { start_time, end_time, weekdays, ...activityFields } = body;

    // Set default values and clean up UUID fields
    const activityData = {
      ...activityFields,
      status: 'approved',
      active: true,
      activity_hierarchy_type: body.activity_hierarchy_type || 'PROGRAM',
      // Generate default name for CLASS_INSTANCE or SESSION if not provided
      name:
        (body.activity_hierarchy_type === 'CLASS_INSTANCE' ||
          body.activity_hierarchy_type === 'SESSION') &&
        !body.name
          ? generateSmartName(scheduleData)
          : body.name,
      // Clean up UUID fields - only set if they're valid UUIDs
      sponsoring_organization_id:
        body.sponsoring_organization_id &&
        body.sponsoring_organization_id.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
          ? body.sponsoring_organization_id
          : null,
      location_id:
        body.location_id &&
        body.location_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          ? body.location_id
          : null,
      parent_activity_id:
        body.parent_activity_id &&
        body.parent_activity_id.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
          ? body.parent_activity_id
          : null,
      session_id:
        body.session_id &&
        body.session_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          ? body.session_id
          : null,
      created_by:
        body.created_by &&
        body.created_by.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          ? body.created_by
          : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('Cleaned activityData:', activityData); // Debug log

    const { data: activity, error } = await supabase
      .from('kid_activities')
      .insert(activityData)
      .select()
      .single();

    if (error) {
      console.error('Error creating activity:', error);
      return new Response(
        JSON.stringify({ error: `Failed to create activity: ${error.message}` }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify(activity), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in activities POST:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
