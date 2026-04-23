/**
 * Centralized Configuration
 *
 * All theme, location, and map-related settings for the Dertown events application.
 * Update values here to customize appearance and behavior across the entire site.
 *
 * See CUSTOMIZATION.md for detailed guidance on customizing these settings.
 */

// ============================================================================
// LOCATION SETTINGS
// ============================================================================

/** Default location: Leavenworth, WA */
export const DEFAULT_LOCATION = {
  name: 'Leavenworth',
  /** [latitude, longitude] for centering maps and default location */
  coordinates: [47.5962, -120.6615] as [number, number],
  /** Default zoom level for location-focused maps */
  defaultZoom: 14,
};

/** Map center point (can differ from DEFAULT_LOCATION) */
export const MAP_CENTER = {
  coordinates: [-120.6615, 47.5963] as [number, number],
  zoom: 11,
};

// ============================================================================
// MAP STYLES AND CONFIGURATION
// ============================================================================

export const MAP_STYLES = {
  /** Default style for detail/location maps (MapboxMap component) */
  detail: {
    name: 'Mapbox Outdoors',
    url: 'mapbox://styles/mapbox/outdoors-v12',
    defaultZoom: 14,
  },
  /** Style for event list map view */
  eventList: {
    name: 'Mapbox Light',
    url: 'mapbox://styles/mapbox/light-v11',
    defaultZoom: 11,
  },
  /** Style for modals and embedded maps (Leaflet/Carto) */
  embedded: {
    name: 'Carto Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
};

// ============================================================================
// COLOR PALETTE - Base colors only
// ============================================================================

/**
 * Base color palette - 9 primary colors used throughout the app.
 * These are referenced by COLOR_PALETTE below for assignment to specific uses.
 * Change these values to update the entire color scheme globally.
 */
export const COLOR_PALETTE = {
  palatinateBlue: '#4740cbff',
  canary: '#ffe600ff',
  pigmentGreen: '#4daa57ff',
  blueGreen: '#219ebcff',
  fandango: '#c0268cff',
  calPolyGreen: '#14532dff',
  darkSlateGray: '#2f4445ff',
  brandeisBlue: '#2472fcff',
  neonBlue: '#5460f9ff',
};

// ============================================================================
// COLOR ASSIGNMENTS - How palette colors are used
// ============================================================================

/**
 * Color assignments: maps palette colors to specific uses throughout the app.
 * These are the values referenced in CSS variables and components.
 */
export const COLORS = {
  // Theme assignments
  primary: COLOR_PALETTE.palatinateBlue,
  secondary: COLOR_PALETTE.canary,
  background: COLOR_PALETTE.palatinateBlue,
  surface: '#f9fafb',
  text: '#111827',
  muted: '#6b7280',

  // Event category colors (must match tag names in database)
  eventCategories: {
    'arts-culture': COLOR_PALETTE.canary,
    civic: COLOR_PALETTE.darkSlateGray,
    family: COLOR_PALETTE.fandango,
    nature: COLOR_PALETTE.calPolyGreen,
    recreation: COLOR_PALETTE.blueGreen,
    outdoors: COLOR_PALETTE.blueGreen,
    school: COLOR_PALETTE.darkSlateGray,
    seniors: COLOR_PALETTE.fandango,
    sports: COLOR_PALETTE.canary,
    town: COLOR_PALETTE.palatinateBlue,
    featured: COLOR_PALETTE.canary,
  },

  // Text colors for events (dark for light backgrounds, white for dark)
  eventTextColors: {
    'arts-culture': '#111111',
    featured': '#111827',
    sports: '#111111',
    default: '#ffffff',
  },

  // Notification/alert colors (user feedback)
  notifications: {
    error: { text: '#d32f2f', bg: '#ffeaea' },
    success: { text: '#388e3c', bg: '#e8f5e9' },
    warning: { text: '#f57c00', bg: '#fef3c7' },
    info: { text: '#1976d2', bg: '#e3f2fd' },
  },
};

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const TYPOGRAPHY = {
  fontFamilies: {
    sans: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    serif: "'Georgia', serif",
    mono: "'Menlo', 'Monaco', monospace",
  },
};

// ============================================================================
// MAP MARKER COLORS
// ============================================================================

export const MARKER_COLORS = {
  current: COLOR_PALETTE.brandeisBlue,
  parent: COLOR_PALETTE.fandango,
  sibling: COLORS.muted,
  child: COLOR_PALETTE.pigmentGreen,
  event: COLOR_PALETTE.brandeisBlue,
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const CONSTANTS = {
  /** Default map height in rem units */
  defaultMapHeight: '16rem',

  /** Event statuses used in the system */
  eventStatuses: ['approved', 'pending', 'draft', 'cancelled'] as const,

  /** Tag categories available for events */
  tagCategories: [
    'arts-culture',
    'civic',
    'family',
    'nature',
    'recreation',
    'outdoors',
    'school',
    'seniors',
    'sports',
    'town',
  ] as const,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the color for an event category
 * Falls back to primary color if category not found
 */
export function getEventCategoryColor(category: string): string {
  const color = COLORS.eventCategories[category as keyof typeof COLORS.eventCategories];
  return color || COLORS.primary; // fallback
}

/**
 * Get the text color for an event category
 * Returns dark text for light backgrounds, white for dark backgrounds
 */
export function getEventTextColor(category: string): string {
  const color = COLORS.eventTextColors[category as keyof typeof COLORS.eventTextColors];
  return color || COLORS.eventTextColors.default;
}

/**
 * Get marker color by type
 */
export function getMarkerColor(type?: string): string {
  if (!type) return MARKER_COLORS.event;
  return MARKER_COLORS[type as keyof typeof MARKER_COLORS] || MARKER_COLORS.event;
}
