/**
 * Builds the contents of src/styles/theme.generated.css from src/lib/config.ts.
 *
 * - `@theme` holds the Tailwind tokens (so `bg-primary`, `text-text`, `bg-surface`
 *   and friends exist), filled with the first season's values.
 * - One `:root[data-season="…"]` block per season overrides every seasonal
 *   variable; the page head sets `data-season` from the visitor's date.
 * - `.bg-event-*` rules give each category its season's background and the
 *   readable text color for it (white or near-black, by WCAG contrast).
 */
import { CATEGORY_SLOTS, COLORS, SEASON_IDS, SEASON_PALETTES, TYPOGRAPHY, type SeasonId } from '../src/lib/config';
import { readableTextOn } from '../src/lib/color-contrast';

/** camelCase / key → kebab-case CSS token name */
const kebab = (s: string) =>
  s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase();

/** Blend `hex` toward `toward` by `amount` (0–1). */
function mix(hex: string, toward: string, amount: number): string {
  const channels = (h: string) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16));
  const [from, to] = [channels(hex), channels(toward)];
  return '#' + from.map((c, i) => Math.round(c + (to[i] - c) * amount).toString(16).padStart(2, '0')).join('');
}

const lines = (vars: Record<string, string>) =>
  Object.entries(vars).map(([name, value]) => `  --${name}: ${value};`).join('\n');

/** Seasonal tokens that Tailwind turns into utilities. */
function utilityVars(id: SeasonId): Record<string, string> {
  const { colors } = SEASON_PALETTES[id];
  const vars: Record<string, string> = {
    'color-primary': colors.hero,
    'color-primary-light': mix(colors.hero, '#ffffff', 0.9),
    'color-primary-dark': mix(colors.hero, '#000000', 0.4),
    'color-secondary': colors.highlight,
    'color-surface': colors.page,
    'color-text': colors.ink,
  };
  for (const [category, slot] of Object.entries(CATEGORY_SLOTS)) {
    vars[`color-category-${category}`] = colors[slot];
  }
  return vars;
}

/** Seasonal values used only through var(). */
function plainVars(id: SeasonId): Record<string, string> {
  const { colors, announcement } = SEASON_PALETTES[id];
  const band = colors[announcement];
  const vars: Record<string, string> = {
    'color-primary-text': readableTextOn(colors.hero),
    'color-secondary-text': readableTextOn(colors.highlight),
    'color-announcement-bg': band,
    'color-announcement-text': readableTextOn(band),
  };
  for (const [category, slot] of Object.entries(CATEGORY_SLOTS)) {
    vars[`color-category-${category}-text`] = readableTextOn(colors[slot]);
  }
  return vars;
}

/** Old palette names, kept so existing classes and var(--palette-*) follow the season. */
const LEGACY_PALETTE: Record<string, string> = {
  'palatinate-blue': 'var(--color-primary)',
  canary: 'var(--color-secondary)',
  fandango: 'var(--color-category-family)',
  'pigment-green': 'var(--color-category-nature)',
  'blue-green': 'var(--color-category-nature)',
  'cal-poly-green': 'var(--color-category-nature)',
  'dark-slate-gray': 'var(--color-category-civic)',
};

const FIXED_KEYS = ['surfaceLight', 'textSecondary', 'textDark', 'muted', 'mutedDark', 'border', 'link'] as const;

/** Background + readable text for an event category class, including FullCalendar parts. */
function eventRule(name: string, background: string, text: string): string {
  const cls = `.bg-event-${name}`;
  return `${cls} {
  background-color: ${background} !important;
  --fc-event-text-color: ${text} !important;
}
${cls},
${cls} .fc-event-main,
${cls} .fc-event-title,
${cls} .fc-event-time {
  color: ${text} !important;
}`;
}

export function buildThemeCss(): string {
  const defaultSeason = SEASON_IDS[0];
  const fixedVars = Object.fromEntries(FIXED_KEYS.map((k) => [`color-${kebab(k)}`, COLORS[k]]));
  const legacyVars = Object.fromEntries(Object.entries(LEGACY_PALETTE).map(([k, v]) => [`color-${k}`, v]));
  const paletteAliases = Object.fromEntries(Object.keys(LEGACY_PALETTE).map((k) => [`palette-${k}`, `var(--color-${k})`]));
  const fontVars = Object.fromEntries(Object.entries(TYPOGRAPHY.fontFamilies).map(([k, v]) => [`font-${kebab(k)}`, v]));
  const n = COLORS.notifications;
  const notificationVars = {
    'color-error-text': n.error.text,
    'color-error-bg': n.error.bg,
    'color-success-text': n.success.text,
    'color-success-bg': n.success.bg,
    'color-warning-text': n.warning.text,
    'color-warning-bg': n.warning.bg,
    'color-info-text': n.info.text,
    'color-info-bg': n.info.bg,
  };

  const seasonBlocks = SEASON_IDS.map(
    (id) => `/* ${SEASON_PALETTES[id].label} */
:root[data-season="${id}"] {
${lines({ ...utilityVars(id), ...plainVars(id) })}
}`
  ).join('\n\n');

  const eventRules = [
    ...Object.keys(CATEGORY_SLOTS).map((c) =>
      eventRule(c, `var(--color-category-${c})`, `var(--color-category-${c}-text)`)
    ),
    eventRule('today', 'var(--color-category-nature)', 'var(--color-category-nature-text)'),
    eventRule('default', 'var(--color-primary)', 'var(--color-primary-text)'),
  ].join('\n\n');

  return `/* AUTO-GENERATED from src/lib/config.ts by scripts/generate-theme.ts.
   Do not edit by hand — run \`npm run theme:generate\` after changing config.ts. */

@theme {
  /* Seasonal colors (defaults: ${defaultSeason}; each season overrides them below) */
${lines(utilityVars(defaultSeason))}

  /* Colors that stay the same all year */
${lines(fixedVars)}

  /* Old palette names, mapped onto the seasonal colors */
${lines(legacyVars)}

  /* Typography */
${lines(fontVars)}
}

:root {
${lines(plainVars(defaultSeason))}

  /* Old var(--palette-*) names */
${lines(paletteAliases)}

  /* Notification / alert colors (used via var(), not as utilities) */
${lines(notificationVars)}

  --gradient-hero: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  --gradient-blues-light: var(--gradient-hero);
  --gradient-blues-bold: var(--gradient-hero);
}

${seasonBlocks}

/* Event category cards, pills, badges and calendar entries */
${eventRules}
`;
}
