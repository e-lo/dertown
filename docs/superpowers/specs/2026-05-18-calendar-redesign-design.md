# Calendar Redesign — Design Spec

**Date:** 2026-05-18
**Status:** Approved

## Context

The current dertown.org/calendar is built on FullCalendar v6 with heavy customization layered on top. It has several usability problems: event titles truncate in the month grid, tooltips bleed off-screen, the layout is crowded, and filtering is limited to URL params with no in-page UI. The goal is a full visual and functional rework — improved legibility, better aesthetics consistent with the existing Dertown design system, and a reusable component foundation that can serve other event collections (kids activities, summer camps, etc.) and eventually user accounts/favoriting.

The approach is to **drop FullCalendar entirely** and replace it with a custom vanilla JS + Astro component. FullCalendar was already 80% overridden; removing it eliminates CSS fighting and the constraint it placed on layout. All date logic uses `date-fns` (already in project).

---

## Files

### Created
| File | Purpose |
|---|---|
| `src/components/CalendarV2.astro` | New component shell; replaces `Calendar.astro` |
| `public/calendar-v2.js` | All interactivity: rendering, navigation, tooltips, search, filtering |
| `src/pages/api/calendar/search.ts` | New search autocomplete endpoint |

### Modified
| File | Change |
|---|---|
| `src/pages/calendar.astro` | Swap `<Calendar>` for `<CalendarV2>` |
| `src/styles/components.css` | Add calendar styles using existing CSS variables |

### Removed
| File | Reason |
|---|---|
| `public/fullcalendar-init.js` | Replaced by `calendar-v2.js` |
| FullCalendar CDN script tags | In `Calendar.astro`; removed with the component |

---

## Toolbar

Full-width, Palatinate Blue (`#4740cb`) background. No border or card treatment — runs edge to edge.

### Row 1 — Main toolbar (height: 52px)

**Left group:**
- `chevron_left` icon button → previous period
- `chevron_right` icon button → next period
- `calendar_month` icon button → triggers a hidden `<input type="date">` for jump-to-date; tooltip: "Jump to date"
- "Today" pill button (rounded, semi-transparent white fill) → jump to current week

**Center:** Period label — `May 19 – 25, 2025`. Month rendered in white, rest slightly less bright. `font-size: 17px`, `font-weight: 700`.

**Right group:** View toggle pill group with icon buttons:
- `calendar_view_month` → Month view; tooltip: "Month"
- `calendar_view_week` → Week view (default desktop); tooltip: "Week"
- `calendar_view_day` → Day view; tooltip: "Day"

Active view button gets `rgba(255,255,255,0.22)` background. Group sits in a `rgba(0,0,0,0.2)` pill container.

All icon buttons: tooltip appears above on hover (dark `#1f2937` popover, 300ms delay). No text labels on icon buttons except "Today".

### Row 2 — Sub-bar (white background, 1px bottom border `#e5e7eb`)

**Search:** Ghost text `Search…` with `search` icon. Clicking expands the input in-place with a focus ring (`#4740cb`). As user types (debounced 200ms), autocomplete dropdown appears below — up to 8 results, each with a left color bar matching the event's category, bold title with matched text highlighted in `#4740cb`, and a meta line (`Day Date · Time · Category`). Pressing Enter jumps the calendar to the week of the first result. Clicking a result navigates to `/events/{id}`.

**Category filter:** `tune` icon + "Categories" label. When filters are active, a count badge appears (`#4740cb` background, white text). Clicking opens a dropdown panel:
- Header: "Filter by category" label + "Clear all" button
- One row per category: color dot (10px circle) + name + checkbox
- Checking a category adds it to `?tag=` URL param (comma-separated for multi-select)
- Panel closes on outside click

---

## Calendar Grid

### Adaptive columns

Columns adapt to screen width via JS-computed `grid-template-columns`:

| Breakpoint | Columns |
|---|---|
| `< 640px` | 1 (agenda/mobile) |
| `640–767px` | 2 |
| `768–1023px` | 3 |
| `1024–1279px` | 5 |
| `1280px+` | 7 |

Navigation arrows move by one full week (Mon–Sun) in Week view, one day in Day view, and one month in Month view. On resize, the column count recalculates and the view re-renders to the week containing the currently displayed date.

### Day header

```
MON          ← 10px, 700, uppercase, #9ca3af
19           ← 28px, 700, #111827
```

Today's number is wrapped in a filled Palatinate Blue circle (42×42px, border-radius 50%). Month context lives only in the toolbar period label — not repeated under each day number. On mobile (1-col), the day header is inline: circle/number on the left, day name + `May 2025` to the right.

### Column scrolling

Each `.day-events` container has `max-height: 320px` (desktop) / uncapped (mobile) with `overflow-y: auto`. A gradient fade (`mask-image: linear-gradient(to bottom, black 80%, transparent 100%)`) hints at overflow; removed on hover so the full list is visible while scrolling. Thin 3px scrollbar (`#d1d5db`).

