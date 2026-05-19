# Calendar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace FullCalendar with a custom adaptive week-column calendar featuring a Palatinate Blue toolbar, square-left event cards, smart tooltips, category filter dropdown, and search autocomplete.

**Architecture:** Drop `fullcalendar-init.js` and `Calendar.astro` entirely. `CalendarV2.astro` fetches events server-side and passes them as JSON to `public/calendar-v2.js`, a self-contained ES module that handles all rendering and interaction using vanilla JS + existing `date-fns` patterns (no framework). Styles live in `src/styles/components.css` using existing CSS variables.

**Tech Stack:** Astro 4 (SSR), vanilla JS ES modules, Material Symbols Outlined (already loaded), Tailwind CSS + custom CSS variables, Supabase via existing `db.events.getAll()`.

**Design spec:** `docs/superpowers/specs/2026-05-18-calendar-redesign-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/CalendarV2.astro` | Server shell: fetch events, pass as JSON, render container divs |
| Create | `public/calendar-v2.js` | All client interactivity: rendering, nav, tooltips, search, filter |
| Create | `src/pages/api/calendar/search.ts` | Search autocomplete endpoint |
| Modify | `src/pages/calendar.astro` | Swap `<Calendar>` for `<CalendarV2>` |
| Modify | `src/styles/components.css` | Add all calendar CSS |
| Delete | `public/fullcalendar-init.js` | Replaced by calendar-v2.js |
| Delete | `src/components/Calendar.astro` | Replaced by CalendarV2.astro |

---

## Task 1: Calendar CSS

**Files:**
- Modify: `src/styles/components.css` (append to end)

- [ ] **Step 1: Append calendar CSS to components.css**

Add this entire block to the end of `src/styles/components.css`:

