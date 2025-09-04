import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';

// Import FullCalendar styles
import '@fullcalendar/core/main.css';
import '@fullcalendar/daygrid/main.css';
import '@fullcalendar/timegrid/main.css';
import '@fullcalendar/list/main.css';

export function initializeCalendar(calendarEl: HTMLElement, initialView: string = 'dayGridMonth') {
  const calendar = new Calendar(calendarEl, {
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    initialView: initialView,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    },
    height: '100%',
    events: function (fetchInfo, successCallback, failureCallback) {
      const params = new URLSearchParams(window.location.search);
      const tag = params.get('tag') || 'all';
      const organizationId = params.get('organization') || 'all';
      const locationId = params.get('location') || 'all';

      const apiUrl = new URL('/api/calendar/events', window.location.origin);
      apiUrl.searchParams.set('tag', tag);
      apiUrl.searchParams.set('organization', organizationId);
      apiUrl.searchParams.set('location', locationId);

      fetch(apiUrl.toString())
        .then((response) => response.json())
        .then((data) => successCallback(data.events))
        .catch((error) => failureCallback(error));
    },
    eventClick: function (info) {
      if (info.event.url) {
        window.open(info.event.url, '_blank');
        info.jsEvent.preventDefault();
      }
    },
    buttonText: {
      today: 'Today',
      month: 'Month',
      week: 'Week',
      day: 'Day',
    },
    dayHeaderFormat: { weekday: 'short' },
    titleFormat: { year: 'numeric', month: 'long' },
    firstDay: 0,
    editable: false,
    selectable: false,
    nowIndicator: true,
    scrollTime: '08:00:00',
    timeZone: 'America/Los_Angeles',
  });

  calendar.render();

  function updateFilters() {
    const params = new URLSearchParams(window.location.search);
    const tag = params.get('tag') || 'all';
    const organizationId = params.get('organization') || 'all';
    const locationId = params.get('location') || 'all';

    document.querySelectorAll('#tag-filters .filter-pill').forEach((pill) => {
      pill.classList.toggle('active', (pill as HTMLElement).dataset.tag === tag);
    });

    const orgFilter = document.getElementById('organization-filter') as HTMLSelectElement;
    const locFilter = document.getElementById('location-filter') as HTMLSelectElement;
    if (orgFilter) orgFilter.value = organizationId;
    if (locFilter) locFilter.value = locationId;

    calendar.refetchEvents();
  }

  function handleFilterChange(paramName: string, value: string | null | undefined) {
    const url = new URL(window.location.href);
    if (value === 'all' || !value) {
      url.searchParams.delete(paramName);
    } else {
      url.searchParams.set(paramName, value);
    }
    history.pushState({}, '', url);
    updateFilters();
  }

  document.querySelectorAll('#tag-filters .filter-pill').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      handleFilterChange('tag', (e.currentTarget as HTMLElement).dataset.tag);
    });
  });

  const orgFilter = document.getElementById('organization-filter') as HTMLSelectElement;
  if (orgFilter) {
    orgFilter.addEventListener('change', (e) => {
      handleFilterChange('organization', (e.target as HTMLSelectElement).value);
    });
  }

  const locFilter = document.getElementById('location-filter') as HTMLSelectElement;
  if (locFilter) {
    locFilter.addEventListener('change', (e) => {
      handleFilterChange('location', (e.target as HTMLSelectElement).value);
    });
  }

  window.addEventListener('popstate', updateFilters);

  updateFilters();
}
