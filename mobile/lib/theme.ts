import { COLOR_PALETTE, COLORS } from '../../src/lib/config';

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

// Exact colors from src/lib/config.ts COLOR_PALETTE — keyed by the API tag name.
export const CATEGORY_COLORS: Record<string, string> = {
  'Arts+Culture': '#ffe600',   // canary
  'Civic':        '#2f4445',   // darkSlateGray
  'Family':       '#c0268c',   // fandango
  'Nature':       '#14532d',   // calPolyGreen
  'Recreation':   '#219ebc',   // blueGreen
  'Outdoors':     '#219ebc',   // blueGreen
  'School':       '#2f4445',   // darkSlateGray
  'Seniors':      '#c0268c',   // fandango
  'Sports':       '#ffe600',   // canary
  'Town':         '#4740cb',   // palatinateBlue
  'Featured':     '#ffe600',   // canary
};

// Yellow (canary) backgrounds need dark text — matches web eventTextColors.
const LIGHT_BG_CATEGORIES = new Set(['Arts+Culture', 'Sports', 'Featured']);

const FALLBACK_COLOR = fixHex(COLORS.primary);

export function getCategoryColor(category: string | null | undefined): string {
  if (!category) return FALLBACK_COLOR;
  return CATEGORY_COLORS[category] ?? FALLBACK_COLOR;
}

/** Returns the primary text color for a given category background. */
export function getCategoryTextColor(category: string | null | undefined): string {
  return category && LIGHT_BG_CATEGORIES.has(category) ? '#111111' : '#ffffff';
}

/** Returns a muted/secondary text color for a given category background. */
export function getCategoryTextMuted(category: string | null | undefined): string {
  return category && LIGHT_BG_CATEGORIES.has(category)
    ? 'rgba(0,0,0,0.6)'
    : 'rgba(255,255,255,0.7)';
}

// Core theme tokens — all 6-digit hex (no 8-digit, React Native safe)
export const THEME = {
  // Navigation
  tabBarBackground:   '#0f172a',
  tabBarActive:       fixHex(COLOR_PALETTE.canary),      // '#ffe600'
  tabBarInactive:     '#94a3b8',

  // Feed
  feedBackground:     '#111827',
  dayHeaderBg:        '#f1f5f9',
  dayHeaderText:      '#374151',

  // Text on dark event rows
  textPrimary:        '#ffffff',
  textSecondary:      'rgba(255,255,255,0.7)',
  textMuted:          'rgba(255,255,255,0.5)',

  // Star icon colors
  starUnstarred:      'rgba(255,255,255,0.28)',
  starFilled:         fixHex(COLOR_PALETTE.canary),      // '#ffe600'

  // Accent
  canary:             fixHex(COLOR_PALETTE.canary),
  fandango:           fixHex(COLOR_PALETTE.fandango),    // '#c0268c'
  palatinateBlue:     fixHex(COLOR_PALETTE.palatinateBlue), // '#4740cb'

  // Semantic colors
  errorRed:           '#f87171',
  cardBackground:     '#1e293b',
  successGreen:       '#166534',
};
