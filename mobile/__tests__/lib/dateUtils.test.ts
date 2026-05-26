import {
  formatTime,
  formatTimeRange,
  formatDayHeader,
  groupEventsByDate,
  filterUpcoming,
  getTodayDateString,
  getDateString,
} from '../../lib/dateUtils';
import type { MobileEvent } from '../../lib/types';

// Minimal MobileEvent for testing
function makeEvent(id: string, start_date: string, start_time: string | null = null): MobileEvent {
  return {
    id,
    title: `Event ${id}`,
    start_date,
    end_date: null,
    start_time,
    end_time: null,
    description: null,
    website: null,
    registration: null,
    cost: null,
    featured: null,
    external_image_url: null,
    parent_event_id: null,
    location_id: null,
    organization_id: null,
    primary_tag: null,
    secondary_tag: null,
    location: null,
    organization: null,
  };
}

describe('formatTime', () => {
  it('returns HH:MM from HH:MM:SS', () => {
    expect(formatTime('10:30:00')).toBe('10:30');
  });

  it('returns empty string for null', () => {
    expect(formatTime(null)).toBe('');
  });

  it('preserves leading zero', () => {
    expect(formatTime('09:00:00')).toBe('09:00');
  });
});

describe('formatTimeRange', () => {
  it('returns start – end when both present', () => {
    expect(formatTimeRange('10:00:00', '12:00:00')).toBe('10:00 – 12:00');
  });

  it('returns just start when no end time', () => {
    expect(formatTimeRange('10:00:00', null)).toBe('10:00');
  });

  it('returns empty string when no start time', () => {
    expect(formatTimeRange(null, null)).toBe('');
  });
});

describe('formatDayHeader', () => {
  it('returns dayOfWeek, dayNum, month for a known date', () => {
    // 2026-05-26 is a Tuesday
    const result = formatDayHeader('2026-05-26');
    expect(result.dayNum).toBe('26');
    expect(result.month).toMatch(/may/i);
    expect(result.dayOfWeek).toMatch(/tuesday/i);
  });
});

describe('groupEventsByDate', () => {
  it('groups events by start_date', () => {
    const events = [
      makeEvent('1', '2026-05-26'),
      makeEvent('2', '2026-05-26'),
      makeEvent('3', '2026-05-27'),
    ];
    const groups = groupEventsByDate(events);
    expect(groups).toHaveLength(2);
    expect(groups[0].date).toBe('2026-05-26');
    expect(groups[0].events).toHaveLength(2);
    expect(groups[1].date).toBe('2026-05-27');
    expect(groups[1].events).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    expect(groupEventsByDate([])).toEqual([]);
  });

  it('preserves event order within a group', () => {
    const events = [
      makeEvent('1', '2026-05-26', '08:00:00'),
      makeEvent('2', '2026-05-26', '14:00:00'),
    ];
    const groups = groupEventsByDate(events);
    expect(groups[0].events[0].id).toBe('1');
    expect(groups[0].events[1].id).toBe('2');
  });
});

describe('filterUpcoming', () => {
  it('keeps events on or after the provided today string', () => {
    const events = [
      makeEvent('past',    '2020-01-01'),
      makeEvent('today',   '2026-05-26'),
      makeEvent('future',  '2026-12-31'),
    ];
    const result = filterUpcoming(events, '2026-05-26');
    const ids = result.map((e) => e.id);
    expect(ids).not.toContain('past');
    expect(ids).toContain('today');
    expect(ids).toContain('future');
  });

  it('includes multi-day events whose end_date is today or later', () => {
    const event = { ...makeEvent('multi', '2026-05-20'), end_date: '2026-05-26' };
    const result = filterUpcoming([event], '2026-05-26');
    expect(result).toHaveLength(1);
  });
});

describe('getDateString', () => {
  it('formats a Date as YYYY-MM-DD', () => {
    const date = new Date(2026, 4, 26); // month is 0-indexed
    expect(getDateString(date)).toBe('2026-05-26');
  });
});
