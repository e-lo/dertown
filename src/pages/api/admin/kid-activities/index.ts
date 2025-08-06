import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';

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

export const GET: APIRoute = async () => {
  try {
    const { data: activities, error } = await supabaseAdmin
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

    const { data: activity, error } = await supabaseAdmin
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
