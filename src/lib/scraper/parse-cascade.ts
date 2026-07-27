/**
 * Cascade High School Athletics (cascadekodiakathletics.com) — PlayOn / VNN.
 * Self-fetching source: discover the season's varsity team ids from the
 * homepage RSC flight payload, then fetch each team's schedule page (which
 * caps at 10 events) and keep home games.
 */

/** School year runs Aug–Jul; July onward maps to the upcoming year. */
export function currentSchoolYear(now: Date): string {
  const year = now.getFullYear();
  const startYear = now.getMonth() >= 6 ? year : year - 1; // month 6 = July
  return `${startYear}-${startYear + 1}`;
}