```css
/* ============================================================
   CALENDAR V2
============================================================ */

/* --- Toolbar (full-width, Palatinate Blue) --- */
.cal-toolbar {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 20px;
  height: 52px;
  background: var(--palette-palatinate-blue);
  flex-shrink: 0;
}
.cal-toolbar-left { display: flex; align-items: center; gap: 2px; }
.cal-toolbar-right { display: flex; align-items: center; }
.cal-toolbar-spacer { flex: 1; }
.cal-period {
  font-size: 17px;
  font-weight: 700;
  color: white;
  letter-spacing: -0.01em;
  padding: 0 12px;
  white-space: nowrap;
}
.cal-period-month { color: rgba(255,255,255,0.75); }

/* Toolbar icon buttons */
.cal-tb-btn {
  display: flex; align-items: center; justify-content: center;
  height: 36px; min-width: 36px; padding: 0 6px;
  background: transparent; border: none; border-radius: 7px;
  color: rgba(255,255,255,0.85); cursor: pointer;
  position: relative;
  transition: background 0.12s;
}
.cal-tb-btn:hover { background: rgba(255,255,255,0.15); color: white; }

/* Today pill */
.cal-today-btn {
  height: 30px; padding: 0 14px;
  background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 20px;
  font-size: 12px; font-weight: 600;
  color: white; cursor: pointer;
  margin-left: 4px;
  transition: background 0.12s;
}
.cal-today-btn:hover { background: rgba(255,255,255,0.28); }

/* View toggle */
.cal-view-group {
  display: flex; align-items: center;
  background: rgba(0,0,0,0.2); border-radius: 8px;
  padding: 3px; gap: 2px;
}
.cal-view-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 28px; border-radius: 6px;
  background: transparent; border: none; cursor: pointer;
  color: rgba(255,255,255,0.65);
  transition: background 0.12s, color 0.12s;
  position: relative;
}
.cal-view-btn:hover { background: rgba(255,255,255,0.15); color: white; }
.cal-view-btn.active { background: rgba(255,255,255,0.22); color: white; }

/* Toolbar tooltips */
.cal-tb-tip {
  position: absolute; bottom: calc(100% + 7px); left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  background: #1f2937; color: white;
  font-size: 11px; font-weight: 500; padding: 4px 8px;
  border-radius: 5px; opacity: 0; pointer-events: none;
  transition: opacity 0.15s; z-index: 200;
}
.cal-tb-tip::after {
  content: ''; position: absolute; top: 100%; left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent; border-top-color: #1f2937;
}
.cal-tb-btn:hover .cal-tb-tip,
.cal-view-btn:hover .cal-tb-tip { opacity: 1; }

/* --- Sub-bar (search + filter) --- */
.cal-subbar {
  width: 100%;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 20px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  position: relative;
  flex-shrink: 0;
}

/* Search */
.cal-search-wrap { position: relative; }
.cal-search-collapsed {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 8px;
  border: 1px solid #e5e7eb; background: white;
  font-size: 13px; color: #9ca3af; cursor: pointer;
  transition: border-color 0.12s;
}
.cal-search-collapsed:hover { border-color: #4740cb; color: #6b7280; }
.cal-search-expanded {
  display: none;
  align-items: center; gap: 6px;
  border: 1px solid #4740cb; border-radius: 8px;
  background: white; padding: 0 10px;
  box-shadow: 0 0 0 3px rgba(71,64,203,0.1);
  min-width: 280px;
}
.cal-search-expanded.visible { display: flex; }
.cal-search-expanded input {
  border: none; outline: none; font-size: 13px; color: #111827;
  flex: 1; padding: 7px 0; background: transparent;
  font-family: inherit;
}
.cal-search-expanded .material-symbols-outlined { color: #9ca3af; font-size: 18px; }
.cal-search-clear { cursor: pointer; color: #d1d5db; font-size: 16px; }
.cal-search-clear:hover { color: #9ca3af; }

/* Autocomplete dropdown */
.cal-autocomplete {
  position: absolute; top: calc(100% + 6px); left: 0;
  min-width: 320px;
  background: white; border: 1px solid #e5e7eb; border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.11); overflow: hidden; z-index: 300;
  display: none;
}
.cal-autocomplete.visible { display: block; }
.cal-ac-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.1s;
}
.cal-ac-item:last-child { border-bottom: none; }
.cal-ac-item:hover { background: #f9fafb; }
.cal-ac-bar { width: 3px; height: 32px; border-radius: 2px; flex-shrink: 0; }
.cal-ac-title { font-size: 13px; font-weight: 600; color: #111827; }
.cal-ac-title mark {
  background: none; color: var(--palette-palatinate-blue); font-weight: 700;
}
.cal-ac-meta { font-size: 11px; color: #9ca3af; margin-top: 1px; }

/* Category filter */
.cal-filter-wrap { position: relative; }
.cal-filter-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 8px;
  border: 1px solid #e5e7eb; background: white;
  font-size: 13px; font-weight: 500; color: #374151; cursor: pointer;
  transition: border-color 0.12s;
  white-space: nowrap;
}
.cal-filter-btn:hover { border-color: #4740cb; color: #4740cb; }
.cal-filter-btn.active { border-color: #4740cb; color: #4740cb; background: #f0f0fe; }
.cal-filter-count {
  background: var(--palette-palatinate-blue); color: white;
  font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 10px;
}
.cal-filter-panel {
  position: absolute; top: calc(100% + 6px); left: 0;
  width: 230px; background: white;
  border: 1px solid #e5e7eb; border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12); overflow: hidden; z-index: 300;
  display: none;
}
.cal-filter-panel.visible { display: block; }
.cal-filter-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px 8px; border-bottom: 1px solid #f3f4f6;
}
.cal-filter-label { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; }
.cal-filter-clear { font-size: 11px; font-weight: 600; color: var(--palette-palatinate-blue); background: none; border: none; cursor: pointer; font-family: inherit; }
.cal-filter-clear:hover { text-decoration: underline; }
.cal-filter-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 14px; cursor: pointer;
  border-bottom: 1px solid #f9fafb;
  transition: background 0.1s;
}
.cal-filter-item:last-child { border-bottom: none; }
.cal-filter-item:hover { background: #f9fafb; }
.cal-filter-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.cal-filter-name { flex: 1; font-size: 13px; color: #374151; }
.cal-filter-cb {
  width: 16px; height: 16px; border: 2px solid #d1d5db;
  border-radius: 4px; flex-shrink: 0; display: flex;
  align-items: center; justify-content: center;
  transition: all 0.1s;
}
.cal-filter-item.checked .cal-filter-cb { background: var(--palette-palatinate-blue); border-color: var(--palette-palatinate-blue); }
.cal-filter-item.checked .cal-filter-cb::after {
  content: ''; width: 8px; height: 5px;
  border-left: 2px solid white; border-bottom: 2px solid white;
  transform: rotate(-45deg) translate(1px, -1px); display: block;
}

/* --- Grid --- */
.cal-grid-container { padding: 0 20px 20px; }
.cal-week-grid {
  display: grid;
  gap: 10px;
  /* column count set dynamically via JS */
}

/* --- Day column --- */
.cal-day-col { min-width: 0; }
.cal-day-header { margin-bottom: 8px; }
.cal-day-name {
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: #9ca3af; margin-bottom: 3px;
}
.cal-day-num {
  font-size: 28px; font-weight: 700;
  line-height: 1; color: #111827;
}
.cal-day-num.today {
  background: var(--palette-palatinate-blue); color: white;
  width: 42px; height: 42px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
}
/* Mobile inline header */
.cal-day-header-inline {
  display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
}
.cal-day-header-inline .cal-day-num { font-size: 22px; }
.cal-day-header-inline .cal-day-num.today { width: 38px; height: 38px; font-size: 18px; }
.cal-day-meta { line-height: 1.3; }
.cal-day-name-full { font-size: 12px; font-weight: 600; color: #374151; }
.cal-day-month { font-size: 11px; color: #9ca3af; }

/* Day events scroller */
.cal-day-events {
  max-height: 340px;
  overflow-y: auto;
  -webkit-mask-image: linear-gradient(to bottom, black 82%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 82%, transparent 100%);
  padding-bottom: 4px;
  padding-right: 2px;
}
.cal-day-events:hover,
.cal-day-events:focus-within {
  -webkit-mask-image: none;
  mask-image: none;
}
.cal-day-events::-webkit-scrollbar { width: 3px; }
.cal-day-events::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
.cal-day-empty {
  font-size: 11px; color: #e5e7eb;
  font-style: italic; padding: 8px 0;
}

/* --- Event cards --- */
.cal-event {
  border-radius: 0 8px 8px 0;
  padding: 9px 11px; margin-bottom: 7px;
  border-left: 3px solid var(--palette-palatinate-blue);
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.07);
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.1s;
  text-decoration: none; display: block;
}
.cal-event:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.13);
  transform: translateY(-1px);
}
.cal-event.allday {
  border-left: none; border-radius: 6px;
  background: #eef2ff;
  border: 1px dashed #c7c4f5;
}
.cal-event-time {
  font-size: 10px; font-weight: 500; color: #9ca3af; margin-bottom: 2px;
}
.cal-event-title {
  font-size: 13px; font-weight: 600; color: #111827; line-height: 1.35;
}
.cal-event-loc {
  font-size: 11px; color: #b0b7c3; margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cal-event-tag {
  display: inline-block; margin-top: 5px;
  font-size: 10px; font-weight: 600;
  padding: 2px 6px; border-radius: 4px;
}

/* --- Tooltip --- */
.cal-tooltip {
  position: fixed; z-index: 500;
  width: 240px;
  background: white;
  border: 1px solid #e5e7eb; border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  padding: 12px 14px;
  pointer-events: none;
  display: none;
}
.cal-tooltip-title { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 5px; }
.cal-tooltip-row { font-size: 11px; color: #6b7280; margin-bottom: 3px; }
.cal-tooltip-desc { font-size: 11px; color: #6b7280; margin-top: 5px; line-height: 1.5; }
.cal-tooltip-tag {
  display: inline-block; margin-top: 7px;
  font-size: 10px; font-weight: 600;
  padding: 2px 7px; border-radius: 4px;
}

/* --- Month view grid --- */
.cal-month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.cal-month-header { text-align: center; font-size: 10px; font-weight: 700; color: #6b7280; padding: 6px 0; text-transform: uppercase; letter-spacing: 0.06em; }
.cal-month-cell {
  background: white; border-radius: 4px; padding: 4px;
  min-height: 72px; border: 1px solid #f3f4f6; cursor: pointer;
  transition: background 0.1s;
}
.cal-month-cell:hover { background: #f9fafb; }
.cal-month-cell.today { background: #eef2ff; border-color: #c7c4f5; }
.cal-month-cell.other-month .cal-month-day-num { color: #d1d5db; }
.cal-month-day-num { font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 3px; }
.cal-month-pill {
  font-size: 9px; border-radius: 3px; padding: 1px 4px;
  margin-bottom: 1px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
  color: white; display: block;
}
.cal-month-more { font-size: 9px; color: #9ca3af; }

/* --- Mobile overrides --- */
@media (max-width: 639px) {
  .cal-toolbar { padding: 0 12px; }
  .cal-period { font-size: 14px; padding: 0 8px; }
  .cal-subbar { padding: 8px 12px; gap: 6px; }
  .cal-grid-container { padding: 0 12px 16px; }
  .cal-day-events { max-height: none; -webkit-mask-image: none; mask-image: none; }
  .cal-search-expanded { min-width: 0; flex: 1; }
  .cal-filter-panel { left: auto; right: 0; }
  /* Hide Today btn and date picker on mobile — merged into calendar_month icon */
  .cal-today-btn { display: none; }
}
```

