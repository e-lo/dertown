// src/pages/api/admin/kid-activities/[id]/activity-events.ts
import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

// Weekday code -> JS day number (getUTCDay: SU=0, MO=1, ... SA=6).
const WEEKDAY_TO_NUM: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

const MAX_GENERATED_ROWS = 366;

/**
 * Pure helper: generate an array of YYYY-MM-DD strings between fromDate and
 * untilDate (inclusive) whose weekday is in `weekdays`, respecting `interval`
 * (every Nth week, counting the week of fromDate as week 0).
 *
 * Dates are parsed/iterated in UTC (via setUTCDate) to avoid DST drift; only
 * the calendar date is meaningful here, time-of-day is applied separately.
 */
function generateRecurringDates(
  fromDate: string,
  untilDate: string,
  weekdays: string[],
  interval: number
): string[] {
  const wanted = new Set(
    weekdays.map((w) => WEEKDAY_TO_NUM[w]).filter((n) => n !== undefined)
  );
  const result: string[] = [];
  const start = new Date(fromDate + 'T00:00:00Z');
  const end = new Date(untilDate + 'T00:00:00Z');
  const step = interval > 0 ? interval : 1;

  const cursor = new Date(start.getTime());
  while (cursor.getTime() <= end.getTime()) {
    const daysSinceStart = Math.floor(
      (cursor.getTime() - start.getTime()) / 86_400_000
    );
    const weekIndex = Math.floor(daysSinceStart / 7);
    if (weekIndex % step === 0 && wanted.has(cursor.getUTCDay())) {
      result.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

// GET — list occurrences for the activity.
export const GET = withAdminAuth(async ({ params }) => {
  const { id } = params;
  if (!id) return jsonError('id is required', 400);

  const { data, error } = await supabaseAdmin
    .from('activity_events')
    .select('*')
    .eq('activity_id', id)
    .order('start_datetime', { ascending: true });

  if (error) {
    console.error('[activity-events GET]', error);
    return jsonError('Failed to fetch occurrences', 500);
  }

  // Response key is `events` — the admin UI's loadSchedules() reads data.events.
  return jsonResponse({ events: data ?? [] });
});

// POST — generate occurrences (recurring or one-off). Always materialized as
// concrete ONE_OFF rows; we never store an RRULE / recurrence_pattern_id.
export const POST = withAdminAuth(async ({ params, request }) => {
  const { id } = params;
  if (!id) return jsonError('id is required', 400);

  let body;
  try {
    body = await request.json();
  } catch (parseError) {
    console.error('[activity-events POST] JSON parse error:', parseError);
    return jsonError('Invalid JSON in request body', 400);
  }

  const { mode } = body ?? {};

  // Each generated row is a concrete ONE_OFF occurrence.
  // NOTE: datetimes are stored exactly as provided (naive local ISO strings).
  // Project locale is America/Los_Angeles; timezone normalization is a known
  // follow-up — we deliberately do NOT attempt TZ math here.
  let rows: Array<{
    activity_id: string;
    event_type: 'ONE_OFF';
    name: string;
    start_datetime: string;
    end_datetime: string;
  }> = [];

  if (mode === 'recurring') {
    const { name, start_time, end_time, weekdays, from_date, until_date, interval } = body;

    if (!Array.isArray(weekdays) || weekdays.length === 0) {
      return jsonError('weekdays must be a non-empty array', 400);
    }
    if (!start_time || !end_time || !from_date || !until_date) {
      return jsonError('start_time, end_time, from_date and until_date are required', 400);
    }
    if (until_date < from_date) {
      return jsonError('until_date must be on or after from_date', 400);
    }

    const dates = generateRecurringDates(
      from_date,
      until_date,
      weekdays,
      typeof interval === 'number' ? interval : 1
    );

    if (dates.length > MAX_GENERATED_ROWS) {
      return jsonError(
        `Range would generate ${dates.length} occurrences (max ${MAX_GENERATED_ROWS}). Narrow the date range.`,
        400
      );
    }

    rows = dates.map((dateStr) => ({
      activity_id: id,
      event_type: 'ONE_OFF' as const,
      name: name || 'Session',
      // Naive local ISO: stored as provided (see note above).
      start_datetime: `${dateStr}T${start_time}:00`,
      end_datetime: `${dateStr}T${end_time}:00`,
    }));
  } else if (mode === 'one_off') {
    const { name, start_datetime, end_datetime } = body;

    if (!start_datetime || !end_datetime) {
      return jsonError('start_datetime and end_datetime are required', 400);
    }

    rows = [
      {
        activity_id: id,
        event_type: 'ONE_OFF' as const,
        name: name || 'Session',
        start_datetime,
        end_datetime,
      },
    ];
  } else {
    return jsonError("mode must be 'recurring' or 'one_off'", 400);
  }

  if (rows.length === 0) {
    return jsonError('No occurrences matched the given criteria', 400);
  }

  const { data, error } = await supabaseAdmin
    .from('activity_events')
    .insert(rows)
    .select();

  if (error) {
    console.error('[activity-events POST]', error);
    return jsonError(`Failed to create occurrences: ${error.message}`, 500);
  }

  return jsonResponse({ events: data ?? [], count: data?.length ?? 0 }, 201);
});

// PUT — edit one occurrence.
export const PUT = withAdminAuth(async ({ params, request, url }) => {
  const { id } = params;
  if (!id) return jsonError('id is required', 400);

  const eventId = url.searchParams.get('eventId');
  if (!eventId) return jsonError('eventId query param required', 400);

  let body;
  try {
    body = await request.json();
  } catch (parseError) {
    console.error('[activity-events PUT] JSON parse error:', parseError);
    return jsonError('Invalid JSON in request body', 400);
  }

  const allowed = ['name', 'start_datetime', 'end_datetime', 'description', 'waitlist_status'];
  const updates: Record<string, string | null> = {};
  for (const key of allowed) {
    if (key in body) {
      const value = body[key];
      updates[key] = value === '' ? null : value;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('activity_events')
    .update(updates)
    .eq('event_id', eventId)
    .select()
    .single();

  if (error) {
    console.error('[activity-events PUT]', error);
    return jsonError(`Failed to update occurrence: ${error.message}`, 500);
  }

  return jsonResponse({ event: data });
});

// DELETE — remove one occurrence (independent per-occurrence deletion).
export const DELETE = withAdminAuth(async ({ params, url }) => {
  const { id } = params;
  if (!id) return jsonError('id is required', 400);

  const eventId = url.searchParams.get('eventId');
  if (!eventId) return jsonError('eventId query param required', 400);

  const { error } = await supabaseAdmin
    .from('activity_events')
    .delete()
    .eq('event_id', eventId);

  if (error) {
    console.error('[activity-events DELETE]', error);
    return jsonError(`Failed to delete occurrence: ${error.message}`, 500);
  }

  return jsonResponse({ ok: true });
});
