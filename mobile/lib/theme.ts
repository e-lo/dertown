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

// Darker category colors for mobile (better readability on OLED/dark backgrounds)
export const CATEGORY_COLORS: Record<string, string> = {
  'arts-culture': '#3730a3',
  civic:          '#1e2e2f',
  family:         '#7c1a5a',
  nature:         '#2a5c30',
  recreation:     '#0c5464',
  outdoors:       '#0c5464',
  school:         '#1e2e2f',
  seniors:        '#7c1a5a',
  sports:         '#3730a3',
  town:           '#312e81',
  featured:       '#3730a3',
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
