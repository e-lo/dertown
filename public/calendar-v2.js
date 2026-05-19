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
  if (diff < 60) return `· ${Math.round(diff)} min`;
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
    if (!event.start) return acc;
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
