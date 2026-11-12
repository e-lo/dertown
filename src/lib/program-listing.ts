/**
 * Shared data + signup logic for the public program listings
 * (/families/programs and /families/sports).
 */
import { supabase } from './supabase';

export type Program = {
  id: string;
  name: string;
  description?: string | null;
  activity_type?: string | null;
  sport?: string | null;
  program_format?: string | null;
  is_fall?: boolean | null;
  is_winter?: boolean | null;
  is_spring?: boolean | null;
  is_summer?: boolean | null;
  is_ongoing?: boolean | null;
  min_age?: number | null;
  max_age?: number | null;
  min_grade?: string | null;
  max_grade?: string | null;
  cost?: string | null;
  cost_assistance_available?: boolean | null;
  registration_link?: string | null;
  registration_required?: boolean | null;
  registration_opens?: string | null;
  registration_closes?: string | null;
  waitlist_status?: string | null;
  featured?: boolean | null;
  website?: string | null;
  sponsoring_organization?: { name?: string | null; website?: string | null } | null;
};

export const PROGRAM_SELECT = `
  id, name, description, activity_type, sport, program_format,
  is_fall, is_winter, is_spring, is_summer, is_ongoing,
  min_age, max_age, min_grade, max_grade,
  cost, cost_assistance_available,
  registration_link, registration_required,
  registration_opens, registration_closes,
  waitlist_status, featured, website,
  sponsoring_organization:organizations!sponsoring_organization_id(name, website)
`;

// --- Display helpers ---

export function formatAge(
  min: number | null | undefined,
  max: number | null | undefined,
  minGrade?: string | null,
  maxGrade?: string | null
): string {
  if (min != null && max != null) return `Ages ${min}–${max}`;
  if (min != null) return `Ages ${min}+`;
  if (max != null) return `Up to age ${max}`;
  if (minGrade || maxGrade) {
    return `${minGrade ?? ''}${minGrade && maxGrade ? '–' : ''}${maxGrade ?? ''}`;
  }
  return 'All ages';
}

