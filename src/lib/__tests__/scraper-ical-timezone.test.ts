import assert from 'node:assert/strict';
import { parseIcalFeed } from '../scraper/parse-ical';

/** Build a minimal iCal feed with a single TZID-anchored VEVENT. */
function feed(dtstart: string, dtend: string): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//test//EN',
    'BEGIN:VTIMEZONE',
    'TZID:America/Los_Angeles',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0800',
    'TZOFFSETTO:-0700',
    'TZNAME:PDT',
    'DTSTART:20260308T020000',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    'UID:1',
    'SUMMARY:Leavenworth Summer Theater: Anything Goes',
    `DTSTART;TZID=America/Los_Angeles:${dtstart}`,
    `DTEND;TZID=America/Los_Angeles:${dtend}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function run() {
  // Regression: an evening Pacific-time event (7:00 PM July 29) must not roll
  // forward to July 30. node-ical yields a Date whose UTC instant is the next
  // day (02:00Z); the parser must read the date on the same basis as the time.
  const evening = parseIcalFeed(feed('20260729T190000', '20260729T213000'));
  assert.equal(evening.length, 1);
  assert.equal(evening[0].start_date, '2026-07-29', 'evening event date must stay July 29');
  assert.equal(evening[0].start_time, '19:00', 'evening event time must stay 7:00 PM');
  assert.equal(evening[0].end_time, '21:30', 'evening event end time must stay 9:30 PM');

  // Sanity: a morning event (already safe before the fix) still parses correctly.
  const morning = parseIcalFeed(feed('20260729T090000', '20260729T103000'));
  assert.equal(morning[0].start_date, '2026-07-29', 'morning event date');
  assert.equal(morning[0].start_time, '09:00', 'morning event time');

  console.log('scraper-ical-timezone tests passed');
}

run();
