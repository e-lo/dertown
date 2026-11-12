/**
 * `activity_type` is free text, so a single browse category can span several
 * stored values (e.g. ski teams are "Winter Sports", soccer clubs "Soccer").
 * Keys are the `?type=` values used on /families/programs; values are the
 * lowercased `activity_type` strings that belong to that category.
 */
const TYPE_GROUPS: Record<string, readonly string[]> = {
  sports: ['sports', 'winter sports', 'soccer'],
};

/** True when an activity's stored type belongs to the given browse type. */
export function matchesActivityType(
  activityType: string | null | undefined,
  browseType: string
): boolean {
  const stored = (activityType ?? '').toLowerCase();
  const wanted = browseType.toLowerCase();
  return (TYPE_GROUPS[wanted] ?? [wanted]).includes(stored);
}
