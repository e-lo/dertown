import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = url.searchParams;
    const activityType = searchParams.get('activity_type');
    const participationType = searchParams.get('participation_type');
    const ageRange = searchParams.get('age_range');
    const gradeLevel = searchParams.get('grade_level');
    const season = searchParams.get('season');
    const audience = searchParams.get('audience'); // 'kids', 'adults', 'all'

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

    // Filter by audience
    if (audience === 'kids') {
      query = query.lte('max_age', 17);
    } else if (audience === 'adults') {
      query = query.gte('min_age', 18);
    }
    // 'all' or no filter shows everything

    const { data: activities, error } = await query;

    if (error) {
      console.error('Error fetching activities:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch activities' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!activities || activities.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
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

    // Add some hardcoded adult activities for now
    // In the future, these could come from a separate table or be added to the kid_activities table
    const adultActivities = [
      {
        id: 'adult-softball-1',
        name: 'Recreational Softball League',
        description:
          'Co-ed recreational softball league for adults. Games played on weekday evenings.',
        activity_type: 'Sports',
        participation_type: 'Recreational',
        min_age: 18,
        max_age: null,
        cost: '$50 per season',
        website: 'mailto:dertownleavenworth@gmail.com',
        sponsoring_organization: { name: 'Der Town Recreation', website: null },
        location: { name: 'Enchantment Park', address: 'Leavenworth, WA' },
        is_ongoing: true,
        is_fall: false,
        is_winter: false,
        is_spring: true,
        is_summer: true,
        events: [],
        is_adult: true,
      },
      {
        id: 'adult-soccer-1',
        name: 'Pickup Soccer',
        description: 'Casual pickup soccer games for adults. All skill levels welcome.',
        activity_type: 'Sports',
        participation_type: 'Recreational',
        min_age: 18,
        max_age: null,
        cost: 'Free',
        website: 'mailto:dertownleavenworth@gmail.com',
        sponsoring_organization: { name: 'Der Town Recreation', website: null },
        location: { name: 'Enchantment Park', address: 'Leavenworth, WA' },
        is_ongoing: true,
        is_fall: true,
        is_winter: false,
        is_spring: true,
        is_summer: true,
        events: [],
        is_adult: true,
      },
      {
        id: 'adult-basketball-1',
        name: 'Adult Basketball League',
        description: 'Competitive basketball league for adults. Games played on weekends.',
        activity_type: 'Sports',
        participation_type: 'Competitive',
        min_age: 18,
        max_age: null,
        cost: '$75 per season',
        website: 'mailto:dertownleavenworth@gmail.com',
        sponsoring_organization: { name: 'Der Town Recreation', website: null },
        location: { name: 'Cascade School District Gym', address: 'Leavenworth, WA' },
        is_ongoing: false,
        is_fall: true,
        is_winter: true,
        is_spring: false,
        is_summer: false,
        events: [],
        is_adult: true,
      },
    ];

    // Combine kid activities with adult activities
    const allActivities = [
      ...activitiesWithEvents.map((activity: any) => ({ ...activity, is_adult: false })),
      ...adultActivities,
    ];

    // Apply season filter if specified
    let filteredActivities = allActivities;
    if (season) {
      switch (season) {
        case 'fall':
          filteredActivities = allActivities.filter((activity) => activity.is_fall);
          break;
        case 'winter':
          filteredActivities = allActivities.filter((activity) => activity.is_winter);
          break;
        case 'spring':
          filteredActivities = allActivities.filter((activity) => activity.is_spring);
          break;
        case 'summer':
          filteredActivities = allActivities.filter((activity) => activity.is_summer);
          break;
        case 'ongoing':
          filteredActivities = allActivities.filter((activity) => activity.is_ongoing);
          break;
      }
    }

    return new Response(JSON.stringify(filteredActivities), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error('Error in activities API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
