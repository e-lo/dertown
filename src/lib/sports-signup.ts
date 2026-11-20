/**
 * Works out where each team goes on /families/sports and what its signup pill
 * says, so parents see what they can act on first:
 *
 *   now       registration is actually open (from real dates in the data)
 *   soon      signups open within ~3 months, or the usual window is open but
 *             nothing is confirmed ("check with the team")
 *   happening in season right now, or year-round
 *   later     everything else
 *
 * Real registration dates win. Dates from a past cycle are assumed to repeat
 * next year. Teams with no dates fall back to the usual season windows.
 */
import type { Season } from './season-utils';

export type SeasonFlags = {
  is_fall?: boolean | null;
  is_winter?: boolean | null;
  is_spring?: boolean | null;
  is_summer?: boolean | null;
  is_ongoing?: boolean | null;
};

/** Inclusive calendar months (1 = Jan) when signups for each season usually happen. */
export const SIGNUP_WINDOWS: Record<Season, { start: number; end: number }> = {
  spring: { start: 1, end: 3 }, // Jan–Mar
  summer: { start: 5, end: 5 }, // early May
  fall: { start: 5, end: 9 }, // May–Sep
  winter: { start: 10, end: 12 }, // Oct–Dec
};

/** Months each season's teams are usually playing (youth sports, not calendar seasons). */
export const IN_SEASON_MONTHS: Record<Season, number[]> = {
  fall: [9, 10, 11],
  winter: [12, 1, 2, 3],
  spring: [3, 4, 5, 6],
  summer: [6, 7, 8],
};

export type RealWindow = { opens: string | null; closes: string | null };
export type SignupFacts = {
  /** Label from the live registration data when signups are open now, else null. */
  openLabel: string | null;
  /** Registration dates entered for this team (any year). */
  windows: RealWindow[];
};
export type SignupGroupId = 'now' | 'soon' | 'happening' | 'later';
export type SignupView = {
  group: SignupGroupId;
  pill: string;
  /** Calendar months (1–12) when signups usually happen, for the month strip. */
  months: number[];
  /** Lower sorts first within a group. */
  sortKey: number;
};

const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];
const FLAG: Record<Season, keyof SeasonFlags> = {
  spring: 'is_spring',
  summer: 'is_summer',
  fall: 'is_fall',
  winter: 'is_winter',
};
const SOON_DAYS = 92;
const SOON_MONTHS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const LAST = Number.MAX_SAFE_INTEGER;

const monthAbbr = (m: number) =>
  new Date(2000, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
const monthName = (m: number) =>
  new Date(2000, m - 1, 1).toLocaleDateString('en-US', { month: 'long' });
const dayLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const parseDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function seasonsOf(p: SeasonFlags): Season[] {
  return SEASONS.filter((s) => !!p[FLAG[s]]);
}

function monthRange(start: number, end: number): number[] {
  const months: number[] = [];
  for (let m = start; ; m = (m % 12) + 1) {
    months.push(m);
    if (m === end) return months;
  }
}

const sortedUnique = (months: number[]) => [...new Set(months)].sort((a, b) => a - b);

function isInSeason(p: SeasonFlags, month: number): boolean {
  return !!p.is_ongoing || seasonsOf(p).some((s) => IN_SEASON_MONTHS[s].includes(month));
}

/** Pill for a team that isn't open or opening soon. */
function offSeasonView(
  p: SeasonFlags,
  month: number,
  nextMonth: number,
  sortKey: number,
  months: number[]
): SignupView {
  if (p.is_ongoing) return { group: 'happening', pill: 'Join anytime', months, sortKey: LAST };
  if (isInSeason(p, month)) {
    return {
      group: 'happening',
      pill: `In season · next signups ${monthName(nextMonth)}`,
      months,
      sortKey,
    };
  }
  return { group: 'later', pill: `Signups usually open ${monthName(nextMonth)}`, months, sortKey };
}

/** Next opening from real dates: a future date as-is, a past one rolled forward a year at a time. */
function nextRealOpening(
  windows: RealWindow[],
  today: Date
): { date: Date; confirmed: boolean } | null {
  let best: { date: Date; confirmed: boolean } | null = null;
  for (const w of windows) {
    if (!w.opens) continue;
    const date = parseDay(w.opens);
    const confirmed = date >= today;
    while (date < today) date.setFullYear(date.getFullYear() + 1);
    if (!best || date < best.date) best = { date, confirmed };
  }
  return best;
}

function realMonths(windows: RealWindow[]): number[] {
  return sortedUnique(
    windows.flatMap((w) => {
      const start = w.opens ? parseDay(w.opens).getMonth() + 1 : null;
      const end = w.closes ? parseDay(w.closes).getMonth() + 1 : null;
      if (start && end) return monthRange(start, end);
      return [start ?? end].filter((m): m is number => m != null);
    })
  );
}

function windowMonths(p: SeasonFlags): number[] {
  return sortedUnique(
    seasonsOf(p).flatMap((s) => monthRange(SIGNUP_WINDOWS[s].start, SIGNUP_WINDOWS[s].end))
  );
}

export function describeSignup(p: SeasonFlags, now: Date, facts: SignupFacts): SignupView {
  const today = startOfDay(now);
  const month = today.getMonth() + 1;
  const hasRealDates = facts.windows.some((w) => w.opens);
  const months = hasRealDates ? realMonths(facts.windows) : windowMonths(p);

  if (facts.openLabel) return { group: 'now', pill: facts.openLabel, months, sortKey: 0 };

  if (hasRealDates) {
    const next = nextRealOpening(facts.windows, today)!;
    const days = Math.round((next.date.getTime() - today.getTime()) / DAY_MS);
    if (days <= SOON_DAYS) {
      const pill = `${next.confirmed ? 'Opens' : 'Usually opens'} ${dayLabel(next.date)}`;
      return { group: 'soon', pill, months, sortKey: days };
    }
    return offSeasonView(p, month, next.date.getMonth() + 1, days, months);
  }

  // No dates: use the usual windows for the team's seasons
  const seasons = seasonsOf(p);
  if (seasons.length === 0) {
    return p.is_ongoing
      ? { group: 'happening', pill: 'Join anytime', months, sortKey: LAST }
      : { group: 'later', pill: 'Check with the organization', months, sortKey: LAST };
  }
  const untilBySeason = seasons.map((s) => {
    const w = SIGNUP_WINDOWS[s];
    const inWindow = month >= w.start && month <= w.end;
    return { season: s, until: inWindow ? 0 : (w.start - month + 12) % 12 };
  });
  const nearest = untilBySeason.reduce((a, b) => (b.until < a.until ? b : a));
  const w = SIGNUP_WINDOWS[nearest.season];
  const sortKey = nearest.until * 30;
  if (nearest.until === 0) {
    const span =
      w.start === w.end ? `in ${monthAbbr(w.start)}` : `${monthAbbr(w.start)}–${monthAbbr(w.end)}`;
    return { group: 'soon', pill: `Usually open ${span} · check with the team`, months, sortKey };
  }
  if (nearest.until <= SOON_MONTHS) {
    return { group: 'soon', pill: `Usually opens ${monthName(w.start)}`, months, sortKey };
  }
  return offSeasonView(p, month, w.start, sortKey, months);
}
