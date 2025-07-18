document.addEventListener('DOMContentLoaded', function() {
  const calendarEl = document.getElementById('calendar');
  // Read events from the data-events attribute
  let events = [];
  if (calendarEl && calendarEl.dataset.events) {
    try {
      events = JSON.parse(calendarEl.dataset.events);
    } catch (e) {
      console.error('Failed to parse events JSON', e);
    }
  }

  // Helper: convert category name to kebab-case for CSS class
  function toKebabCase(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  if (calendarEl && window.FullCalendar) {
    // Detect mobile
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    // Mobile-specific header and views
    const mobileHeaderToolbar = {
      start: 'title',
      center: 'dayGridWeek,timeGridDay,today',
      end: ''
    };
    const desktopHeaderToolbar = {
      left: 'prev,next,today',
      center: 'title',
      right: 'dayGridMonth,dayGridWeek,timeGridDay'
    };
    const headerToolbar = isMobile ? mobileHeaderToolbar : desktopHeaderToolbar;
    const initialView = isMobile ? 'dayGridWeek' : 'dayGridWeek';
    const calendar = new window.FullCalendar.Calendar(calendarEl, {
      initialView,
      headerToolbar,
      events: events,
      eventClick: function(info) {
        if (info.event.id) {
          window.location.href = `/events/${info.event.id}`;
        }
      },
      eventContent: function(arg) {
        // Only for month view: show just the title, no time, no dot
        if (arg.view.type === 'dayGridMonth') {
          return { html: `<span class="fc-event-title">${arg.event.title}</span>` };
        }
        // Default rendering for other views
        return true;
      },
      eventDidMount: function(info) {
        const event = info.event;
        // Color events by category in week/day views
        if (info.view.type === 'dayGridWeek' || info.view.type === 'timeGridDay') {
          const category = event.extendedProps.category;
          if (category) {
            const kebab = toKebabCase(category);
            info.el.classList.add(`bg-event-${kebab}`);
            info.el.classList.add('text-white');
          }
        }
        // Remove the event dot in dayGridWeek view
        if (info.view.type === 'dayGridWeek') {
          const dot = info.el.querySelector('.fc-daygrid-event-dot');
          if (dot) dot.style.display = 'none';
        }
        // Add left margin to event text
        const contentEls = info.el.querySelectorAll('.fc-event-time, .fc-event-title');
        contentEls.forEach(el => {
          el.style.marginLeft = '2px';
        });
        // Tooltip logic (unchanged)
        let html = `<div class='fc-tooltip-title'>${event.title}</div>`;
        
        if (event.extendedProps.description) {
          html += `<div class='fc-tooltip-desc'>${event.extendedProps.description}</div>`;
        }

        // Add location if it exists (as a string)
        if (event.extendedProps.location) {
          html += `<div class='fc-tooltip-location'><span>⚲ </span> ${event.extendedProps.location}</div>`;
        }

        if (event.start && info.view.type !== 'dayGridMonth') {
          const startDate = new Date(event.start);
          let hour = startDate.getHours();
          let minute = startDate.getMinutes();
          let ampm = hour >= 12 ? 'PM' : 'AM';
          hour = hour % 12;
          hour = hour ? hour : 12;
          const minuteStr = minute < 10 ? '0' + minute : minute;
          const timeString = `${hour}:${minuteStr} ${ampm}`;
          html += `<div class='fc-tooltip-time'>${timeString}</div>`;
        }
        const tooltip = new Tooltip(info.el, { html });
      }
    });
    calendar.render();
    // Replace all button text with Material Symbols icons after calendar renders
    function replaceButtonsWithIcons() {
      // Replace navigation arrows
      const prevButton = calendarEl.querySelector('.fc-prev-button');
      const nextButton = calendarEl.querySelector('.fc-next-button');
      if (prevButton) {
        prevButton.innerHTML = '<span class="material-symbols-outlined">chevron_left</span>';
        prevButton.setAttribute('aria-label', 'Previous');
      }
      if (nextButton) {
        nextButton.innerHTML = '<span class="material-symbols-outlined">chevron_right</span>';
        nextButton.setAttribute('aria-label', 'Next');
      }

      // Replace today button
      const todayButton = calendarEl.querySelector('.fc-today-button');
      if (todayButton) {
        todayButton.innerHTML = '<span class="material-symbols-outlined">today</span>';
        todayButton.setAttribute('aria-label', 'Go to today 1');
      }

      // Replace view button text with icons
      const viewButtons = calendarEl.querySelectorAll('.fc-dayGridMonth-button, .fc-dayGridWeek-button, .fc-timeGridDay-button');
      viewButtons.forEach(btn => {
        const viewType = btn.className;
        if (viewType.includes('dayGridMonth')) {
          btn.innerHTML = '<span class="material-symbols-outlined">calendar_view_month</span>';
          btn.setAttribute('aria-label', 'Month view');
        } else if (viewType.includes('dayGridWeek')) {
          btn.innerHTML = '<span class="material-symbols-outlined">calendar_view_week</span>';
          btn.setAttribute('aria-label', 'Week view');
        } else if (viewType.includes('timeGridDay')) {
          btn.innerHTML = '<span class="material-symbols-outlined">calendar_view_day</span>';
          btn.setAttribute('aria-label', 'Day view');
        }
      });
    }

    // Replace buttons on initial render and after navigation
    calendar.on('datesSet', replaceButtonsWithIcons);
    // Also call immediately after render
    setTimeout(replaceButtonsWithIcons, 100);
    // Add custom CSS for calendar header and icons
    const style = document.createElement('style');
    style.textContent = `
      .fc-header-toolbar .fc-button .material-symbols-outlined {
        font-size: 1.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .fc-button {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-width: 2.5rem !important;
        min-height: 2.5rem !important;
      }
    `;
    document.head.appendChild(style);

    // Add mobile-specific CSS
    if (isMobile) {
      const mobileStyle = document.createElement('style');
      mobileStyle.textContent = `
        .fc-header-toolbar {
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 0.5rem !important;
        }
        .fc-header-toolbar .fc-toolbar-chunk {
          width: 100%;
          display: flex;
          justify-content: flex-start;
          margin-bottom: 0.25rem;
        }
        .fc-header-toolbar .fc-toolbar-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0.5rem 0 0.25rem 0;
          width: 100%;
          text-align: left;
        }
        .fc-header-toolbar .fc-button-group {
          margin-bottom: 0.25rem;
        }
        .fc-header-toolbar .fc-button {
          min-width: 2.5rem;
          min-height: 2.5rem;
          font-size: 1rem;
          margin-right: 0.5rem;
        }
      `;
      document.head.appendChild(mobileStyle);
    }
    // On mobile add swipe navigation
    if (isMobile) {
      // Add swipe gesture support
      let touchStartX = null;
      calendarEl.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
        }
      });
      calendarEl.addEventListener('touchend', function(e) {
        if (touchStartX !== null && e.changedTouches.length === 1) {
          const touchEndX = e.changedTouches[0].clientX;
          const deltaX = touchEndX - touchStartX;
          if (Math.abs(deltaX) > 50) {
            if (deltaX < 0) {
              calendar.next();
            } else {
              calendar.prev();
            }
          }
          touchStartX = null;
        }
      });
    }
  } else {
    console.error('FullCalendar not loaded or #calendar not found');
  }
});