Empty days render a "No events" placeholder in `#e5e7eb`, italic.

---

## Event Cards

```css
border-radius: 0 8px 8px 0;   /* square left, rounded right */
border-left: 3px solid <category-color>;
background: white;
box-shadow: 0 1px 3px rgba(0,0,0,0.07);
padding: 9px 11px;
```

**Category left-border colors:**
| Category | Color |
|---|---|
| Arts & Culture | `#ffe600` |
| Family | `#c0268c` |
| Nature | `#4daa57` |
| Recreation & Outdoors | `#219ebc` |
| Civic | `#2f4445` |
| Town / default | `#4740cb` |

**Card content (top to bottom):**
1. Time — `10px`, `500`, `#9ca3af`. Duration appended when end time exists: `2:00 PM · 3 hrs`
2. Title — `13px`, `600`, `#111827`, `line-height: 1.35`
3. Location — `11px`, `#b0b7c3`, `text-overflow: ellipsis`. No icon.
4. Category tag pill — shown only when no single-category filter is active (avoids redundancy). `10px`, `600`, colored background tint matching category.

**All-day events:** `border-left: none`, `border-radius: 6px`, `background: #eef2ff`, `border: 1px dashed #c7c4f5`. No time line.

**Hover:** `transform: translateY(-1px)`, stronger shadow. **Click:** navigate to `/events/{id}`.

**Concurrent events** (same time, same day): stack vertically in chronological order. No sub-columns, no collapse. Column scrolls to reveal all.

---

## Tooltips

On hover (300ms delay), a popover appears with full event detail:
- Title (`13px`, `700`)
- Date + time range (`Mon May 19 · 2:00–5:00 PM`)
- Location (if present)
- Description excerpt (first ~120 chars, if present)
- Category tag pill

**Smart positioning** using `getBoundingClientRect()`:
- Card in left half of viewport → tooltip opens to the right
- Card in right half → opens to the left
- Card near top → opens below
- Card near bottom → opens above

Tooltip is a white card (`border-radius: 10px`, `box-shadow: 0 8px 24px rgba(0,0,0,0.15)`, `border: 1px solid #e5e7eb`, `width: 240px`). Dismissed on mouseout or when another tooltip opens. Never shown on touch devices (tap goes directly to event page).

---

## Search API

**Endpoint:** `GET /api/calendar/search?q={query}`

- Searches `title`, `location.name`, `organization.name` (case-insensitive, substring match)
- Returns max 8 results: `{ id, title, start_date, start_time, primaryTag }`
- Reuses existing Supabase client and `public_events` view
- No auth required (public events only)

---

## Mobile (< 640px)

- Single-column agenda view; days stack vertically; scrolling is the primary navigation
- Toolbar compresses: arrows + period label remain; "Today" and date picker merge into the `calendar_month` icon (opens date input); view toggle hidden (always agenda on mobile)
- Sub-bar: `search` icon expands to full-width input overlay; `tune` icon expands to full-width bottom-sheet style panel for category filter
- Week navigation: swipe left/right (touch events on the grid container) + toolbar arrows
- Day header inline format: `[circle/number] [Day name\nMonth Year]`

---

## Reusability

`CalendarV2.astro` accepts props to enable other use cases:

```typescript
interface Props {
  title?: string;           // Page heading (default: "Calendar")
  apiEndpoint?: string;     // Default: /api/calendar/events
  defaultView?: 'week' | 'day' | 'month';  // Default: 'week'
  showSearch?: boolean;     // Default: true
  showCategoryFilter?: boolean;  // Default: true
  initialTag?: string;      // Pre-selected category filter
  initialOrg?: string;      // Pre-filtered org ID
}
```

This allows `/kids-activities`, `/summer-camps`, etc. to embed the same component with a different data endpoint and filtered defaults.

---

## Not in scope (future)

- User accounts / event favoriting
- Admin inline event editing from calendar
- iCal export (currently exists on event detail page, unchanged)
- Month view full card design — Month view button is present and functional: renders a simple 6-row grid with event count pills per day; clicking a day switches to Day view for that date. No full card layout in Month view.

---

## Verification

1. `npm run dev` — calendar loads at `/calendar` with new component
2. Resize browser: confirm column counts change at each breakpoint
3. Dense day (Saturday in test data): confirm scroll works, fade hint shows, concurrent events stack
4. Hover event card: confirm tooltip appears, positions correctly for left/right/top/bottom edge cards
5. Search: type "farm" — confirm autocomplete shows Farmers Market results with color bars
6. Category filter: select "Family" — confirm only Family events shown, URL updates to `?tag=Family`, badge shows count 1
7. "Today" button: confirm jumps to current week
8. Date picker: select a future date — confirm calendar jumps to that week
9. Mobile (375px): confirm single column, inline day header, swipe navigation, expanding search/filter
10. Navigate to event by clicking card — confirm `/events/{id}` loads
