/**
 * Fields submitted by the admin activity form that are NOT columns on the
 * `activities` table. They drive schedule/occurrence generation (the separate
 * `activity_events` endpoint), not the activity row itself.
 *
 * The single admin form is shared across all hierarchy types and always
 * serializes its (often hidden) schedule inputs. If these reach the activities
 * insert/update, PostgREST rejects the entire write with
 * "Could not find the 'X' column of 'activities' in the schema cache".
 *
 * This is a DENYLIST on purpose. A whitelist that forgot a real column would
 * silently drop data on update; a denylist that misses a future stray field
 * fails loudly (easy to spot and add here). Verified against the `activities`
 * schema: `waitlist_status`, `session_id`, `start_datetime`, `end_datetime`
 * ARE real columns and are intentionally NOT listed.
 */
export const SCHEDULE_ONLY_FIELDS = [
  'start_time',
  'end_time',
  'weekdays',
  'freq',
  'interval',
  'event_type',
  'until',
  'event_name',
  'event_description',
  'ignore_exceptions',
] as const;

const SCHEDULE_ONLY_SET: ReadonlySet<string> = new Set(SCHEDULE_ONLY_FIELDS);

/**
 * Return a shallow copy of `obj` with the schedule-only (non-`activities`)
 * fields removed, so the result is safe to insert/update on `activities`.
 * Does not mutate the input.
 */
export function stripScheduleFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!SCHEDULE_ONLY_SET.has(k)) out[k] = v;
  }
  return out as Partial<T>;
}
