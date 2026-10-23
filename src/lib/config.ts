/**
 * Centralized Configuration
 *
 * All theme, location, and map-related settings for the Dertown events application.
 * Update values here to customize appearance and behavior across the entire site.
 *
 * See CUSTOMIZATION.md for detailed guidance on customizing these settings.
 */

// ============================================================================
// SITE IDENTITY
// ============================================================================

// The canonical site URL lives in src/lib/site.ts, not here: resolving it needs
// `import.meta.env`, and this file is also type-checked by the React Native app
// (see mobile/tsconfig.json), where that syntax does not exist.

/**
 * Domain used in iCal UIDs (`UID:<id>@<domain>`).
 *
 * Deliberately a literal rather than derived from SITE_URL: RFC 5545 UIDs must
 * stay stable for the life of an event, and subscribers' calendar clients treat
 * a changed UID as a different event. Changing this re-syncs every subscribed
 * feed, so leave it alone even if the site moves domains.
 */
export const ICAL_UID_DOMAIN = 'dertown.org';

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

/**
 * Initial bounding box for the events map.
 * Scoped to the Leavenworth area — excludes Cashmere (~15km west)
 * and Wenatchee (~40km west) so the default view focuses on town.
 * Format: [west, south, east, north] (LngLatBoundsLike)
 */
export const MAP_INITIAL_BOUNDS: [number, number, number, number] = [
  -120.76, // west
  47.53, // south
  -120.57, // east
  47.66, // north
];

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
  /**
   * Raster tiles for Leaflet maps (modals, organization pages). Leaflet fills
   * {accessToken} from the tile layer options; pass PUBLIC_MAPBOX_TOKEN there.
   */
  embedded: {
    name: 'Mapbox Light',
    url: 'https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/512/{z}/{x}/{y}{r}?access_token={accessToken}',
    tileSize: 512,
    zoomOffset: -1,
    attribution:
      '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
};

// ============================================================================
// FIXED COLORS - the same in every season
// ============================================================================

/**
 * Neutral and feedback colors that stay the same all year. The seasonal colors
 * (page, hero, cards, announcement band) live in SEASON_PALETTES below.
 */
export const COLORS = {
  surfaceLight: '#f3f4f6',
  textSecondary: '#374151',
  textDark: '#1f2937',
  muted: '#6b7280',
  mutedDark: '#4b5563',
  border: '#d1d5db',
  link: '#1d4ed8',

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
// SEASONAL THEME
// ============================================================================

export type SeasonId = 'ski' | 'wildflower' | 'fall' | 'holiday';

/**
 * The seven color roles every season fills:
 * - page: page background
 * - ink: text, and the Civic/School cards
 * - hero: hero band, buttons, links, and the Town/Arts cards
 * - highlight: Featured
 * - sports: Sports (always a red, for the Cascade Kodiaks)
 * - accent: Family/Seniors/Give Back
 * - outdoors: Nature/Recreation/Outdoors
 */
export type PaletteSlot = 'page' | 'ink' | 'hero' | 'highlight' | 'sports' | 'accent' | 'outdoors';

export interface SeasonPalette {
  label: string;
  /** Calendar months (1–12) this season covers. */
  months: number[];
  /** Which slot fills the announcement band. */
  announcement: 'highlight' | 'accent';
  colors: Record<PaletteSlot, string>;
}

export const SEASON_IDS: SeasonId[] = ['ski', 'wildflower', 'fall', 'holiday'];

/**
 * Seasonal palettes. Every card color must reach 4.5:1 with white or #111 text;
 * `npm run test:seasonal-theme` enforces it. See CUSTOMIZATION.md.
 */
export const SEASON_PALETTES: Record<SeasonId, SeasonPalette> = {
  ski: {
    label: 'Sapphire ash',
    months: [1, 2, 3],
    announcement: 'accent',
    colors: {
      page: '#f4f4f4',
      ink: '#1f2a33',
      hero: '#3e5f78',
      highlight: '#a8aacc',
      sports: '#9a5248',
      accent: '#deb0aa',
      outdoors: '#909b99',
    },
  },
  wildflower: {
    label: 'Wildflower',
    months: [4, 5, 6, 7, 8],
    announcement: 'highlight',
    colors: {
      page: '#f8f7f0',
      ink: '#1e2421',
      hero: '#3f3478',
      highlight: '#f0b62b',
      sports: '#c8402a',
      accent: '#b23c7a',
      outdoors: '#4f7a42',
    },
  },
  fall: {
    label: 'Mountain sunset',
    months: [9, 10],
    announcement: 'accent',
    colors: {
      page: '#f8f0e3',
      ink: '#422625',
      hero: '#2b4a33',
      highlight: '#d74100',
      sports: '#6a010f',
      accent: '#ff9b0c',
      outdoors: '#334963',
    },
  },
  holiday: {
    label: 'Nordic',
    months: [11, 12],
    announcement: 'accent',
    colors: {
      page: '#f6f5f2',
      ink: '#222a2e',
      hero: '#2f5d55',
      highlight: '#d8c3a5',
      sports: '#9b1b24',
      accent: '#c0ced7',
      outdoors: '#6f8a6f',
    },
  },
};

/** Which palette slot each event category uses. Related categories share a color. */
export const CATEGORY_SLOTS: Record<string, PaletteSlot> = {
  town: 'hero',
  'arts-culture': 'hero',
  featured: 'highlight',
  sports: 'sports',
  family: 'accent',
  seniors: 'accent',
  'give-back': 'accent',
  nature: 'outdoors',
  recreation: 'outdoors',
  outdoors: 'outdoors',
  civic: 'ink',
  school: 'ink',
};

/** The season for a calendar month (1–12). */
export function getSeasonForMonth(month: number): SeasonId {
  return SEASON_IDS.find((id) => SEASON_PALETTES[id].months.includes(month)) ?? 'fall';
}

/** A `?season=` preview value when it names a season, otherwise the season for `month`. */
export function resolveSeason(requested: string | null, month: number): SeasonId {
  return SEASON_IDS.find((id) => id === requested) ?? getSeasonForMonth(month);
}

// ============================================================================
// MAP MARKER COLORS
// ============================================================================

const markerPalette = SEASON_PALETTES.fall.colors;

export const MARKER_COLORS = {
  current: markerPalette.hero,
  parent: markerPalette.accent,
  sibling: COLORS.muted,
  child: markerPalette.outdoors,
  event: markerPalette.hero,
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
    'give-back',
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
 * Get marker color by type
 */
export function getMarkerColor(type?: string): string {
  if (!type) return MARKER_COLORS.event;
  return MARKER_COLORS[type as keyof typeof MARKER_COLORS] || MARKER_COLORS.event;
}
