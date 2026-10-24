# Customization Guide

This guide explains how to customize the theme, colors, map configuration, and location settings for the Dertown events application.

## Overview

All **customizable settings** are centralized in two files:

| File | Purpose |
|------|---------|
| `/src/lib/config.ts` | Central configuration for colors, fonts, location, and map settings |
| `/src/styles/theme.generated.css` | Auto-generated from config.ts (`@theme` tokens + CSS vars) — do not edit |
| `/src/styles/theme.css` | Component / FullCalendar styles only (no color definitions) |

### What's Customizable vs. Design System

**Customizable** (in config.ts):
- Colors: seasonal palettes, category grouping, notification colors
- Fonts: font families
- Location: default coordinates and map center
- Map styles: basemap URLs and zoom levels

**Design System** (in components, NOT in config):
- Shadows, spacing, padding, border-radius
- Button styles, badge styles, component layouts
- These are defined in individual Astro components and CSS files

The distinction ensures that config.ts remains focused on **what changes per deployment** (colors, location, fonts) while design patterns stay in **components where they belong**.

Changes to config values are automatically reflected across the entire application.

---

## Location Settings

### Changing the Default Location

To change the default location (currently Leavenworth, WA):

**File:** `/src/lib/config.ts`

```typescript
export const DEFAULT_LOCATION = {
  name: 'Leavenworth',
  coordinates: [47.5962, -120.6615],  // [latitude, longitude]
  defaultZoom: 14,
};
```

**Example:** To change to Seattle, WA:
```typescript
export const DEFAULT_LOCATION = {
  name: 'Seattle',
  coordinates: [47.6062, -122.3321],
  defaultZoom: 14,
};
```

### Changing the Map Center Point

The map center can be different from the default location. This allows the map to focus on a different point for the event list view:

**File:** `/src/lib/config.ts`

```typescript
export const MAP_CENTER = {
  coordinates: [-120.6615, 47.5963],  // [longitude, latitude] - note: different order!
  zoom: 11,
};
```

**Note:** Map center uses `[longitude, latitude]` order, while DEFAULT_LOCATION uses `[latitude, longitude]`. Be careful with the order!

---

## Map Styles & Configuration

### Changing the Basemap

Three different basemaps are configured for different parts of the application:

**File:** `/src/lib/config.ts` → `MAP_STYLES` object

#### 1. Detail Maps (Location Pages)
Used for showing individual location details:
```typescript
detail: {
  name: 'Mapbox Outdoors',
  url: 'mapbox://styles/mapbox/outdoors-v12',
  defaultZoom: 14,
}
```

**Available Mapbox styles:**
- `mapbox://styles/mapbox/light-v11` – Simple light style (similar to Carto Positron)
- `mapbox://styles/mapbox/dark-v11` – Simple dark style
- `mapbox://styles/mapbox/streets-v12` – Detailed streets map (default)
- `mapbox://styles/mapbox/outdoors-v12` – Terrain with outdoor features (current)
- `mapbox://styles/mapbox/satellite-v9` – Satellite imagery

