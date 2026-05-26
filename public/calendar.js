// public/calendar.js
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

// ─── US Federal Holidays ────────────────────────────────────
const US_HOLIDAYS = {
  '2025-01-01': "New Year's Day",  '2025-01-20': 'MLK Day',
  '2025-02-17': "Presidents' Day", '2025-05-26': 'Memorial Day',
  '2025-06-19': 'Juneteenth',      '2025-07-04': 'July 4th',
  '2025-09-01': 'Labor Day',       '2025-10-13': 'Columbus Day',
  '2025-11-11': 'Veterans Day',    '2025-11-27': 'Thanksgiving',
  '2025-12-25': 'Christmas',
  '2026-01-01': "New Year's Day",  '2026-01-19': 'MLK Day',
  '2026-02-16': "Presidents' Day", '2026-05-25': 'Memorial Day',
  '2026-06-19': 'Juneteenth',      '2026-07-04': 'July 4th',
  '2026-09-07': 'Labor Day',       '2026-10-12': 'Columbus Day',
  '2026-11-11': 'Veterans Day',    '2026-11-26': 'Thanksgiving',
  '2026-12-25': 'Christmas',
  '2027-01-01': "New Year's Day",  '2027-01-18': 'MLK Day',
  '2027-02-15': "Presidents' Day", '2027-05-31': 'Memorial Day',
  '2027-06-19': 'Juneteenth',      '2027-07-04': 'July 4th',
  '2027-09-06': 'Labor Day',       '2027-10-11': 'Columbus Day',
  '2027-11-11': 'Veterans Day',    '2027-11-25': 'Thanksgiving',
  '2027-12-25': 'Christmas',
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

/** Returns true if hex color is light enough to need dark text. */
function isLightColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

// ─── Date utilities ─────────────────────────────────────────

/** Returns the Sunday of the week containing `date`. */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...6=Sat
  d.setDate(d.getDate() - day); // back to Sunday
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns array of 7 Date objects starting from Sunday. */
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
  const light = isLightColor(color);
  const textColor  = light ? '#111827' : '#ffffff';
  const timeColor  = light ? 'rgba(0,0,0,0.58)' : 'rgba(255,255,255,0.82)';
  const locColor   = light ? 'rgba(0,0,0,0.48)' : 'rgba(255,255,255,0.65)';
  const tagBg      = light ? 'rgba(0,0,0,0.12)'  : 'rgba(255,255,255,0.22)';

  const timeStr = event.allDay
    ? 'All day'
    : formatTime(event.start) + ' ' + formatDuration(event.start, event.end);
  const tagHTML = showTag && event.category
    ? `<span class="cal-event-tag" style="background:${tagBg};color:${textColor}">${event.category}</span>`
    : '';
  const locHTML = event.location
    ? `<div class="cal-event-loc" style="color:${locColor}">${escapeHtml(event.location)}</div>`
    : '';

  return `
    <a class="cal-event${event.allDay ? ' allday' : ''}"
       href="${event.url?.startsWith('/') ? event.url : '#'}"
       style="background:${color}"
       data-event-id="${event.id}"
    >
      <div class="cal-event-time" style="color:${timeColor}">${timeStr}</div>
      <div class="cal-event-title" style="color:${textColor}">${escapeHtml(event.title)}</div>
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

  // Weekend / holiday column styling
  const dow = date.getDay(); // 0=Sun, 6=Sat
  const isWeekend = dow === 0 || dow === 6;
  const holidayName = US_HOLIDAYS[dateStr] || null;
  const colClass = holidayName ? ' holiday' : (isWeekend ? ' weekend' : '');

  const holidayLabelHTML = holidayName
    ? `<div class="cal-holiday-label">${escapeHtml(holidayName)}</div>`
    : '';

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
       </div>
       ${holidayLabelHTML}`
    : `<div class="cal-day-header">
         <div class="cal-day-name">${dayName}</div>
         <div class="cal-day-num${todayClass}">${dayNum}</div>
         ${holidayLabelHTML}
       </div>`;

  return `
    <div class="cal-day-col${colClass}" data-date="${dateStr}">
      ${headerHTML}
      <div class="cal-day-events">${cardsHTML}</div>
    </div>
  `;
}

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
    const event = state.events.find(e => String(e.id) === eventId);
    if (!event) return;

    card.addEventListener('mouseenter', () => showTooltip(event, card));
    card.addEventListener('mouseleave', hideTooltip);
    card.addEventListener('focus', () => showTooltip(event, card));
    card.addEventListener('blur', hideTooltip);
  });
}
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
      <div class="cal-ac-item" data-date="${r.start_date}" data-url="${escapeHtml(r.url)}">
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
      if (item.dataset.url?.startsWith('/')) {
        window.location.href = item.dataset.url;
      }
    });
  });
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('calendar');
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
});

