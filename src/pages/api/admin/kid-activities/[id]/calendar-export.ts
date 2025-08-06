import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase';

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Activity ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const searchParams = new URL(url).searchParams;
    const startDate = searchParams.get('start') || new Date().toISOString().split('T')[0];
    const endDate =
      searchParams.get('end') ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get the activity
    const { data: activity, error: activityError } = await supabaseAdmin
      .from('kid_activities')
      .select('*')
      .eq('id', id)
      .single();

    if (activityError || !activity) {
      return new Response(JSON.stringify({ error: 'Activity not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get activity events for the activity
    const { data: events, error: eventsError } = await supabaseAdmin
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
      .eq('activity_id', id);

    if (eventsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch activity events' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get calendar exceptions
    const { data: exceptions, error: exceptionsError } = await supabaseAdmin.rpc(
      'get_activity_exceptions',
      {
        activity_uuid: id,
        query_start_date: startDate,
        query_end_date: endDate,
      }
    );

    if (exceptionsError) {
      console.error('Error fetching exceptions:', exceptionsError);
    }

    // Generate iCalendar content
    const icalContent = generateICalendar(activity, events || [], exceptions || []);

    return new Response(icalContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar',
        'Content-Disposition': `attachment; filename="${activity.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/admin/kid-activities/[id]/calendar-export:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

function generateICalendar(activity: any, events: any[], exceptions: any[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dertown//Kid Activities Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  // Add activity events
  events.forEach((event) => {
    if (event.event_type === 'RECURRING' && event.recurrence_patterns) {
      const pattern = event.recurrence_patterns;
      const rrule = generateRRule(pattern);

      ical.push(
        'BEGIN:VEVENT',
        `UID:${event.event_id}@dertown.com`,
        `DTSTAMP:${now}`,
        `DTSTART;TZID=America/Los_Angeles:${formatDateForICal(pattern.start_time)}`,
        `DTEND;TZID=America/Los_Angeles:${formatDateForICal(pattern.end_time)}`,
        `SUMMARY:${event.name}`,
        `DESCRIPTION:${event.description || ''}`,
        `RRULE:${rrule}`,
        'END:VEVENT'
      );
    } else if (event.event_type === 'ONE_OFF') {
      ical.push(
        'BEGIN:VEVENT',
        `UID:${event.event_id}@dertown.com`,
        `DTSTAMP:${now}`,
        `DTSTART:${formatDateTimeForICal(event.start_datetime)}`,
        `DTEND:${formatDateTimeForICal(event.end_datetime)}`,
        `SUMMARY:${event.name}`,
        `DESCRIPTION:${event.description || ''}`,
        'END:VEVENT'
      );
    }
  });

  // Add exceptions
  exceptions.forEach((exception) => {
    ical.push(
      'BEGIN:VEVENT',
      `UID:${exception.exception_id}@dertown.com`,
      `DTSTAMP:${now}`,
      `DTSTART:${formatDateForICal(exception.start_date)}`,
      `DTEND:${formatDateForICal(exception.end_date)}`,
      `SUMMARY:${exception.name}`,
      `DESCRIPTION:${exception.notes || ''}`,
      'END:VEVENT'
    );
  });

  ical.push('END:VCALENDAR');

  return ical.join('\r\n');
}

function generateRRule(pattern: any): string {
  const parts = [`FREQ=${pattern.freq}`];

  if (pattern.interval && pattern.interval > 1) {
    parts.push(`INTERVAL=${pattern.interval}`);
  }

  if (pattern.weekdays && pattern.weekdays.length > 0) {
    parts.push(`BYDAY=${pattern.weekdays.join(',')}`);
  }

  if (pattern.until) {
    parts.push(`UNTIL=${formatDateForICal(pattern.until)}`);
  }

  return parts.join(';');
}

function formatDateForICal(date: string): string {
  return date.replace(/[-:]/g, '');
}

function formatDateTimeForICal(datetime: string): string {
  return datetime.replace(/[-:]/g, '').replace(/\.\d{3}Z?$/, 'Z');
}