See [Mapbox Documentation](https://docs.mapbox.com/api/maps/styles/) for full list.

#### 2. Event List Map
Used for the `/events/map` page showing all events:
```typescript
eventList: {
  name: 'Mapbox Light',
  url: 'mapbox://styles/mapbox/light-v11',
  defaultZoom: 11,
}
```

#### 3. Leaflet Maps (Mapbox raster tiles)
Used in the Add Location modal and organization pages. Uses the same `PUBLIC_MAPBOX_TOKEN`, which Leaflet substitutes for `{accessToken}`:
```typescript
embedded: {
  name: 'Mapbox Light',
  url: 'https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/512/{z}/{x}/{y}{r}?access_token={accessToken}',
  tileSize: 512,
  zoomOffset: -1,
  attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}
```

### Adjusting Zoom Levels

Zoom levels can be changed in two places:

1. **Default zoom for each map style** (in `MAP_STYLES`)
2. **Specific component behavior** (components can override with their own zoom)

For example, in `/src/components/MapboxMap.astro`:
```typescript
interface Props {
  zoom?: number;  // Can pass custom zoom to individual maps
}
```

---

## Color Customization

### Seasonal palettes

The site changes palette with the season. The palettes live in `SEASON_PALETTES` in `/src/lib/config.ts`:

| Season | Months | Palette |
|---|---|---|
| `ski` | January–March | Sapphire ash |
| `wildflower` | April–August | Wildflower |
| `fall` | September–October | Mountain sunset |
| `holiday` | November–December | Nordic |

Each season fills the same seven color roles ("slots"):

| Slot | Used for |
|---|---|
| `page` | Page background |
| `ink` | Body text, and the Civic and School cards |
| `hero` | Hero band, buttons and links, and the Town and Arts & Culture cards |
| `highlight` | Featured |
| `sports` | Sports (always a red, for the Cascade Kodiaks) |
| `accent` | Family, Seniors and Give Back |
| `outdoors` | Nature, Recreation and Outdoors |

`announcement` names the slot that fills the announcement band (`'highlight'` or `'accent'`):

```typescript
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
```

**Rules the tests enforce** (`npm run test:seasonal-theme`):
- Every month belongs to exactly one season.
- A season uses at most seven distinct colors.
- White text on `hero` reaches 4.5:1 contrast.
- Every card color and the announcement band reach 4.5:1 with either white or `#111111` text. The generator picks whichever reads better, so pale colors get dark text automatically.

### How the season is chosen

`<html>` carries `data-season="…"`. A small inline script in the page head (`/src/components/SeasonScript.astro`) sets it from the visitor's date before the page draws. Because the date is checked in the browser, cached pages switch seasons on their own, with no cache purge.

To preview a season, add `?season=fall` (or `holiday`, `ski`, `wildflower`) to any URL.

### Event category colors

Categories don't have their own colors. Each one points at a slot through `CATEGORY_SLOTS` in `config.ts`, and related categories share a slot:

```typescript
export const CATEGORY_SLOTS = {
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
```

The generator turns each entry into a `.bg-event-<category>` class with the season's background and a readable text color. List cards, tag pills, badges and calendar entries all use these classes. Tags with no entry fall back to `.bg-event-default` (the hero color).

### Fixed colors

`COLORS` in `config.ts` holds colors that stay the same all year: neutral grays, the border and link colors, and the error/success/warning/info notification colors.

### CSS variables & Tailwind tokens (generated)

`config.ts` is the **single source of truth**. `npm run theme:generate` runs `/scripts/generate-theme.ts`, which writes `/src/styles/theme.generated.css`. Don't edit that file by hand. The generator also runs automatically on `npm run dev` via the `predev` hook. Commit the regenerated file, because the production build uses the committed copy.

The generated file contains:
- **A Tailwind `@theme` block** with the semantic colors (`primary`, `primary-light`, `primary-dark`, `secondary`, `surface`, `text`, `category-*`). These become utilities such as `bg-primary`, `text-primary` and `from-primary`.
- **One `:root[data-season="…"]` block per season** that overrides those variables, plus the `*-text`, `--color-announcement-bg/-text` and `--gradient-hero` values.
- **The `.bg-event-*` category rules.**
- **Older names** (`--palette-canary`, `bg-fandango`, `bg-blue-green`, …), mapped onto the seasonal colors so existing markup keeps working.

Use the semantic utilities (`bg-primary`, `text-primary`, `bg-surface`) in new markup, not fixed Tailwind colors like `indigo-600`, so the page follows the season. Admin pages still use some fixed indigo classes.

### Map Marker Colors

Marker colors for location hierarchies are in `MARKER_COLORS` in `config.ts`. They're drawn from the fall palette's slots (`hero`, `accent`, `outdoors`) plus the fixed muted gray.

---

## Typography

### Font Families

Three font families are configured:

```typescript
export const TYPOGRAPHY = {
  fontFamilies: {
    sans: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    serif: "'Georgia', serif",
    mono: "'Menlo', 'Monaco', monospace",
  },
};
```

These are also used as CSS variables in `/src/styles/theme.css`:
```css
:root {
  --font-sans: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  --font-serif: 'Georgia', serif;
  --font-mono: 'Menlo', 'Monaco', monospace;
}
```

#### To change fonts:

1. Update the font family in `config.ts` (for JavaScript code)
2. Update the corresponding CSS variable in `theme.css` (for CSS code)
3. Make sure the font is available:
   - Either already installed on the system
   - Or imported via `@import` in your CSS file

**Example:** To use "Roboto" instead of "Inter":
```typescript
sans: "'Roboto', 'Helvetica Neue', Arial, sans-serif",
```

And in `theme.css`:
```css
--font-sans: 'Roboto', 'Helvetica Neue', Arial, sans-serif;
```

---

## Working with Config Values in Components

### In Astro Components (Server-side)

Import and use config values directly:

```astro
---
import { DEFAULT_LOCATION, MAP_STYLES, SEASON_PALETTES } from '@/lib/config';

const coords = DEFAULT_LOCATION.coordinates;
const mapStyle = MAP_STYLES.detail.url;
---

<div>{DEFAULT_LOCATION.name}</div>
```

### In Client-side JavaScript

Use `define:vars` to pass config values to client scripts:

```astro
<script define:vars={{ defaultCoords: DEFAULT_LOCATION.coordinates }}>
  // Now you can use defaultCoords in the script
  map.setCenter(defaultCoords);
</script>
```

---

## Common Customization Tasks

### Task: Change a Season's Colors

1. **Edit the season** in `SEASON_PALETTES` in `config.ts`, for example `fall.colors.hero`.
2. **Run the checks:** `npm run test:seasonal-theme` confirms every card and the announcement band stay readable and the season stays at seven colors or fewer.
3. **Regenerate the CSS:** `npm run theme:generate`, then commit `src/styles/theme.generated.css`.
4. **Preview it:** open any page with `?season=fall`.

To change which months a season covers, edit its `months`. Each month 1–12 must belong to exactly one season.

### Task: Add a New Event Category

1. **Add the category to the database** (tags table) first.
2. **Pick a slot for it** in `CATEGORY_SLOTS` in `config.ts`:
   ```typescript
   export const CATEGORY_SLOTS = {
     // ... existing categories
     workshop: 'accent',
   };
   ```
3. **Add it to `CONSTANTS.tagCategories`**, and to `TAG_SLUGS` in `mobile/lib/theme.ts` if the app should color it.
4. **Regenerate the CSS:** `npm run theme:generate`. That creates `.bg-event-workshop` for every season.

### Task: Adjust Notification Colors

Update error/success/warning/info colors in `COLORS.notifications`:

```typescript
notifications: {
  error: { text: '#your-error-text', bg: '#your-error-bg' },
  success: { text: '#your-success-text', bg: '#your-success-bg' },
  // ... etc
}
```

Then run `npm run theme:generate` to refresh the CSS variables.

### Task: Switch Map Provider

**For Mapbox (built-in):** Change the style URL in `MAP_STYLES`:
```typescript
detail: {
  name: 'Your Map Name',
  url: 'mapbox://styles/mapbox/your-style',
},
```

**For other providers (Leaflet, OpenStreetMap, etc.):**
1. Update the `embedded.url` in `MAP_STYLES` for the Add Location modal
2. Update components to use the new tile layer format if needed
3. Ensure proper attribution in map code

---

## Testing Your Changes

After modifying `config.ts`, check these areas to ensure your changes look correct:

1. **Event List Map** (`/events/map`) – Tests map style and center
2. **Location Detail Page** – Tests detail map style and markers
3. **Calendar View** – Tests theme colors and text contrast
4. **Event Lists** – Tests event category colors and text readability
5. **Add Location Modal** – Tests embedded map style and default coordinates

---

## Troubleshooting

### Colors not updating in browser
- Clear browser cache
- In development, save the file to trigger a refresh
- Check that you updated both `config.ts` AND `theme.css` if relevant

### Map not showing correct center
- Verify coordinate format: `[longitude, latitude]` for MAP_CENTER, `[latitude, longitude]` for DEFAULT_LOCATION
- Check that zoom level is reasonable (typically 10-18)

### Font not applying
- Ensure font is imported in CSS (if using web fonts)
- Check font-family CSS property is using the correct variable name
- Clear browser cache

### Event colors appearing wrong
- Verify hex color format is correct: `#RRGGBB` or `#RRGGBBAA`
- Check text color for contrast with background
- Ensure the category name in `CATEGORY_SLOTS` matches the tag name in the database exactly (kebab-case)

---

## External Services & Accounts (per-deployment)

Standing up Der Town for a new town/organization means creating accounts for these
services and putting their keys into env vars — `.env` locally, **Netlify → Site
config → Environment variables** in production (scope each to **Builds + Functions**).
The complete, commented list is in [`.env.example`](.env.example).

| Service | Used for | Env var(s) | Needed? |
|---------|----------|-----------|---------|
| **Supabase** | database, auth, RLS | `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Required |
| **Netlify** | hosting, SSR, deploys | (set the above as env vars; `NODE_VERSION` in `netlify.toml`/`.nvmrc`) | Required |
| **Mapbox** | map views | `PUBLIC_MAPBOX_TOKEN` | Required for maps |
| **Sentry** | error tracking (web + mobile) | `PUBLIC_SENTRY_DSN` (+ optional `SENTRY_AUTH_TOKEN`) | Recommended |
| **UptimeRobot** | uptime/health alerts | — (points at `/api/health`) | Recommended |
| **Resend** | transactional email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RECIPIENT_EMAIL` | Optional |
| **Mailgun** | inbound email ingest | `MAILGUN_WEBHOOK_SIGNING_KEY` | Optional |
| **Anthropic** | AI activity import (admin) | `ANTHROPIC_API_KEY` | Optional |

### Monitoring setup

A new deployment should wire up alerting so you hear about outages before your users
do. Quick version — full steps and rationale in **[docs/MONITORING.md](docs/MONITORING.md)**:

1. **Sentry** — create a project (platform: Astro), set `PUBLIC_SENTRY_DSN` in Netlify, redeploy.
2. **UptimeRobot** — add a keyword HTTP monitor on `https://<your-domain>/api/health`, alerting when the response doesn't contain `"eventsQuery": "ok"`.
3. **CI** — already included (`.github/workflows/ci.yml`); make it a required check on `main` so dependency upgrades that break the build/runtime can't merge.

---

## Files Related to Customization

| File | Purpose |
|------|---------|
| `/src/lib/config.ts` | **Central configuration** – All theme, color, location, and map settings |
| `/src/styles/theme.css` | CSS variables for colors and fonts |
| `/src/components/MapboxMap.astro` | Detail map component |
| `/src/pages/events/map.astro` | Event list map |
| `/src/components/ui/AddLocationModal.astro` | Location picker modal |

---

## Getting Help

If you run into issues while customizing:

1. Check the "Troubleshooting" section above
2. Review the example values in `config.ts` comments
3. Ensure all hex color codes are in the correct format
4. Check browser console for any error messages
5. Verify coordinate order (latitude vs longitude)
