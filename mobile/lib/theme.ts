import {
  CATEGORY_SLOTS,
  SEASON_PALETTES,
  getSeasonForMonth,
  type SeasonId,
} from '../../src/lib/config';
import { readableTextOn } from '../../src/lib/color-contrast';

/**
 * Strip 8-digit hex alpha channel to produce React Native-compatible 6-digit hex.
 * Only strips trailing 'ff' (fully opaque). Other alpha values are left unchanged
 * since they represent intentional transparency.
 */
export function fixHex(color: string): string {
  if (color.length === 9 && color.startsWith('#') && color.toLowerCase().endsWith('ff')) {
    return color.slice(0, 7);
  }
  return color;
}

/** The season the app opens in, picked from today's date like the website does. */
const CURRENT_SEASON: SeasonId = getSeasonForMonth(new Date().getMonth() + 1);

// API tag names → the web's category slugs (see CATEGORY_SLOTS in src/lib/config.ts).
const TAG_SLUGS: Record<string, string> = {
  'Arts+Culture': 'arts-culture',
  'Civic':        'civic',
  'Family':       'family',
  'Give Back':    'give-back',
  'Nature':       'nature',
  'Recreation':   'recreation',
  'Outdoors':     'outdoors',
  'School':       'school',
  'Seniors':      'seniors',
  'Sports':       'sports',
  'Town':         'town',
  'Featured':     'featured',
};

function seasonCategoryColor(category: string | null | undefined, season: SeasonId): string {
  const { colors } = SEASON_PALETTES[season];
  const slot = category ? CATEGORY_SLOTS[TAG_SLUGS[category]] : undefined;
  return slot ? colors[slot] : colors.hero;
}

/** This season's card color for each category, keyed by the API tag name. */
export const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  Object.keys(TAG_SLUGS).map((tag) => [tag, seasonCategoryColor(tag, CURRENT_SEASON)])
);

export function getCategoryColor(
  category: string | null | undefined,
  season: SeasonId = CURRENT_SEASON
): string {
  return seasonCategoryColor(category, season);
}

/** Returns the primary text color for a given category background. */
export function getCategoryTextColor(
  category: string | null | undefined,
  season: SeasonId = CURRENT_SEASON
): string {
  return readableTextOn(seasonCategoryColor(category, season));
}

/** Returns a muted/secondary text color for a given category background. */
export function getCategoryTextMuted(
  category: string | null | undefined,
  season: SeasonId = CURRENT_SEASON
): string {
  return getCategoryTextColor(category, season) === '#111111'
    ? 'rgba(0,0,0,0.6)'
    : 'rgba(255,255,255,0.7)';
}

const seasonColors = SEASON_PALETTES[CURRENT_SEASON].colors;
// The announcement color is the season's light accent, so it reads on the app's dark surfaces.
const seasonAccent = seasonColors[SEASON_PALETTES[CURRENT_SEASON].announcement];

// Core theme tokens — all 6-digit hex (no 8-digit, React Native safe)
export const THEME = {
  // Navigation
  headerBackground:   seasonColors.hero,       // top app bar
  tabBarBackground:   '#0f172a',               // bottom tab bar stays dark
  tabBarActive:       seasonAccent,
  tabBarInactive:     '#94a3b8',

  // Feed
  feedBackground:     '#0f172a',
  dayHeaderBg:        '#f1f5f9',
  dayHeaderText:      '#374151',

  // Text on dark event rows
  textPrimary:        '#ffffff',
  textSecondary:      'rgba(255,255,255,0.7)',
  textMuted:          'rgba(255,255,255,0.5)',

  // Star icon colors
  starUnstarred:      'rgba(255,255,255,0.28)',
  starFilled:         seasonAccent,

  // Accent (icons, links and highlights on dark screens)
  canary:             seasonAccent,

  // Semantic colors
  errorRed:           '#f87171',
  cardBackground:     '#1e293b',
  successGreen:       '#166534',
};

/** Max width for list/content screens on tablet — centred on wider displays. */
export const MAX_CONTENT_WIDTH = 600;
