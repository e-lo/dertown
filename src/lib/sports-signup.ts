/**
 * Typical youth-sports signup windows, so /families/sports can put what
 * parents can act on right now at the top, even when a program has no
 * registration dates entered.
 */
import type { Season } from './season-utils';

type SeasonFlags = {
  is_fall?: boolean | null;
  is_winter?: boolean | null;
  is_spring?: boolean | null;
  is_summer?: boolean | null;
  is_ongoing?: boolean | null;
};

/** Inclusive calendar months (1 = Jan) when signups for each season usually happen. */
export const SIGNUP_WINDOWS: Record<Season, { start: number; end: number }> = {
  spring: { start: 1, end: 3 }, // Jan–Mar
  summer: { start: 3, end: 5 }, // Mar–May
  fall: { start: 5, end: 9 }, // May–Sep
  winter: { start: 10, end: 12 }, // Oct–Dec
};

const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];
const FLAG: Record<Season, keyof SeasonFlags> = {
  spring: 'is_spring',
  summer: 'is_summer',
  fall: 'is_fall',
  winter: 'is_winter',
};
const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function seasonsOf(p: SeasonFlags): Season[] {
  return SEASONS.filter((s) => !!p[FLAG[s]]);
}

/** Months from `month` until the window opens; 0 when `month` is inside it. */
function monthsUntilWindow(window: { start: number; end: number }, month: number): number {
  if (month >= window.start && month <= window.end) return 0;
  return (window.start - month + 12) % 12;
}

/**
 * Months until this program's next usual signup window (0 = open now),
 * or null when it has no seasons set.
 */
export function monthsUntilSignup(p: SeasonFlags, month: number): number | null {
  const seasons = seasonsOf(p);
  if (seasons.length === 0) return null;
  return Math.min(...seasons.map((s) => monthsUntilWindow(SIGNUP_WINDOWS[s], month)));
}

/** e.g. "Winter signups usually Oct–Dec" — or null for year-round / unknown. */
export function signupHint(p: SeasonFlags): string | null {
  const seasons = seasonsOf(p);
  if (seasons.length === 0) return null;
  const parts = seasons.map((s) => {
    const w = SIGNUP_WINDOWS[s];
    const name = s[0].toUpperCase() + s.slice(1);
    return `${name} ${MONTH_ABBR[w.start - 1]}–${MONTH_ABBR[w.end - 1]}`;
  });
  return `Signups usually: ${parts.join(' · ')}`;
}

/** Opening month name of the next window, e.g. "January". */
export function nextSignupMonthName(p: SeasonFlags, month: number): string | null {
  const until = monthsUntilSignup(p, month);
  if (until == null || until === 0) return null;
  const m = ((month - 1 + until) % 12) + 1;
  return new Date(2000, m - 1, 1).toLocaleDateString('en-US', { month: 'long' });
}

export type SignupGroupId = 'now' | 'anytime' | 'soon' | 'later' | 'unknown';

/**
 * Buckets programs by how soon a parent can act:
 * - now:     registration is open in the data, or it's the usual signup window
 * - anytime: year-round programs
 * - soon:    usual window opens within `soonMonths`
 * - later:   everything else with a season
 * - unknown: no season set
 */
export function signupGroup(
  p: SeasonFlags,
  month: number,
  hasOpenSignup: boolean,
  soonMonths = 3
): SignupGroupId {
  if (hasOpenSignup) return 'now';
  const until = monthsUntilSignup(p, month);
  if (until === 0) return 'now';
  if (p.is_ongoing) return 'anytime';
  if (until == null) return 'unknown';
  return until <= soonMonths ? 'soon' : 'later';
}
