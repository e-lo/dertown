# Customization Guide

This guide explains how to customize the theme, colors, map configuration, and location settings for the Dertown events application.

## Overview

All customizable settings are centralized in `/src/lib/config.ts`. This single file controls:
- **Location Settings** – Default location coordinates and map center
- **Map Styles** – Basemap URLs and zoom levels for different views
- **Color Palette** – Theme colors, event category colors, and UI element colors
- **Typography** – Font families used throughout the application

Changes to this file are automatically reflected across the entire application.

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

### Theme Colors

The main theme colors are defined in `/src/lib/config.ts`:

```typescript
export const COLOR_PALETTE = {
  colors: {
    palatinateBlue: '#4740cbff',
    canary: '#ffe600ff',
    pigmentGreen: '#4daa57ff',
    // ... more colors
  },
  theme: {
    primary: '#4740cbff',
    secondary: '#ffe600ff',
    // ... more theme assignments
  },
};
```

#### Also in CSS
Theme colors are also defined as CSS variables in `/src/styles/theme.css`:

```css
:root {
  --palatinate-blue: #4740cbff;
  --canary: #ffe600ff;
  --pigment-green: #4daa57ff;
  /* ... etc */
}
```

If you change colors in `config.ts`, make sure to update the corresponding CSS variables in `theme.css` to keep them in sync.

### Event Category Colors

Each event tag/category has its own color. Categories are:
- arts-culture
- civic
- family
- nature
- recreation
- outdoors
- school
- seniors
- sports
- town

**To customize category colors:**

Edit `COLOR_PALETTE.eventCategories` in `/src/lib/config.ts`:

```typescript
eventCategories: {
  'arts-culture': '#ffe600ff',  // Canary yellow
  'civic': '#2f4445ff',         // Dark slate gray
  'family': '#c0268cff',        // Fandango (magenta)
  // ... more categories
}
```

### Text Colors for Events

Events on dark backgrounds show white text, events on light backgrounds show dark text. These are controlled by:

```typescript
eventTextColors: {
  'arts-culture': '#111111',    // Dark text (light background)
  'featured': '#111827',
  'sports': '#111111',
  default: '#ffffff',           // White text (dark background)
}
```

### Map Marker Colors

Marker colors used in location maps are configured in:

```typescript
export const MARKER_COLORS = {
  current: '#2472fcff',   // Brand blue - primary location
  parent: '#c0268cff',    // Fandango - parent in hierarchy
  sibling: '#6b7280',     // Muted - related location
  child: '#4daa57ff',     // Pigment green - child location
  event: '#2472fcff',     // Same as current
};
```

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

### Task: Change from Light to Dark Theme

1. Update primary and secondary colors in `config.ts`:
   ```typescript
   theme: {
     primary: '#1e293b',      // dark slate
     secondary: '#fbbf24',    // amber
   }
   ```

2. Update event category colors to have good contrast on your chosen primary color

3. Update CSS variables in `theme.css` to match

### Task: Add a New Event Category

1. Add the category to the database tags table first
2. Add color mapping in `config.ts`:
   ```typescript
   eventCategories: {
     // ... existing categories
     'new-category': '#your-hex-color',
   }
   ```
3. Add text color mapping if needed:
   ```typescript
   eventTextColors: {
     // ... existing categories
     'new-category': '#111111 or #ffffff',
   }
   ```

### Task: Switch to a Different Map Provider

**For Mapbox (built-in):** Simply change the style URL in `MAP_STYLES`

**For other providers (advanced):**
1. Update the style URL in `MAP_STYLES`
2. Ensure attribution requirements are met
3. Update any provider-specific code in components

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
