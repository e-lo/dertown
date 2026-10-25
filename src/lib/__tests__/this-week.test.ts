/**
 * Homepage "This Week" list: events happening from today through the next six
 * days (Pacific dates), including multi-day events already under way, in date
 * and time order.
 */
import { getThisWeekEvents } from '../event-utils';

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(ok ? `✅ PASS: ${label}` : `❌ FAIL: ${label}`);
  if (!ok) failures++;
}

console.log('🧪 This Week events\n');

const TODAY = '2026-10-23';
const ev = (id: string, start_date: string, extra: Record<string, string | null> = {}) => ({
  id,
  start_date,
  start_time: null as string | null,
  end_date: null as string | null,
  ...extra,
});

const events = [
  ev('yesterday', '2026-10-22'),
  ev('today-evening', '2026-10-23', { start_time: '18:00:00' }),
  ev('today-morning', '2026-10-23', { start_time: '09:00:00' }),
  ev('day-six', '2026-10-29'),
  ev('day-seven', '2026-10-30'),
  ev('ongoing', '2026-10-20', { end_date: '2026-10-25' }),
  ev('ended', '2026-10-18', { end_date: '2026-10-22' }),
  ev('month-boundary', '2026-10-28'),
];

const ids = getThisWeekEvents(events, TODAY).map((e) => e.id);
check('drops events that ended before today', !ids.includes('yesterday') && !ids.includes('ended'));
check('keeps multi-day events still under way', ids.includes('ongoing'));
check('includes the sixth day after today', ids.includes('day-six'));
check('stops before the seventh day after today', !ids.includes('day-seven'));
check(
  'orders by date, then start time',
  JSON.stringify(ids) ===
    JSON.stringify(['ongoing', 'today-morning', 'today-evening', 'month-boundary', 'day-six'])
);
check('caps the list at the limit', getThisWeekEvents(events, TODAY, 2).length === 2);
check(
  'crosses a month boundary',
  getThisWeekEvents([ev('nov-2', '2026-11-02')], '2026-10-28').length === 1
);

console.log(failures === 0 ? '\n✅ All This Week tests passed' : `\n❌ ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