// ─── Toolbar ─────────────────────────────────────────────────

function renderToolbar() {
  const toolbar = document.getElementById('cal-toolbar');
  if (!toolbar) return;

  const weekStart = getWeekStart(state.currentDate);
  let periodHTML;

  if (state.view === 'week') {
    const cols = getColumnCount();
    if (cols >= 7) {
      // Full week — show Mon–Sun range
      const { month, rest } = formatWeekRange(weekStart);
      periodHTML = `<span class="cal-period-month">${month}</span><span style="color:rgba(255,255,255,0.75)">${rest}</span>`;
    } else {
      // Partial week — show the actual visible date range
      const allDates = getWeekDates(weekStart);
      const curStr = toDateStr(state.currentDate);
      let idx = allDates.findIndex(d => toDateStr(d) === curStr);
      if (idx < 0) idx = 0;
      const start = Math.max(0, Math.min(idx, 7 - cols));
      const visStart = allDates[start];
      const visEnd = allDates[Math.min(start + cols - 1, 6)];
      const startMonth = visStart.toLocaleDateString('en-US', { month: 'long' });
      const endMonth = visEnd.toLocaleDateString('en-US', { month: 'long' });
      const year = visEnd.getFullYear();
      if (startMonth === endMonth) {
        periodHTML = `<span class="cal-period-month">${startMonth}</span><span style="color:rgba(255,255,255,0.75)"> ${visStart.getDate()} – ${visEnd.getDate()}, ${year}</span>`;
      } else {
        periodHTML = `<span class="cal-period-month">${startMonth} ${visStart.getDate()}</span><span style="color:rgba(255,255,255,0.75)"> – ${endMonth} ${visEnd.getDate()}, ${year}</span>`;
      }
    }
  } else if (state.view === 'day') {
    const d = state.currentDate;
    const month = d.toLocaleDateString('en-US', { month: 'long' });
    periodHTML = `<span class="cal-period-month">${month} </span><span style="color:rgba(255,255,255,0.75)">${d.getDate()}, ${d.getFullYear()}</span>`;
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
    const cols = getColumnCount();
    if (cols >= 7) {
      // Full week visible — jump a full week
      d.setDate(d.getDate() + direction * 7);
    } else {
      // Partial week — slide by the number of visible columns,
      // but clamp so we never skip past the week boundary.
      const weekStart = getWeekStart(state.currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const curIdx = Math.round((state.currentDate - weekStart) / 86400000);
      const newIdx = curIdx + direction * cols;

      if (newIdx < 0) {
        // Move to previous week, position at the equivalent column from the end
        const prevWeekStart = new Date(weekStart);
        prevWeekStart.setDate(prevWeekStart.getDate() - 7);
        d.setTime(prevWeekStart.getTime());
        d.setDate(d.getDate() + Math.max(0, 7 - cols));
      } else if (newIdx > 6) {
        // Move to next week, land on Monday
        d.setTime(weekEnd.getTime());
        d.setDate(d.getDate() + 1);
      } else {
        // Use weekStart as base to avoid cross-month day-number confusion
        const target = new Date(weekStart);
        target.setDate(target.getDate() + newIdx);
        d.setTime(target.getTime());
      }
    }
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

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