- [ ] **Step 2: Verify CSS variables exist**

Run:
```bash
grep -n "palette-palatinate-blue\|palette-canary" src/styles/theme.css
```
Expected: both variables defined (e.g. `--palette-palatinate-blue: #4740cb`). If missing, add them to the `:root` block in `src/styles/theme.css`.

- [ ] **Step 3: Commit**

```bash
git add src/styles/components.css
git commit -m "feat: add calendar v2 CSS foundation"
```

---

## Task 2: CalendarV2.astro Shell

**Files:**
- Create: `src/components/CalendarV2.astro`

- [ ] **Step 1: Create CalendarV2.astro**

```astro
---
import { db } from '../lib/db';
import { transformEventForCalendar } from '../lib/event-utils';

export interface Props {
  title?: string;
  defaultView?: 'week' | 'day' | 'month';
  showSearch?: boolean;
  showCategoryFilter?: boolean;
  initialTag?: string;
  initialOrg?: string;
}

const {
  title = 'Calendar',
  defaultView = 'week',
  showSearch = true,
  showCategoryFilter = true,
  initialTag = '',
  initialOrg = '',
} = Astro.props;

const allEvents = await db.events.getAll();
const calendarEvents = allEvents
  .map(transformEventForCalendar)
  .filter(Boolean);
---

<div
  id="calendar-v2"
  data-events={JSON.stringify(calendarEvents)}
  data-default-view={defaultView}
  data-initial-tag={initialTag}
  data-initial-org={initialOrg}
  data-show-search={String(showSearch)}
  data-show-category-filter={String(showCategoryFilter)}
  style="display:flex;flex-direction:column;min-height:0"
>
  <div id="cal-toolbar" class="cal-toolbar"></div>
  <div id="cal-subbar" class="cal-subbar"></div>
  <div id="cal-grid" class="cal-grid-container"></div>
</div>

<script src="/calendar-v2.js" is:inline></script>
```

- [ ] **Step 2: Confirm db import path is correct**

```bash
grep -n "^import\|^export" src/pages/calendar.astro | head -10
```
Expected: see `import { db } from '../lib/db'` or similar. Adjust the import path in CalendarV2.astro if it differs (e.g. `../../lib/db`).

- [ ] **Step 3: Commit**

```bash
git add src/components/CalendarV2.astro
git commit -m "feat: add CalendarV2 Astro component shell"
```

---

## Task 3: Update calendar.astro

**Files:**
- Modify: `src/pages/calendar.astro`

- [ ] **Step 1: Read current calendar.astro imports and component usage**

```bash
head -40 src/pages/calendar.astro
```

- [ ] **Step 2: Swap Calendar import for CalendarV2**

Find the line importing Calendar (e.g. `import CalendarComponent from '../components/Calendar.astro'`) and change it to:
```astro
import CalendarV2 from '../components/CalendarV2.astro';
```

Find the `<CalendarComponent ...>` usage and replace with:
```astro
<CalendarV2 defaultView="week" showSearch={true} showCategoryFilter={true} />
```

Remove any `calendarEvents` transformation logic from calendar.astro that is now handled inside CalendarV2.astro.

- [ ] **Step 3: Start dev server and confirm page loads without errors**

```bash
npm run dev
```

Navigate to `http://localhost:4321/calendar`. Expected: page loads, no console errors, the `#calendar-v2` div is present in the DOM with `data-events` attribute containing JSON. (The calendar won't render yet — `calendar-v2.js` doesn't exist.)

- [ ] **Step 4: Commit**

```bash
git add src/pages/calendar.astro
git commit -m "feat: wire calendar.astro to CalendarV2 component"
```

---

## Task 4: calendar-v2.js — State, Date Utilities & Init

**Files:**
- Create: `public/calendar-v2.js`

- [ ] **Step 1: Create public/calendar-v2.js with state and date utilities**

```js
// public/calendar-v2.js
'use strict';

// ─── State ──────────────────────────────────────────────────
let state = {
  currentDate: new Date(),
  view: 'week',          // 'week' | 'day' | 'month'
  activeCategories: [],  // [] = all; populated = filter active
  events: [],            // all transformed events from data-events
  showSearch: true,
  showCategoryFilter: true,
};

// ─── Category colours ───────────────────────────────────────
const CATEGORY_COLORS = {
  'arts & culture':        '#ffe600',
  'civic':                 '#2f4445',
  'family':                '#c0268c',
  'nature':                '#4daa57',
  'recreation & outdoors': '#219ebc',
  'outdoors':              '#219ebc',
  'sports':                '#ffe600',
  'school':                '#2f4445',
  'town':                  '#4740cb',
};

function getCategoryColor(category) {
  return CATEGORY_COLORS[(category || '').toLowerCase()] || '#4740cb';
}

// ─── Date utilities ─────────────────────────────────────────

/** Returns the Monday of the week containing `date`. */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...6=Sat
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns array of 7 Date objects starting from Monday. */
function getWeekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Returns 'YYYY-MM-DD' for a Date object (local time). */
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Extracts 'YYYY-MM-DD' from an ISO string like '2025-12-02T16:00:00-08:00'. */
function eventDateStr(isoString) {
  return isoString.substring(0, 10);
}

/** Returns true if `dateStr` ('YYYY-MM-DD') is today. */
function isToday(dateStr) {
  return dateStr === toDateStr(new Date());
}

/** Formats an ISO time string to '4:00 PM'. */
function formatTime(isoString) {
  if (!isoString) return '';
  const timePart = isoString.substring(11, 16); // 'HH:MM'
  const [h, m] = timePart.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

/** Returns a duration string like '· 2 hrs' or '· 45 min', or '' if no end. */
function formatDuration(startIso, endIso) {
  if (!endIso) return '';
  const diff = (new Date(endIso) - new Date(startIso)) / 60000; // minutes
  if (diff <= 0) return '';
  if (diff < 60) return `· ${diff} min`;
  const hrs = diff / 60;
  return `· ${hrs === Math.floor(hrs) ? hrs : hrs.toFixed(1)} hr${hrs !== 1 ? 's' : ''}`;
}

/** Format date for display: 'Mon May 19'. */
function formatDateDisplay(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Format month+year: 'May 19 – 25, 2025'. */
function formatWeekRange(weekStart) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const month = weekStart.toLocaleDateString('en-US', { month: 'long' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'long' });
  const year = end.getFullYear();
  if (month === endMonth) {
    return { month, rest: ` ${weekStart.getDate()} – ${end.getDate()}, ${year}` };
  }
  return { month, rest: ` ${weekStart.getDate()} – ${endMonth} ${end.getDate()}, ${year}` };
}

/** How many columns to show based on window width. */
function getColumnCount() {
  const w = window.innerWidth;
  if (w < 640)  return 1;
  if (w < 768)  return 2;
  if (w < 1024) return 3;
  if (w < 1280) return 5;
  return 7;
}

/** Filter events by active categories. Returns all if none active. */
function getFilteredEvents() {
  if (state.activeCategories.length === 0) return state.events;
  return state.events.filter(e =>
    state.activeCategories.some(cat => (e.category || '').toLowerCase() === cat.toLowerCase())
  );
}

/** Group events array by date string. */
function groupByDate(events) {
  return events.reduce((acc, event) => {
    const key = eventDateStr(event.start);
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});
}

// ─── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('calendar-v2');
  if (!container) return;

  // Load events + config from data attributes
  state.events = JSON.parse(container.dataset.events || '[]');
  state.view = container.dataset.defaultView || 'week';
  state.showSearch = container.dataset.showSearch !== 'false';
  state.showCategoryFilter = container.dataset.showCategoryFilter !== 'false';

  // Apply initial tag filter from URL or data attribute
  const urlParams = new URLSearchParams(window.location.search);
  const initialTag = urlParams.get('tag') || container.dataset.initialTag || '';
  if (initialTag) {
    state.activeCategories = initialTag.split(',').map(s => s.trim()).filter(Boolean);
  }

  render();

  // Rerender on resize (debounced)
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
  });

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.cal-filter-wrap')) closeFilterPanel();
    if (!e.target.closest('.cal-search-wrap')) collapseSearch();
  });
});
```

