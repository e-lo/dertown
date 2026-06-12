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
- Colors: palette, category colors, notification colors
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

#### 3. Modal Maps (Leaflet/Carto)
Used in the Add Location modal:
```typescript
embedded: {
  name: 'Carto Light',
  url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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

### Color Palette (Base Colors)

The base color palette is defined in `/src/lib/config.ts`. This contains 9 core colors that are reused throughout the application:

```typescript
export const COLOR_PALETTE = {
  colors: {
    palatinateBlue: '#4740cbff',    // Primary blue
    canary: '#ffe600ff',             // Yellow
    pigmentGreen: '#4daa57ff',       // Green
    blueGreen: '#219ebcff',          // Teal
    fandango: '#c0268cff',           // Magenta
    calPolyGreen: '#14532dff',       // Dark green
    darkSlateGray: '#2f4445ff',      // Dark gray
    brandeisBlue: '#2472fcff',       // Bright blue
    neonBlue: '#5460f9ff',           // Neon blue
  },
};
```

These colors form the foundation. No new hex codes should be added elsewhere—instead, use colors from this palette.

### Color Assignments (How Palette Colors Are Used)

The `COLORS` object maps palette colors to specific uses:

```typescript
export const COLORS = {
  primary: COLOR_PALETTE.colors.palatinateBlue,
  secondary: COLOR_PALETTE.colors.canary,
  eventCategories: {
    'arts-culture': COLOR_PALETTE.colors.canary,
    'civic': COLOR_PALETTE.colors.darkSlateGray,
    'family': COLOR_PALETTE.colors.fandango,
    // ... etc
  },
  notifications: {
    error: { text: '#d32f2f', bg: '#ffeaea' },
    success: { text: '#388e3c', bg: '#e8f5e9' },
    warning: { text: '#f57c00', bg: '#fef3c7' },
    info: { text: '#1976d2', bg: '#e3f2fd' },
  },
};
```

#### CSS variables & Tailwind tokens (generated)

`config.ts` is the **single source of truth**. A build step generates
`/src/styles/theme.generated.css` from it — you do **not** edit that file (or
hand-maintain CSS variables) anymore.

The generated file emits a Tailwind v4 `@theme` block, so every color/font
becomes both a CSS variable **and** a real utility class automatically:

```css
@theme {
  --color-fandango: #c0268cff;        /* → bg-fandango, text-fandango, border-fandango, … */
  --color-category-family: #c0268cff; /* → bg-category-family, text-category-family, … */
  --font-sans: 'Inter', …;            /* → font-sans */
}
:root {
  --palette-fandango: var(--color-fandango);  /* back-compat alias */
  --color-error-text: #d32f2f;                /* used via var() */
}
```

**Key principle:** change a color in **`config.ts` only**, then run
`npm run theme:generate` to refresh `theme.generated.css` and commit it (it also
runs automatically on `npm run dev` via the `predev` hook). The committed
generated file is what the production build uses, so the build itself doesn't
depend on the generator. No more keeping two files in sync by hand.

> `/src/styles/theme.css` now holds only component/FullCalendar styles that
> aren't expressible as plain utilities — not color definitions.

### Event Category Colors

Each event category has its own color. The available categories are:
- arts-culture, civic, family, nature, recreation, outdoors, school, seniors, sports, town

**To customize category colors:**

Edit `eventCategories` in the `COLORS` object in `/src/lib/config.ts`:

```typescript
eventCategories: {
  'arts-culture': COLOR_PALETTE.colors.canary,        // References palette
  'civic': COLOR_PALETTE.colors.darkSlateGray,
  'family': COLOR_PALETTE.colors.fandango,
  // ... more categories
}
```

Then add corresponding CSS variables in `/src/styles/theme.css`:

```css
--color-category-arts-culture: var(--palette-canary);
--color-category-civic: var(--palette-dark-slate-gray);
/* ... etc */
```

**Best practice:** Always reference palette colors (not hex codes). This keeps the color palette single-sourced.

### Map Marker Colors

Marker colors for location hierarchies are configured in `/src/lib/config.ts`:

```typescript
export const MARKER_COLORS = {
  current: COLORS.primary,              // Current location
  parent: COLORS.eventCategories.family, // Parent in hierarchy
  sibling: '#6b7280',                   // Related location (muted gray)
  child: COLOR_PALETTE.colors.pigmentGreen, // Child location
  event: COLORS.primary,                // Event marker
};
```

Reference palette or color assignment colors (not raw hex codes) where possible.

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
import { DEFAULT_LOCATION, MAP_STYLES, COLOR_PALETTE } from '@/lib/config';

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

### Task: Change Primary Color (Brand Update)

1. **Update the palette** in `config.ts`:
   ```typescript
   export const COLOR_PALETTE = {
     colors: {
       palatinateBlue: '#your-new-brand-color',  // Change this
       // ... other colors stay the same
     }
   };
   ```

2. **Mirror the change in CSS** `/src/styles/theme.css`:
   ```css
   --palette-palatinate-blue: #your-new-brand-color;
   ```

3. All components using `--color-primary` will automatically update.

### Task: Add a New Event Category

1. **Add the category to the database** (tags table) first
2. **Add color mapping** in `config.ts`:
   ```typescript
   eventCategories: {
     // ... existing categories
     'workshop': COLOR_PALETTE.colors.neonBlue,  // Use palette color
   }
   ```
3. **Add CSS variable** in `/src/styles/theme.css`:
   ```css
   --color-category-workshop: var(--palette-neon-blue);
   ```

### Task: Adjust Notification Colors

Update error/success/warning/info colors in `COLORS.notifications`:

```typescript
notifications: {
  error: { text: '#your-error-text', bg: '#your-error-bg' },
  success: { text: '#your-success-text', bg: '#your-success-bg' },
  // ... etc
}
```

Then add corresponding CSS variables in `theme.css`:

```css
--color-error-text: #your-error-text;
--color-error-bg: #your-error-bg;
/* ... etc */
```

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
- Ensure category name in `eventCategories` matches exactly with tag names in database

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