// Enhanced tooltip implementation
class Tooltip {
  constructor(element, options) {
    this.element = element;
    this.options = options;
    this.tooltip = null;
    this.element.addEventListener('mouseenter', this.show.bind(this));
    this.element.addEventListener('mouseleave', this.hide.bind(this));
  }
  show() {
    this.hide();
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'fc-tooltip';
    this.tooltip.innerHTML = this.options.html;
    document.body.appendChild(this.tooltip);
    // Position tooltip
    const rect = this.element.getBoundingClientRect();
    this.tooltip.style.left = rect.left + (rect.width / 2) - (this.tooltip.offsetWidth / 2) + 'px';
    this.tooltip.style.top = rect.top - this.tooltip.offsetHeight - 8 + 'px';
  }
  hide() {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }
}

// Add custom CSS for tooltip
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .fc-tooltip {
      position: absolute;
      background: rgba(30, 30, 30, 0.97);
      color: #fff;
      padding: 16px 20px;
      border-radius: 10px;
      font-size: 15px;
      max-width: 350px;
      white-space: pre-line;
      z-index: 10000;
      pointer-events: none;
      box-shadow: 0 4px 24px rgba(0,0,0,0.25);
      line-height: 1.5;
    }
    .fc-tooltip-title {
      font-size: 1.15em;
      font-weight: bold;
      margin-bottom: 8px;
    }
    .fc-tooltip-desc {
      margin-bottom: 10px;
    }
    .fc-tooltip-time, .fc-tooltip-location {
      font-size: 0.95em;
      color: #b3e5fc;
      margin-bottom: 2px;
    }
    .fc-tooltip-time span, .fc-tooltip-location span {
      color: #90caf9;
      font-weight: 500;
      margin-right: 4px;
    }
  `;
  document.head.appendChild(style);
})(); 