- [ ] **Step 2: Verify dev server still loads without errors**

```bash
npm run dev
```
Open `http://localhost:4321/calendar`. The page should load without JS errors. Calendar won't render content yet (render() is not defined).

- [ ] **Step 3: Commit**

```bash
git add public/calendar-v2.js
git commit -m "feat: add calendar-v2.js state, date utilities, and init"
```

---

## Task 5: calendar-v2.js — Event Cards & Day Columns

**Files:**
- Modify: `public/calendar-v2.js` (append functions)

- [ ] **Step 1: Append event card and day column rendering to calendar-v2.js**

Add these functions after the `groupByDate` function:

```js
// ─── Event card HTML ─────────────────────────────────────────

function eventCardHTML(event, showTag) {
  const color = getCategoryColor(event.category);
  const timeStr = event.allDay
    ? 'All day'
    : formatTime(event.start) + ' ' + formatDuration(event.start, event.end);
  const tagHTML = showTag && event.category
    ? `<span class="cal-event-tag" style="background:${color}22;color:${color}">${event.category}</span>`
    : '';
  const locHTML = event.location
    ? `<div class="cal-event-loc">${escapeHtml(event.location)}</div>`
    : '';

  return `
    <a class="cal-event${event.allDay ? ' allday' : ''}"
       href="${event.url || '#'}"
       style="${event.allDay ? '' : `border-left-color:${color}`}"
       data-event-id="${event.id}"
    >
      <div class="cal-event-time">${timeStr}</div>
      <div class="cal-event-title">${escapeHtml(event.title)}</div>
      ${locHTML}
      ${tagHTML}
    </a>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Day column HTML ─────────────────────────────────────────

function dayColumnHTML(date, eventsForDay, opts = {}) {
  const dateStr = toDateStr(date);
  const todayClass = isToday(dateStr) ? ' today' : '';
  const dayNum = date.getDate();
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Sort: all-day first, then by time
  const sorted = [...eventsForDay].sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return a.start.localeCompare(b.start);
  });

  // Tag visibility: hide if only one category active
  const showTag = state.activeCategories.length !== 1;

  const cardsHTML = sorted.length
    ? sorted.map(e => eventCardHTML(e, showTag)).join('')
    : '<div class="cal-day-empty">No events</div>';

  const headerHTML = opts.mobileInline
    ? `<div class="cal-day-header-inline">
         <div class="cal-day-num${todayClass}">${dayNum}</div>
         <div class="cal-day-meta">
           <div class="cal-day-name-full">${date.toLocaleDateString('en-US', { weekday: 'long' })}</div>
           <div class="cal-day-month">${monthName}</div>
         </div>
       </div>`
    : `<div class="cal-day-header">
         <div class="cal-day-name">${dayName}</div>
         <div class="cal-day-num${todayClass}">${dayNum}</div>
       </div>`;

  return `
    <div class="cal-day-col" data-date="${dateStr}">
      ${headerHTML}
      <div class="cal-day-events">${cardsHTML}</div>
    </div>
  `;
}
```

- [ ] **Step 2: Append tooltip attachment after render (stubs for now)**

```js
// ─── Tooltip ─────────────────────────────────────────────────
// Full implementation in Task 9. Stub here so render() can call it.
function attachTooltips() {}
function closeFilterPanel() {}
function collapseSearch() {}
```

- [ ] **Step 3: Commit**

```bash
git add public/calendar-v2.js
git commit -m "feat: add calendar event card and day column rendering"
```

---

## Task 6: calendar-v2.js — Toolbar & Subbar Rendering

**Files:**
- Modify: `public/calendar-v2.js` (append functions)

- [ ] **Step 1: Append toolbar rendering**

```js
// ─── Toolbar ─────────────────────────────────────────────────

function renderToolbar() {
  const toolbar = document.getElementById('cal-toolbar');
  if (!toolbar) return;

  const weekStart = getWeekStart(state.currentDate);
  let periodHTML;

  if (state.view === 'week') {
    const { month, rest } = formatWeekRange(weekStart);
    periodHTML = `<span class="cal-period-month">${month}</span><span style="color:white">${rest}</span>`;
  } else if (state.view === 'day') {
    const d = state.currentDate;
    const month = d.toLocaleDateString('en-US', { month: 'long' });
    periodHTML = `<span class="cal-period-month">${month} </span><span style="color:white">${d.getDate()}, ${d.getFullYear()}</span>`;
  } else {
    const month = state.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    periodHTML = `<span style="color:white">${month}</span>`;
  }

  toolbar.innerHTML = `
    <div class="cal-toolbar-left">
      <button class="cal-tb-btn" id="cal-prev" aria-label="Previous">
        <span class="material-symbols-outlined">chevron_left</span>
        <span class="cal-tb-tip">Previous ${state.view}</span>
      </button>
      <button class="cal-tb-btn" id="cal-next" aria-label="Next">
        <span class="material-symbols-outlined">chevron_right</span>
        <span class="cal-tb-tip">Next ${state.view}</span>
      </button>
      <div class="cal-tb-btn" style="position:relative;cursor:pointer" id="cal-datepicker-wrap">
        <span class="material-symbols-outlined">calendar_month</span>
        <input type="date" id="cal-datepicker"
          style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%"
          aria-label="Jump to date"
        >
        <span class="cal-tb-tip">Jump to date</span>
      </div>
      <button class="cal-today-btn" id="cal-today">Today</button>
    </div>

    <div class="cal-toolbar-spacer"></div>
    <div class="cal-period">${periodHTML}</div>
    <div class="cal-toolbar-spacer"></div>

    <div class="cal-view-group">
      <button class="cal-view-btn${state.view === 'month' ? ' active' : ''}" data-view="month" aria-label="Month view">
        <span class="material-symbols-outlined" style="font-size:18px">calendar_view_month</span>
        <span class="cal-tb-tip">Month</span>
      </button>
      <button class="cal-view-btn${state.view === 'week' ? ' active' : ''}" data-view="week" aria-label="Week view">
        <span class="material-symbols-outlined" style="font-size:18px">calendar_view_week</span>
        <span class="cal-tb-tip">Week</span>
      </button>
      <button class="cal-view-btn${state.view === 'day' ? ' active' : ''}" data-view="day" aria-label="Day view">
        <span class="material-symbols-outlined" style="font-size:18px">calendar_view_day</span>
        <span class="cal-tb-tip">Day</span>
      </button>
    </div>
  `;

  attachToolbarListeners();
}

