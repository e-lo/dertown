function createTooltipContent(event) {
  const startTime = event.start ? new Date(event.start).toLocaleString() : '';
  const endTime = event.end ? new Date(event.end).toLocaleString() : '';
  const location =
    event.extendedProps && event.extendedProps.location
      ? event.extendedProps.location
      : 'No location specified';
  return `
        <div class="p-2">
            <div class="font-bold">${event.title}</div>
            <div class="text-sm">${startTime}${endTime ? ' - ' + endTime : ''}</div>
            <div class="text-sm">${location}</div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', function () {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;

  // Parse filters from URL
  function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }
  function getAllQueryParams(name) {
    const url = new URL(window.location.href);
    return url.searchParams.getAll(name);
  }

  // Set dropdowns to match URL
  const organizationFilter = document.getElementById('organizationFilter');
  const locationFilter = document.getElementById('locationFilter');
  if (organizationFilter) {
    const orgVal = getQueryParam('organization');
    if (orgVal) organizationFilter.value = orgVal;
  }
  if (locationFilter) {
    const locVal = getQueryParam('location');
    if (locVal) locationFilter.value = locVal;
  }

  // When dropdowns change, update URL and reload
  function updateUrlParam(param, value) {
    const url = new URL(window.location.href);
    if (value) {
      url.searchParams.set(param, value);
    } else {
      url.searchParams.delete(param);
    }
    window.location.href = url.toString();
  }
  if (organizationFilter) {
    organizationFilter.addEventListener('change', function () {
      updateUrlParam('organization', this.value);
    });
  }
  if (locationFilter) {
    locationFilter.addEventListener('change', function () {
      updateUrlParam('location', this.value);
    });
  }

  // Calendar filter params from URL
  function getFilterParams() {
    const params = new URLSearchParams();
    const type = getQueryParam('type');
    if (type) params.append('tags[]', type);
    const org = getQueryParam('organization');
    if (org) params.append('organization', org);
    const loc = getQueryParam('location');
    if (loc) params.append('location', loc);
    return params.toString();
  }

  function updateFilterOptions(data) {
    // Update organization dropdown
    const orgSelect = document.getElementById('organizationFilter');
    const selectedOrg = orgSelect.value;
    orgSelect.innerHTML = '<option value="">All Organizations</option>';
    data.available_filters.organizations.forEach((org) => {
      const option = document.createElement('option');
      option.value = org.id;
      option.textContent = org.name;
      if (org.id.toString() === selectedOrg) {
        option.selected = true;
      }
      orgSelect.appendChild(option);
    });
    // Update location dropdown
    const locSelect = document.getElementById('locationFilter');
    const selectedLoc = locSelect.value;
    locSelect.innerHTML = '<option value="">All Locations</option>';
    data.available_filters.locations.forEach((loc) => {
      const option = document.createElement('option');
      option.value = loc.id;
      option.textContent = loc.name;
      if (loc.id.toString() === selectedLoc) {
        option.selected = true;
      }
      locSelect.appendChild(option);
    });
  }

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridWeek',
    headerToolbar: {
      left: 'prev,next',
      center: 'title',
      right: 'dayGridMonth,dayGridWeek,dayGridDay',
    },
    views: {
      timeGridDay: { buttonText: 'day' },
      timeGridWeek: { buttonText: 'week' },
      dayGridMonth: { buttonText: 'month' },
    },
    events: function (info, successCallback, failureCallback) {
      const params = new URLSearchParams({
        start: info.startStr,
        end: info.endStr,
      });
      const filterParams = getFilterParams();
      if (filterParams) {
        const additionalParams = new URLSearchParams(filterParams);
        additionalParams.forEach((value, key) => {
          params.append(key, value);
        });
      }
      fetch(`/events/api/events/?${params.toString()}`)
        .then((response) => response.json())
        .then((data) => {
          updateFilterOptions(data);
          successCallback(data.events);
        })
        .catch((error) => {
          console.error('Error fetching events:', error);
          failureCallback(error);
        });
    },
    eventTimeFormat: {
      hour: 'numeric',
      minute: '2-digit',
      meridiem: 'short',
    },
    slotMinTime: '08:00:00',
    slotMaxTime: '22:00:00',
    nowIndicator: true,
    initialDate: new Date().toISOString().split('T')[0],
    eventDisplay: 'block',
    displayEventEnd: true,
    eventDidMount: function (info) {
      // Set data-event-type attribute for CSS theming
      let eventType = null;
      const props = info.event.extendedProps;
      if (props) {
        if (typeof props.primary_tag === 'string') {
          eventType = props.primary_tag.toLowerCase();
        } else if (props.primary_tag && props.primary_tag.name) {
          eventType = props.primary_tag.name.toLowerCase();
        }
      }
      if (eventType) {
        info.el.setAttribute('data-event-type', eventType);
      }
      // Destroy any existing Tippy instance on this element
      if (info.el._tippy) {
        info.el._tippy.destroy();
      }
      tippy(info.el, {
        content: createTooltipContent(info.event),
        allowHTML: true,
        placement: 'top',
        theme: 'dertown',
        animation: 'scale',
        delay: [100, 0],
        interactive: true,
        appendTo: document.body,
        trigger: 'mouseenter focus',
        hideOnClick: true,
        onShow(instance) {
          // Hide all other tippys
          document.querySelectorAll('.tippy-box').forEach((box) => {
            if (box._tippy && box._tippy !== instance) {
              box._tippy.hide();
            }
          });
        },
      });
    },
    eventClick: function (info) {
      window.location.href = `/events/${info.event.id}/`;
    },
    dayHeaderContent: function (arg) {
      return arg.text;
    },
    dateClick: function (info) {
      calendar.changeView('timeGridDay', info.dateStr);
    },
  });

  calendar.render();

  // Clear Filters button
  const clearFiltersBtn = document.getElementById('clearFilters');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', function (e) {
      e.preventDefault();
      const url = new URL(window.location.href);
      url.search = '';
      window.location.href = url.toString();
    });
  }
});