// registration_* are DATE columns. Parse date-only strings as local midnight so
// they don't shift to the previous evening (UTC parse) in Pacific time.
function parseDate(iso: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
}
function endOfDay(iso: string): Date {
  const d = parseDate(iso);
  d.setHours(23, 59, 59, 999);
  return d;
}
export const shortDate = (iso: string) =>
  parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const longDate = (iso: string) =>
  parseDate(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

const SPORT_ICONS: Record<string, string> = {
  skiing: 'downhill_skiing',
  soccer: 'sports_soccer',
  basketball: 'sports_basketball',
  baseball: 'sports_baseball',
  softball: 'sports_baseball',
  volleyball: 'sports_volleyball',
  hockey: 'sports_hockey',
  lacrosse: 'sports',
  'mountain biking': 'directions_bike',
  swimming: 'pool',
  climbing: 'landscape',
  gymnastics: 'sports_gymnastics',
  'martial arts': 'sports_martial_arts',
};
const TYPE_ICONS: Record<string, string> = {
  sports: 'sports_soccer',
  arts: 'palette',
  music: 'music_note',
  dance: 'music_note',
  theater: 'theater_comedy',
  stem: 'science',
  outdoor: 'hiking',
  academic: 'school',
  education: 'school',
  social: 'groups',
  scouting: 'camping',
  recreation: 'park',
  other: 'category',
};

export function getProgramIcon(p: Pick<Program, 'activity_type' | 'sport'>): string {
  return (
    SPORT_ICONS[(p.sport ?? '').toLowerCase()] ??
    TYPE_ICONS[(p.activity_type ?? '').toLowerCase()] ??
    'category'
  );
}

export const FORMAT_LABELS: Record<string, { label: string; color: string }> = {
  league: { label: 'League', color: 'blue' },
  class: { label: 'Class', color: 'purple' },
  workshop: { label: 'Workshop', color: 'green' },
};

export const SEASON_BADGES = [
  { key: 'is_fall', label: 'Fall', color: 'yellow' },
  { key: 'is_winter', label: 'Winter', color: 'blue' },
  { key: 'is_spring', label: 'Spring', color: 'green' },
  { key: 'is_summer', label: 'Summer', color: 'orange' },
  { key: 'is_ongoing', label: 'Year-round', color: 'gray' },
] as const;

// --- Filters ---

export const AGE_OPTIONS = [
  { value: '', label: 'All ages' },
  { value: 'little-kids', label: 'Little Kids (0–5)' },
  { value: 'elementary', label: 'Elementary' },
  { value: 'middle', label: 'Middle School' },
  { value: 'teen', label: 'Teen' },
];

/** Overlapping-range age match for the ?age= filter. */
export function matchesAge(p: Program, age: string): boolean {
  const min = p.min_age ?? 0;
  const max = p.max_age ?? 99;
  switch (age) {
    case 'little-kids':
      return min <= 6;
    case 'elementary':
      return max >= 5 && min <= 11;
    case 'middle':
      return max >= 11 && min <= 14;
    case 'teen':
      return max >= 13;
    default:
      return true;
  }
}

// --- Sessions & signups ---
// Registration info almost always lives on a program's SESSION children, not
// on the program row itself. RLS limits anon reads to approved sessions.

export type Session = {
  id: string;
  name: string;
  parent_activity_id: string;
  registration_opens?: string | null;
  registration_closes?: string | null;
  registration_link?: string | null;
  waitlist_status?: string | null;
};
type Registrable = Pick<
  Session,
  'registration_opens' | 'registration_closes' | 'registration_link' | 'waitlist_status'
>;

type SignupState = 'open' | 'upcoming';
export type SignupEntry = {
  program: Program;
  session: Session | null;
  reg: Registrable;
  state: SignupState;
};
export type Signups = {
  byProgram: Record<string, SignupEntry[]>;
  open: SignupEntry[];
  upcoming: SignupEntry[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

async function loadSessionsByProgram(programIds: string[]): Promise<Record<string, Session[]>> {
  const byProgram: Record<string, Session[]> = {};
  if (programIds.length === 0) return byProgram;
  const { data } = await (supabase as any)
    .from('activities')
    .select(
      'id, name, parent_activity_id, registration_opens, registration_closes, registration_link, waitlist_status'
    )
    .eq('activity_hierarchy_type', 'SESSION')
    .in('parent_activity_id', programIds)
    .order('registration_opens', { ascending: true });
  for (const sess of (data ?? []) as Session[]) {
    (byProgram[sess.parent_activity_id] ??= []).push(sess);
  }
  return byProgram;
}

function hasRegDates(r: Registrable): boolean {
  return !!(r.registration_opens || r.registration_closes || r.waitlist_status);
}

// "Open now" without a close date is only trusted for 90 days after it opened,
// so a stale open date from a past season doesn't sit in the callout forever.
function getSignupState(r: Registrable, now: Date): SignupState | null {
  const soon = new Date(now.getTime() + 60 * DAY_MS);
  const staleAfter = new Date(now.getTime() - 90 * DAY_MS);
  const opens = r.registration_opens ? parseDate(r.registration_opens) : null;
  const closes = r.registration_closes ? endOfDay(r.registration_closes) : null;
  if (closes && closes < now) return null;
  if (opens && opens > now) return opens <= soon ? 'upcoming' : null;
  if (r.waitlist_status) return 'open';
  if (closes) return 'open';
  if (opens && opens >= staleAfter) return 'open';
  return null;
}

/** Loads the programs' sessions and works out which signups are open or opening soon. */
export async function loadSignups(programs: Program[], now = new Date()): Promise<Signups> {
  const sessionsByProgram = await loadSessionsByProgram(programs.map((p) => p.id));
  const byProgram: Record<string, SignupEntry[]> = {};
  for (const program of programs) {
    const sessions = (sessionsByProgram[program.id] ?? []).filter(hasRegDates);
    // Program-level dates are only a fallback for programs with no dated sessions
    const candidates =
      sessions.length > 0
        ? sessions.map((sess) => ({ session: sess as Session | null, reg: sess as Registrable }))
        : [{ session: null, reg: program as Registrable }];
    for (const c of candidates) {
      const state = getSignupState(c.reg, now);
      if (state) (byProgram[program.id] ??= []).push({ program, ...c, state });
    }
  }
  const all = Object.values(byProgram).flat();
  const byDate =
    (key: 'registration_opens' | 'registration_closes') => (a: SignupEntry, b: SignupEntry) =>
      (a.reg[key] ?? '9999').localeCompare(b.reg[key] ?? '9999');
  return {
    byProgram,
    // Open now: soonest deadline first. Opening soon: soonest opening first.
    open: all.filter((e) => e.state === 'open').sort(byDate('registration_closes')),
    upcoming: all.filter((e) => e.state === 'upcoming').sort(byDate('registration_opens')),
  };
}

export function signupLink(e: SignupEntry): string | null {
  return e.reg.registration_link ?? e.program.registration_link ?? null;
}

export function signupLabel(e: SignupEntry): string {
  const sessionName = e.session?.name;
  return sessionName && sessionName !== e.program.name
    ? `${e.program.name} · ${sessionName}`
    : e.program.name;
}

/** Card badge: best signup state across a program's sessions. */
export function getRegStatus(entries: SignupEntry[] = []): { label: string; color: string } | null {
  const open = entries.find((e) => e.state === 'open');
  if (open) {
    if (open.reg.waitlist_status) return { label: 'Waitlist open', color: 'orange' };
    const closes = open.reg.registration_closes;
    return {
      label: closes ? `Registration open · closes ${shortDate(closes)}` : 'Registration open',
      color: 'green',
    };
  }
  const upcoming = entries.find((e) => e.state === 'upcoming');
  if (upcoming?.reg.registration_opens) {
    return {
      label: `Registration opens ${shortDate(upcoming.reg.registration_opens)}`,
      color: 'yellow',
    };
  }
  return null;
}