function renderSubbar() {
  const subbar = document.getElementById('cal-subbar');
  if (!subbar) return;

  const activeCount = state.activeCategories.length;
  const categories = getUniqueCategories();

  const searchHTML = state.showSearch ? `
    <div class="cal-search-wrap" id="cal-search-wrap">
      <button class="cal-search-collapsed" id="cal-search-collapsed">
        <span class="material-symbols-outlined" style="font-size:18px">search</span>
        Search…
      </button>
      <div class="cal-search-expanded" id="cal-search-expanded">
        <span class="material-symbols-outlined" style="font-size:18px;color:#9ca3af">search</span>
        <input type="text" id="cal-search-input" placeholder="Search events…" autocomplete="off">
        <span class="material-symbols-outlined cal-search-clear" id="cal-search-clear">close</span>
      </div>
      <div class="cal-autocomplete" id="cal-autocomplete"></div>
    </div>
  ` : '';

  const filterHTML = state.showCategoryFilter ? `
    <div class="cal-filter-wrap" id="cal-filter-wrap">
      <button class="cal-filter-btn${activeCount > 0 ? ' active' : ''}" id="cal-filter-btn">
        <span class="material-symbols-outlined" style="font-size:18px">tune</span>
        Categories
        ${activeCount > 0 ? `<span class="cal-filter-count">${activeCount}</span>` : ''}
        <span class="material-symbols-outlined" style="font-size:16px;color:rgba(55,65,81,0.5)">expand_more</span>
      </button>
      <div class="cal-filter-panel" id="cal-filter-panel">
        <div class="cal-filter-header">
          <span class="cal-filter-label">Filter by category</span>
          <button class="cal-filter-clear" id="cal-filter-clear">Clear all</button>
        </div>
        ${categories.map(cat => `
          <div class="cal-filter-item${state.activeCategories.includes(cat) ? ' checked' : ''}" data-category="${escapeHtml(cat)}">
            <div class="cal-filter-dot" style="background:${getCategoryColor(cat)}"></div>
            <span class="cal-filter-name">${escapeHtml(cat)}</span>
            <div class="cal-filter-cb"></div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  subbar.innerHTML = searchHTML + filterHTML;
  attachSubbarListeners();
}

function getUniqueCategories() {
  const seen = new Set();
  const order = ['Arts & Culture', 'Civic', 'Family', 'Nature', 'Recreation & Outdoors', 'School', 'Sports', 'Town'];
  const fromEvents = state.events
    .map(e => e.category)
    .filter(c => c && !seen.has(c) && seen.add(c));
  // Return in preferred order, then any extras
  return [
    ...order.filter(o => fromEvents.some(c => c.toLowerCase() === o.toLowerCase())),
    ...fromEvents.filter(c => !order.some(o => o.toLowerCase() === c.toLowerCase())),
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add public/calendar-v2.js
git commit -m "feat: add calendar toolbar and subbar rendering"
```

---

## Task 7: calendar-v2.js — Navigation & Event Listeners

**Files:**
- Modify: `public/calendar-v2.js` (append functions)

- [ ] **Step 1: Append navigation handlers and render function**

```js
// ─── Navigation ──────────────────────────────────────────────

function navigate(direction) {
  // direction: +1 or -1
  const d = new Date(state.currentDate);
  if (state.view === 'week') {
    d.setDate(d.getDate() + direction * 7);
  } else if (state.view === 'day') {
    d.setDate(d.getDate() + direction);
  } else if (state.view === 'month') {
    d.setMonth(d.getMonth() + direction);
  }
  state.currentDate = d;
  render();
}

function goToToday() {
  state.currentDate = new Date();
  render();
}

function goToDate(dateStr) {
  // dateStr: 'YYYY-MM-DD'
  const [y, m, d] = dateStr.split('-').map(Number);
  state.currentDate = new Date(y, m - 1, d);
  render();
}

function setView(view) {
  state.view = view;
  render();
}

// ─── Listener attachment ─────────────────────────────────────

function attachToolbarListeners() {
  document.getElementById('cal-prev')?.addEventListener('click', () => navigate(-1));
  document.getElementById('cal-next')?.addEventListener('click', () => navigate(+1));
  document.getElementById('cal-today')?.addEventListener('click', goToToday);

  document.getElementById('cal-datepicker')?.addEventListener('change', (e) => {
    if (e.target.value) goToDate(e.target.value);
  });

  document.querySelectorAll('.cal-view-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
}

function attachSubbarListeners() {
  // Search expand/collapse
  document.getElementById('cal-search-collapsed')?.addEventListener('click', (e) => {
    e.stopPropagation();
    expandSearch();
  });
  document.getElementById('cal-search-clear')?.addEventListener('click', (e) => {
    e.stopPropagation();
    collapseSearch();
  });
  document.getElementById('cal-search-input')?.addEventListener('input', (e) => {
    handleSearchInput(e.target.value);
  });
  document.getElementById('cal-search-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') collapseSearch();
    if (e.key === 'Enter') handleSearchEnter(e.target.value);
  });

  // Category filter
  document.getElementById('cal-filter-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFilterPanel();
  });
  document.getElementById('cal-filter-clear')?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearCategories();
  });
  document.querySelectorAll('.cal-filter-item[data-category]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCategory(item.dataset.category);
    });
  });
}

// ─── Main render ─────────────────────────────────────────────

function render() {
  renderToolbar();
  renderSubbar();
  renderGrid();
  attachTooltips();
}
```

- [ ] **Step 2: Verify navigation works**

```bash
npm run dev
```
Open `http://localhost:4321/calendar`. The toolbar should render with blue background and chevron buttons. Click `‹` and `›` — the period label should update. Click "Today" — should show current week. The grid is empty (renderGrid not yet defined).

