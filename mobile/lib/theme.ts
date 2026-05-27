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

// Category colors keyed by the exact tag name returned from the API.
// Darker shades chosen for readability on OLED/dark backgrounds.
// Matches the category → palette assignments in src/lib/config.ts COLORS.eventCategories.
export const CATEGORY_COLORS: Record<string, string> = {
  'Arts+Culture': '#3730a3',   // palatinateBlue-dark  (web: canary)
  'Civic':        '#1e4a4b',   // darkSlateGray-dark
  'Family':       '#7c1a5a',   // fandango-dark
  'Nature':       '#2a5c30',   // calPolyGreen-dark
  'Recreation':   '#0c5464',   // blueGreen-dark
  'Outdoors':     '#0c5464',   // blueGreen-dark
  'School':       '#1e4a4b',   // darkSlateGray-dark
  'Seniors':      '#7c1a5a',   // fandango-dark
  'Sports':       '#b45309',   // amber-dark (web: canary — using amber to differ from arts)
  'Town':         '#312e81',   // palatinateBlue-dark
  'Featured':     '#3730a3',   // palatinateBlue-dark
};

const FALLBACK_COLOR = fixHex(COLORS.primary);

export function getCategoryColor(category: string | null | undefined): string {
  if (!category) return FALLBACK_COLOR;
  return CATEGORY_COLORS[category] ?? FALLBACK_COLOR;
}

export function getCategoryTextColor(_category: string | null | undefined): string {
  // All mobile category backgrounds are dark enough for white text
  return '#ffffff';
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
