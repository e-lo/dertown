import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { jsonResponse, jsonError } from '@/lib/api-utils';

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = url.searchParams;
    const activityType = searchParams.get('activity_type');
    const participationType = searchParams.get('participation_type');
    const ageRange = searchParams.get('age_range');
    const gradeLevel = searchParams.get('grade_level');

    // Build the main query with all necessary joins
    // Note: Using type assertion since public_kid_activities view may not be in generated types
    let query = (supabase as any)
      .from('public_kid_activities')
      .select(
        `
        *,
        sponsoring_organization:organizations!sponsoring_organization_id(name, website),
        location:locations!location_id(name, address)
      `
      )
      .order('name');

    // Apply filters
    if (activityType) {
      query = query.eq('activity_type', activityType);
    }

    if (participationType) {
      // Handle consolidated tryouts/audition filter
      if (participationType === 'Tryouts/Audition Required') {
        query = query.in('participation_type', ['Tryouts Required', 'Audition Required']);
      } else {
        query = query.eq('participation_type', participationType);
      }
    }

    if (ageRange) {
      const [minAge, maxAge] = ageRange.split('-').map(Number);
      if (minAge !== undefined) {
        query = query.gte('min_age', minAge);
      }
      if (maxAge !== undefined) {
        query = query.lte('max_age', maxAge);
      }
    }

    if (gradeLevel) {
      // Map grade levels to age ranges for filtering
      const gradeAgeMap: { [key: string]: { min: number; max: number } } = {
        'K-2': { min: 5, max: 8 },
        '3-5': { min: 8, max: 11 },
        '6-8': { min: 11, max: 14 },
        '9-12': { min: 14, max: 18 },
      };

      const gradeRange = gradeAgeMap[gradeLevel];
      if (gradeRange) {
        query = query.gte('min_age', gradeRange.min).lte('max_age', gradeRange.max);
      }
    }

    const { data: activities, error } = await query;

    if (error) {
      console.error('Error fetching activities:', error);
      return jsonError('Failed to fetch activities');
    }

    if (!activities || activities.length === 0) {
      return jsonResponse([]);
    }

    // Get all activity IDs to fetch events in bulk
    const activityIds = activities.map((a: any) => a.id).filter(Boolean);

    // Fetch all events for all activities in a single query (limit to recent events for performance)
    const { data: allEvents, error: eventsError } = await supabase
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
      .in('activity_id', activityIds)
      .order('created_at', { ascending: false })
      .limit(1000); // Limit to prevent performance issues

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      // Continue without events rather than failing
    }

    // Build a map of events by activity ID
    const eventsByActivity = new Map();
    allEvents?.forEach((event) => {
      const activityId = event.activity_id;
      if (!eventsByActivity.has(activityId)) {
        eventsByActivity.set(activityId, []);
      }
      eventsByActivity.get(activityId).push(event);
    });

    // Add events to each activity and return all activities
    const activitiesWithEvents = activities.map((activity: any) => {
      const events = eventsByActivity.get(activity.id) || [];
      return {
        ...activity,
        events: events,
      };
    });

    return new Response(JSON.stringify(activitiesWithEvents), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error('Error in GET /api/kid-activities:', error);
    return jsonError('Internal server error');
  }
};