- [ ] **Step 3: Commit**

```bash
git add public/calendar-v2.js
git commit -m "feat: add calendar navigation and listener attachment"
```

---

## Task 8: calendar-v2.js — Grid Rendering (Week, Day, Month)

**Files:**
- Modify: `public/calendar-v2.js` (append functions)

- [ ] **Step 1: Append grid rendering functions**

```js
// ─── Grid rendering ──────────────────────────────────────────

function renderGrid() {
  const grid = document.getElementById('cal-grid');
  if (!grid) return;

  if (state.view === 'week') renderWeekGrid(grid);
  else if (state.view === 'day') renderDayGrid(grid);
  else if (state.view === 'month') renderMonthGrid(grid);
}

function renderWeekGrid(container) {
  const cols = getColumnCount();
  const weekStart = getWeekStart(state.currentDate);
  const allDates = getWeekDates(weekStart); // always 7 dates Mon-Sun
  const filtered = getFilteredEvents();
  const byDate = groupByDate(filtered);
  const isMobile = cols === 1;

  // On < 7 cols, show `cols` dates starting from the one containing currentDate
  let dates;
  if (cols >= 7) {
    dates = allDates;
  } else {
    // Find the index of current date in the week, center the window
    const curStr = toDateStr(state.currentDate);
    let idx = allDates.findIndex(d => toDateStr(d) === curStr);
    if (idx < 0) idx = 0;
    const start = Math.max(0, Math.min(idx, 7 - cols));
    dates = allDates.slice(start, start + cols);
  }

  container.innerHTML = `
    <div class="cal-week-grid" style="grid-template-columns:repeat(${cols},1fr)">
      ${dates.map(d => dayColumnHTML(d, byDate[toDateStr(d)] || [], { mobileInline: isMobile })).join('')}
    </div>
  `;
}

function renderDayGrid(container) {
  const filtered = getFilteredEvents();
  const byDate = groupByDate(filtered);
  const dateStr = toDateStr(state.currentDate);
  container.innerHTML = `
    <div class="cal-week-grid" style="grid-template-columns:1fr;max-width:480px">
      ${dayColumnHTML(state.currentDate, byDate[dateStr] || [], { mobileInline: true })}
    </div>
  `;
}

function renderMonthGrid(container) {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const filtered = getFilteredEvents();
  const byDate = groupByDate(filtered);

  // Start from Monday before the 1st
  const gridStart = getWeekStart(firstDay);

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const headerHTML = dayNames.map(d => `<div class="cal-month-header">${d}</div>`).join('');

  const cells = [];
  const cur = new Date(gridStart);
  while (cur <= lastDay || cells.length % 7 !== 0 || cells.length < 35) {
    const ds = toDateStr(cur);
    const evs = byDate[ds] || [];
    const isCurrentMonth = cur.getMonth() === month;
    const todayCls = isToday(ds) ? ' today' : '';
    const otherCls = !isCurrentMonth ? ' other-month' : '';

    const pills = evs.slice(0, 3).map(e => {
      const color = getCategoryColor(e.category);
      return `<span class="cal-month-pill" style="background:${color}">${escapeHtml(e.title)}</span>`;
    }).join('');
    const more = evs.length > 3 ? `<div class="cal-month-more">+${evs.length - 3} more</div>` : '';

    cells.push(`
      <div class="cal-month-cell${todayCls}${otherCls}" data-date="${ds}" role="button" tabindex="0">
        <div class="cal-month-day-num">${cur.getDate()}</div>
        ${pills}${more}
      </div>
    `);

    cur.setDate(cur.getDate() + 1);
    if (cells.length > 42) break; // max 6 rows
  }

  container.innerHTML = `
    <div class="cal-month-grid">
      ${headerHTML}
      ${cells.join('')}
    </div>
  `;

  // Clicking a day in month view switches to day view
  container.querySelectorAll('.cal-month-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => {
      goToDate(cell.dataset.date);
      setView('day');
    });
  });
}
```

- [ ] **Step 2: Verify week grid renders**

```bash
npm run dev
```
Open `http://localhost:4321/calendar`. You should see:
- Blue toolbar with period label and nav arrows
- White subbar with search/filter
- 7-column (desktop) or fewer-column (narrow browser) week grid
- Event cards with colored left borders and grey location text
- Scrollable columns on days with many events

- [ ] **Step 3: Verify adaptive columns**

Resize the browser to 500px wide. Expected: single column showing one day. Resize to 800px. Expected: 3 columns.

- [ ] **Step 4: Commit**

```bash
git add public/calendar-v2.js
git commit -m "feat: add calendar grid rendering for week, day, and month views"
```

---

## Task 9: calendar-v2.js — Tooltips

**Files:**
- Modify: `public/calendar-v2.js` (replace stub `attachTooltips` function)

- [ ] **Step 1: Replace the stub tooltip functions with full implementation**

Find the `function attachTooltips() {}` stub and replace it with:

```js
// ─── Tooltips ────────────────────────────────────────────────

let _tooltip = null;
let _tooltipTimeout = null;

function getTooltipEl() {
  if (!_tooltip) {
    _tooltip = document.createElement('div');
    _tooltip.className = 'cal-tooltip';
    _tooltip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(_tooltip);
  }
  return _tooltip;
}

function showTooltip(event, anchorEl) {
  // Don't show on touch devices
  if (window.matchMedia('(hover: none)').matches) return;

  clearTimeout(_tooltipTimeout);
  _tooltipTimeout = setTimeout(() => {
    const el = getTooltipEl();
    el.innerHTML = buildTooltipHTML(event);
    el.style.display = 'block';
    positionTooltip(el, anchorEl);
  }, 300);
}

function hideTooltip() {
  clearTimeout(_tooltipTimeout);
  if (_tooltip) _tooltip.style.display = 'none';
}

function buildTooltipHTML(event) {
  const color = getCategoryColor(event.category);
  const timeStr = event.allDay
    ? 'All day'
    : formatTime(event.start) + (event.end ? ` – ${formatTime(event.end)}` : '');
  const dateLabel = new Date(event.start + (event.start.length === 10 ? 'T00:00:00' : ''))
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const desc = event.description
    ? escapeHtml(event.description.substring(0, 120)) + (event.description.length > 120 ? '…' : '')
    : '';
  const locRow = event.location
    ? `<div class="cal-tooltip-row">${escapeHtml(event.location)}</div>`
    : '';
  const descRow = desc ? `<div class="cal-tooltip-desc">${desc}</div>` : '';
  const tagRow = event.category
    ? `<span class="cal-tooltip-tag" style="background:${color}22;color:${color}">${escapeHtml(event.category)}</span>`
    : '';

  return `
    <div class="cal-tooltip-title">${escapeHtml(event.title)}</div>
    <div class="cal-tooltip-row">${dateLabel} · ${timeStr}</div>
    ${locRow}
    ${descRow}
    ${tagRow}
  `;
}

function positionTooltip(el, anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const TW = 240;

  el.style.width = TW + 'px';
  el.style.position = 'fixed';

  // Horizontal: prefer right, fallback left
  if (rect.right + TW + 10 <= vw) {
    el.style.left = (rect.right + 8) + 'px';
    el.style.right = 'auto';
  } else {
    el.style.left = Math.max(8, rect.left - TW - 8) + 'px';
    el.style.right = 'auto';
  }

  // Vertical: align with top of card, clamp to viewport
  const th = el.offsetHeight || 160;
  let top = rect.top;
  if (top + th > vh - 8) top = vh - th - 8;
  el.style.top = Math.max(8, top) + 'px';
}

function attachTooltips() {
  document.querySelectorAll('.cal-event').forEach(card => {
    const eventId = card.dataset.eventId;
    const event = state.events.find(e => e.id === eventId);
    if (!event) return;

    card.addEventListener('mouseenter', () => showTooltip(event, card));
    card.addEventListener('mouseleave', hideTooltip);
    card.addEventListener('focus', () => showTooltip(event, card));
    card.addEventListener('blur', hideTooltip);
  });
}
```

