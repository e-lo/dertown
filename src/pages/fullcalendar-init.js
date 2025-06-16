import { Calendar } from 'https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.11/+esm';
import dayGridPlugin from 'https://cdn.jsdelivr.net/npm/@fullcalendar/daygrid@6.1.11/+esm';
import timeGridPlugin from 'https://cdn.jsdelivr.net/npm/@fullcalendar/timegrid@6.1.11/+esm';
import listPlugin from 'https://cdn.jsdelivr.net/npm/@fullcalendar/list@6.1.11/+esm';
import interactionPlugin from 'https://cdn.jsdelivr.net/npm/@fullcalendar/interaction@6.1.11/+esm';

document.addEventListener('DOMContentLoaded', function () {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;
  const calendar = new Calendar(calendarEl, {
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    events: [{ title: 'Test Event', start: new Date().toISOString().slice(0, 10) }],
  });
  calendar.render();
});
