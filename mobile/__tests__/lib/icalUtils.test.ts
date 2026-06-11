import { Platform } from 'react-native';
import { toDate, buildEndDate } from '../../lib/icalUtils';
import type { ICSEventData } from '../../lib/icalUtils';

jest.mock('expo-calendar', () => ({
  requestCalendarPermissionsAsync: jest.fn(),
  getCalendarsAsync: jest.fn(),
  createEventAsync: jest.fn(),
  EntityTypes: { EVENT: 'event' },
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/tmp/',
  writeAsStringAsync: jest.fn(),
  EncodingType: { UTF8: 'utf8' },
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));

function makeEvent(overrides: Partial<ICSEventData>): ICSEventData {
  return {
    id: 'test-id',
    title: 'Test Event',
    start_date: '2026-06-12',
    start_time: '19:00:00',
    end_date: null,
    end_time: null,
    ...overrides,
  };
}

describe('toDate — timed events (instant is platform-independent)', () => {
  it('converts a PDT wall-clock time to the correct UTC instant', () => {
    // 7pm PDT (UTC-7) on June 12 = 2am UTC June 13
    expect(toDate('2026-06-12', '19:00:00').toISOString()).toBe('2026-06-13T02:00:00.000Z');
  });

  it('converts a PST wall-clock time to the correct UTC instant', () => {
    // 7pm PST (UTC-8) on Jan 15 = 3am UTC Jan 16
    expect(toDate('2026-01-15', '19:00:00').toISOString()).toBe('2026-01-16T03:00:00.000Z');
  });

  it('uses PDT on the day DST starts (second Sunday of March)', () => {
    // March 8 2026 is the second Sunday — noon that day is PDT (UTC-7)
    expect(toDate('2026-03-08', '12:00:00').toISOString()).toBe('2026-03-08T19:00:00.000Z');
  });

  it('uses PST the day before DST starts', () => {
    expect(toDate('2026-03-07', '12:00:00').toISOString()).toBe('2026-03-07T20:00:00.000Z');
  });

  it('uses PST on the day DST ends (first Sunday of November)', () => {
    // November 1 2026 is the first Sunday — noon that day is PST (UTC-8)
    expect(toDate('2026-11-01', '12:00:00').toISOString()).toBe('2026-11-01T20:00:00.000Z');
  });
});

describe('toDate — all-day events (platform-specific midnight)', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it('iOS: uses local (Pacific) midnight so EventKit places it on the right day', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    // Midnight PDT June 12 = 7am UTC June 12
    expect(toDate('2026-06-12', null).toISOString()).toBe('2026-06-12T07:00:00.000Z');
  });

  it('iOS: uses PST offset for winter all-day events', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    expect(toDate('2026-01-15', null).toISOString()).toBe('2026-01-15T08:00:00.000Z');
  });

  it('Android: uses UTC midnight as CalendarProvider requires', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    expect(toDate('2026-06-12', null).toISOString()).toBe('2026-06-12T00:00:00.000Z');
  });
});

describe('buildEndDate', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
  });

  it('uses end_time on the end_date when provided', () => {
    const event = makeEvent({ end_date: '2026-06-13', end_time: '21:30:00' });
    expect(buildEndDate(event).toISOString()).toBe('2026-06-14T04:30:00.000Z');
  });

  it('defaults to one hour after start when end_time is missing', () => {
    const event = makeEvent({});
    expect(buildEndDate(event).toISOString()).toBe('2026-06-13T03:00:00.000Z');
  });

  it('iOS all-day: ends at local midnight the next day (exclusive)', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const event = makeEvent({ start_time: null });
    expect(buildEndDate(event).toISOString()).toBe('2026-06-13T07:00:00.000Z');
  });

  it('Android all-day: ends at UTC midnight the next day (exclusive)', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    const event = makeEvent({ start_time: null });
    expect(buildEndDate(event).toISOString()).toBe('2026-06-13T00:00:00.000Z');
  });

  it('multi-day all-day events end the day after end_date', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    const event = makeEvent({ start_time: null, end_date: '2026-06-14' });
    expect(buildEndDate(event).toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });
});