- [ ] **Step 2: Verify tooltips**

```bash
npm run dev
```
Open `http://localhost:4321/calendar`. Hover over an event card. After ~300ms, a tooltip should appear. Verify:
- Tooltip for a left-column event opens to the right
- Tooltip for a right-column event opens to the left
- Tooltip never clips the viewport edge

- [ ] **Step 3: Commit**

```bash
git add public/calendar-v2.js
git commit -m "feat: add smart-positioned event tooltips"
```

---

## Task 10: calendar-v2.js — Category Filter

**Files:**
- Modify: `public/calendar-v2.js` (replace stub filter functions)

- [ ] **Step 1: Replace stub filter functions**

Find the `function closeFilterPanel() {}` stub and replace it with:

```js
// ─── Category filter ─────────────────────────────────────────

function toggleFilterPanel() {
  const panel = document.getElementById('cal-filter-panel');
  if (!panel) return;
  panel.classList.toggle('visible');
}

function closeFilterPanel() {
  document.getElementById('cal-filter-panel')?.classList.remove('visible');
}

function toggleCategory(category) {
  const idx = state.activeCategories.indexOf(category);
  if (idx === -1) {
    state.activeCategories.push(category);
  } else {
    state.activeCategories.splice(idx, 1);
  }
  updateURL();
  // Re-render subbar and grid only (preserve toolbar period)
  renderSubbar();
  renderGrid();
  attachTooltips();
  // Re-open panel (renderSubbar closes it)
  document.getElementById('cal-filter-panel')?.classList.add('visible');
}

function clearCategories() {
  state.activeCategories = [];
  updateURL();
  renderSubbar();
  renderGrid();
  attachTooltips();
}

function updateURL() {
  const params = new URLSearchParams(window.location.search);
  if (state.activeCategories.length > 0) {
    params.set('tag', state.activeCategories.join(','));
  } else {
    params.delete('tag');
  }
  const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
  window.history.replaceState({}, '', newUrl);
}
```

- [ ] **Step 2: Verify category filter**

Open `http://localhost:4321/calendar`. Click "Categories". Expected:
- Dropdown panel opens showing all categories with color dots
- Click "Family" — only Family events remain, badge shows "1", URL updates to `?tag=Family`
- Click "Family" again — unchecked, all events return, badge gone, URL cleaned
- Click "Clear all" — all filters removed

- [ ] **Step 3: Commit**

```bash
git add public/calendar-v2.js
git commit -m "feat: add category filter with URL state"
```

---

## Task 11: Search API Endpoint

**Files:**
- Create: `src/pages/api/calendar/search.ts`

- [ ] **Step 1: Check how db is imported in other API routes**

```bash
head -10 src/pages/api/calendar/events.ts
```
Note the exact import path for `db` and the event shape returned.

- [ ] **Step 2: Create search.ts**

```typescript
import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';

export const GET: APIRoute = async ({ url }) => {
  try {
    const query = url.searchParams.get('q')?.toLowerCase().trim() ?? '';

    if (query.length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const events = await db.events.getAll();

    const results = events
      .filter(e =>
        e.title?.toLowerCase().includes(query) ||
        e.location?.name?.toLowerCase().includes(query)
      )
      .slice(0, 8)
      .map(e => ({
        id: e.id,
        title: e.title ?? '',
        start_date: e.start_date ?? '',
        start_time: e.start_time ?? null,
        primaryTag: e.primary_tag?.name ?? '',
        url: `/events/${e.id}`,
      }));

    return new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ results: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

Note: category color lookup is done client-side in `calendar-v2.js`; the API only returns the `primaryTag` name string.

- [ ] **Step 3: Test the endpoint**

With dev server running:
```bash
curl "http://localhost:4321/api/calendar/search?q=farm"
```
Expected: JSON with `{ results: [...] }` containing events matching "farm".

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/calendar/search.ts
git commit -m "feat: add calendar search autocomplete API endpoint"
```

---

## Task 12: calendar-v2.js — Search Frontend

**Files:**
- Modify: `public/calendar-v2.js` (replace stub search functions)

- [ ] **Step 1: Replace stub search functions**

Find `function collapseSearch() {}` and replace with:

