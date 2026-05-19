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
       href="${event.url?.startsWith('/') ? event.url : '#'}"
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

// ─── Tooltip ─────────────────────────────────────────────────
// Full implementation in Task 9. Stub here so render() can call it.
function attachTooltips() {}
function closeFilterPanel() {}
function collapseSearch() {}

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
