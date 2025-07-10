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
    const calendar = new window.FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridWeek',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,dayGridWeek,timeGridDay'
      },
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
        // Tooltip logic (unchanged)
        let html = `<div class='fc-tooltip-title'>${event.title}</div>`;
        if (event.extendedProps.description) {
          html += `<div class='fc-tooltip-desc'>${event.extendedProps.description}</div>`;
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
          html += `<div class='fc-tooltip-time'><span>Time:</span> ${timeString}</div>`;
        }
        if (event.extendedProps.location) {
          html += `<div class='fc-tooltip-location'><span>Location:</span> ${event.extendedProps.location}</div>`;
        }
        const tooltip = new Tooltip(info.el, { html });
      }
    });
    calendar.render();
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