```js
// ─── Search ──────────────────────────────────────────────────

let _searchDebounce = null;

function expandSearch() {
  document.getElementById('cal-search-collapsed')?.style.setProperty('display', 'none');
  const expanded = document.getElementById('cal-search-expanded');
  expanded?.classList.add('visible');
  document.getElementById('cal-search-input')?.focus();
}

function collapseSearch() {
  document.getElementById('cal-search-collapsed')?.style.removeProperty('display');
  document.getElementById('cal-search-expanded')?.classList.remove('visible');
  const input = document.getElementById('cal-search-input');
  if (input) input.value = '';
  hideAutocomplete();
}

function hideAutocomplete() {
  document.getElementById('cal-autocomplete')?.classList.remove('visible');
}

function handleSearchInput(query) {
  clearTimeout(_searchDebounce);
  if (query.trim().length < 2) {
    hideAutocomplete();
    return;
  }
  _searchDebounce = setTimeout(() => fetchAutocomplete(query.trim()), 200);
}

function handleSearchEnter(query) {
  if (!query.trim()) return;
  // Jump to first result's week
  fetchAutocomplete(query.trim(), true);
}

async function fetchAutocomplete(query, jumpToFirst = false) {
  try {
    const res = await fetch(`/api/calendar/search?q=${encodeURIComponent(query)}`);
    const { results } = await res.json();

    if (jumpToFirst && results.length > 0) {
      goToDate(results[0].start_date);
      collapseSearch();
      return;
    }

    renderAutocomplete(results, query);
  } catch {
    hideAutocomplete();
  }
}

function renderAutocomplete(results, query) {
  const container = document.getElementById('cal-autocomplete');
  if (!container) return;

  if (results.length === 0) {
    container.classList.remove('visible');
    return;
  }

  const re = new RegExp(`(${escapeRegex(query)})`, 'gi');

  container.innerHTML = results.map(r => {
    const color = getCategoryColor(r.primaryTag);
    const highlightedTitle = escapeHtml(r.title).replace(re, '<mark>$1</mark>');
    const dateLabel = r.start_date
      ? new Date(r.start_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : '';
    const meta = [dateLabel, r.start_time ? formatTime(r.start_time.length <= 8 ? `2000-01-01T${r.start_time}` : r.start_time) : null, r.primaryTag]
      .filter(Boolean).join(' · ');

    return `
      <div class="cal-ac-item" data-date="${r.start_date}" data-url="${r.url}">
        <div class="cal-ac-bar" style="background:${color}"></div>
        <div>
          <div class="cal-ac-title">${highlightedTitle}</div>
          <div class="cal-ac-meta">${escapeHtml(meta)}</div>
        </div>
      </div>
    `;
  }).join('');

  container.classList.add('visible');

  // Clicking a result navigates to the event
  container.querySelectorAll('.cal-ac-item').forEach(item => {
    item.addEventListener('click', () => {
      window.location.href = item.dataset.url;
    });
  });
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

- [ ] **Step 2: Verify search**

Open `http://localhost:4321/calendar`. Click the search area to expand. Type "farm". Expected:
- Autocomplete dropdown shows Farmers Market entries with yellow left bar
- Matched "farm" text is bold blue
- Clicking a result navigates to `/events/{id}`
- Pressing Escape collapses search
- Clicking outside collapses search

- [ ] **Step 3: Commit**

```bash
git add public/calendar-v2.js
git commit -m "feat: add search autocomplete with live results"
```

---

## Task 13: calendar-v2.js — Mobile Behavior

**Files:**
- Modify: `public/calendar-v2.js` (append swipe support and mobile toolbar)
- Modify: `src/styles/components.css` (already has mobile CSS from Task 1)

- [ ] **Step 1: Append swipe navigation to calendar-v2.js**

Find the end of the `DOMContentLoaded` listener in Task 4 — it ends with the "Close dropdowns on outside click" block followed by `});`. Insert the swipe code **before** that final `});`:

```js
  // ─── Touch / swipe navigation ────────────────────────────
  let touchStartX = 0;
  let touchStartY = 0;

  const gridEl = document.getElementById('cal-grid');
  if (gridEl) {
    gridEl.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    gridEl.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      // Only trigger on horizontal swipe (dx > 50px, dy < 30px)
      if (Math.abs(dx) > 50 && Math.abs(dy) < 30) {
        navigate(dx < 0 ? +1 : -1);
      }
    }, { passive: true });
  }
```

- [ ] **Step 2: Verify mobile toolbar**

Open `http://localhost:4321/calendar` and set browser to 375px wide (iPhone SE). Expected:
- Toolbar shows arrows + period label + view toggle
- "Today" pill is hidden (CSS `display:none` from Task 1)
- `calendar_month` icon still visible; clicking opens native date picker
- Single column shows current day
- Swiping left shows next week, swiping right shows previous week
- Subbar compresses; tapping search magnifier expands to full-width input

- [ ] **Step 3: Commit**

```bash
git add public/calendar-v2.js
git commit -m "feat: add touch swipe navigation for mobile"
```

---

## Task 14: Remove FullCalendar

**Files:**
- Delete: `public/fullcalendar-init.js`
- Delete: `src/components/Calendar.astro`
- Verify: no remaining references

- [ ] **Step 1: Check for remaining references to Calendar.astro or fullcalendar**

```bash
grep -rn "Calendar\.astro\|fullcalendar\|FullCalendar\|@fullcalendar" src/ public/ --include="*.astro" --include="*.ts" --include="*.js" --include="*.mjs"
```
Expected: no results (only `CalendarV2.astro` should appear).

- [ ] **Step 2: Delete old files**

```bash
rm public/fullcalendar-init.js
rm src/components/Calendar.astro
```

- [ ] **Step 3: Remove FullCalendar npm packages**

```bash
npm uninstall @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/list @fullcalendar/interaction
```

- [ ] **Step 4: Remove FullCalendar CDN script tags from CalendarV2.astro**

Confirm `src/components/CalendarV2.astro` has no FullCalendar CDN script tags. (It shouldn't — it was written from scratch — but double-check.)

- [ ] **Step 5: Build to confirm no broken imports**

```bash
npm run build
```
Expected: build completes with no errors related to FullCalendar or Calendar.astro.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: remove FullCalendar and old Calendar component"
```

---

## Task 15: End-to-End Verification

- [ ] **Step 1: Full visual check**

```bash
npm run dev
```
Navigate to `http://localhost:4321/calendar`. Verify each item:

| Check | Expected |
|-------|----------|
| Toolbar color | Palatinate Blue (`#4740cb`) full width |
| Period label | "May 19–25, 2025" with month in lighter white |
| Today circle | Filled blue circle on today's date number |
| `‹` / `›` arrows | Advance week correctly |
| `calendar_month` icon | Opens native date picker; picking date jumps calendar |
| "Today" pill | Jumps to current week |
| View toggle icons | Month/Week/Day icons; active state highlighted |
| Event cards | Square left edge with category color bar, grey location, no emoji |
| Dense day scroll | Column fades at bottom; hover removes fade; scroll reveals all |
| Concurrent events | Stack vertically in time order within the column |
| Tooltips | Appear after 300ms hover; position away from viewport edges |
| Category filter | Opens checklist; filtering updates grid + URL |
| Search | Expands on click; autocomplete with colored bars + highlighted text |
| Adaptive columns | 7 → 5 → 3 → 2 → 1 as browser narrows |
| Mobile swipe | Swipe left/right changes week |

- [ ] **Step 2: Confirm existing event detail pages unaffected**

Click an event card. Expected: navigates to `/events/{id}` and displays correctly.

- [ ] **Step 3: Confirm URL filtering still works**

Navigate to `http://localhost:4321/calendar?tag=Family`. Expected: only Family events shown, filter badge shows "1".

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: calendar v2 — adaptive week columns, custom toolbar, search, tooltips"
```
