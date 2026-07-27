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

export interface VarsityTeam {
  id: string;
  sportLabel: string;
  slug: string;
}

/** Match `"key":{ ... "name":"VALUE"` tolerating backslash-escaped quotes. */
function nestedName(window: string, key: string): string | null {
  const re = new RegExp(
    String.raw`\\?"` + key + String.raw`\\?":\{[^}]*?\\?"name\\?":\\?"([^"\\]+)`
  );
  return re.exec(window)?.[1] ?? null;
}

/** Extract varsity teams from the homepage RSC flight payload. */
export function parseVarsityTeams(html: string): VarsityTeam[] {
  const teams: VarsityTeam[] = [];
  const seen = new Set<string>();
  const teamRe = /\\?"id\\?":\\?"(\d{6,})\\?",\\?"displayName\\?":\\?"([^"\\]+)/g;

  let m: RegExpExecArray | null;
  while ((m = teamRe.exec(html)) !== null) {
    const id = m[1];
    const displayName = m[2];
    const window = html.slice(m.index, m.index + 600);

    const level = nestedName(window, 'level');
    if (level !== 'Varsity') continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const gender = nestedName(window, 'gender') ?? '';
    const sport = nestedName(window, 'sport') ?? '';
    const slug = `${gender} ${sport}`
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z-]/g, '');
    const sportLabel = displayName
      .replace(/\bVarsity\b/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    teams.push({ id, sportLabel, slug });
  }

  return teams;
}
