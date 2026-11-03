import assert from 'node:assert/strict';
import {
  parseRiverValleyEvents,
  parseTimeRange,
  resolveCalendarDate,
  type WeekRange,
} from '../scraper/parse-river-valley';
import type { SourceConfig } from '../scraper/types';

const source = {
  id: 'river-valley-commons',
  name: 'River Valley Commons',
  url: 'https://www.rivervalleycommons.net/activities',
  type: 'html',
} as SourceConfig;

const NOW = new Date(Date.UTC(2026, 10, 2));

function cell(id: string, lines: string[], tag: 'p' | 'li' = 'p'): string {
  const body = lines.map((line) => `<${tag}>${line}</${tag}>`).join('');
  return `<div id="${id}" data-testid="richTextElement">${tag === 'li' ? `<ul>${body}</ul>` : body}</div>`;
}

function week(item: string, header: string, dates: string[], times: string[], titles: string[]) {
  return (
    cell(`comp-a__${item}`, [header]) +
    cell(`comp-b__${item}`, dates, 'li') +
    cell(`comp-c__${item}`, times) +
    cell(`comp-d__${item}`, titles)
  );
}

function detail(item: string, heading: string, body: string): string {
  return cell(`comp-e__${item}`, [heading]) + cell(`comp-f__${item}`, [body]);
}

function page(...cells: string[]): string {
  return `<html><body>${cell('comp-nav', ['Not in a repeater'])}${cells.join('')}</body></html>`;
}

const SPECIAL_SECTION = cell('comp-g', ['Special Events']);
const ONGOING_SECTION = cell('comp-h', ['Ongoing Events']);

const week8: WeekRange = { month: 10, startDay: 8, endDay: 14, year: 2026 };

// Time ranges: the end's meridiem carries back to a bare start.
assert.deepEqual(parseTimeRange('4 - 5:30 pm'), { start: '16:00', end: '17:30' });
assert.deepEqual(parseTimeRange('9:30- 10:30 am'), { start: '09:30', end: '10:30' });
assert.deepEqual(parseTimeRange('11 - 1 pm'), { start: '11:00', end: '13:00' });
assert.deepEqual(parseTimeRange('6:15 pm'), { start: '18:15', end: null });
assert.deepEqual(parseTimeRange('12 pm'), { start: '12:00', end: null });
// No meridiem at all: morning-class hours read as am.
assert.deepEqual(parseTimeRange('10 - 11:30'), { start: '10:00', end: '11:30' });
assert.deepEqual(parseTimeRange('By Appt.'), { start: null, end: null });

// The weekday inside the week's range outranks a mistyped numeric date.
assert.equal(resolveCalendarDate('Fri 11/9', week8), '2026-11-13');
assert.equal(
  resolveCalendarDate('Sun. 10/25', { month: 10, startDay: 29, endDay: 30, year: 2026 }),
  '2026-11-29'
);
// A week crossing into the next month and year keeps counting days.
assert.equal(
  resolveCalendarDate('Fri 1/1', { month: 11, startDay: 27, endDay: 33, year: 2026 }),
  '2027-01-01'
);
assert.equal(resolveCalendarDate('Someday', week8), null);

// A full page: routine rows drop out; a *Special Event* row and a row matching
// the Special Events section stay, with typo'd dates, descriptions and series.
{
  const html = page(
    week(
      'item1',
      'November 8 - 14',
      ['Tues. 11/10', 'Thurs 11/5', 'Fri 11/9', 'Sun 11/8'],
      ['9:30-10:30 am', '6-8 pm', '6:15 pm', '4 pm'],
      ['Tai Chi', 'Astrology', 'Bingo&nbsp;', 'Chakras &nbsp;*Special Event*']
    ),
    week('item-x', 'November 15 - 21', ['Fri 11/20'], ['6:15 pm'], ['Astrology']),
    SPECIAL_SECTION,
    detail('item-a', 'First Thursday of Each Month Astrology Study Group', 'All levels. $25'),
    detail(
      'item-c',
      'Thursdays 9/24, 10/22 and 11/12 Chakra Class Series - Energy Dynamics',
      'A three part exploration. Find out more and sign up by clicking <a href="https://example.com/chakras">here</a>.'
    ),
    ONGOING_SECTION,
    detail('item-d', 'Tai Chi Class', 'Gentle movement. $10 members / $15 nonmembers'),
    detail('item-e', 'BINGO!', 'A set of one card for every game is $16.')
  );

  const events = parseRiverValleyEvents(html, source, NOW);
  assert.deepEqual(
    events.map((event) => event.title),
    ['Astrology', 'Chakras', 'Astrology']
  );

  const [astrology, chakras, secondAstrology] = events;
  assert.equal(astrology.start_date, '2026-11-12');
  assert.equal(astrology.start_time, '18:00');
  assert.equal(astrology.end_time, '20:00');
  assert.equal(astrology.cost, '$25');
  assert.equal(astrology.website, source.url);
  assert.equal(astrology.series_key, 'river-valley-commons-astrology');
  assert.equal(secondAstrology.series_parent_title, 'Astrology');

  assert.equal(chakras.description, 'A three part exploration.');
  assert.equal(chakras.registration_url, 'https://example.com/chakras');
  assert.equal(chakras.series_key, null);
}

// A week whose columns disagree is dropped, never mis-paired.
{
  const html = page(
    week('item1', 'November 8 - 14', ['Mon 11/9', 'Tues 11/10'], ['10 am'], ['Tai Chi'])
  );
  assert.deepEqual(parseRiverValleyEvents(html, source, NOW), []);
}

// A dated detail block missing from the grid still becomes an event; one
// already in the grid doesn't double up.
{
  const html = page(
    week('item1', 'November 22 - 28', ['Tues 11/24'], ['10 am'], ['Tai Chi']),
    SPECIAL_SECTION,
    detail(
      'item-a',
      'Tuesday November 24\n6:30 - 8:30 pm\nOpen Mic for Musicians\nand following 4th Tuesdays',
      'Musicians and singers share what they are working on.'
    ),
    detail('item-b', 'Tuesday November 24\n10 am\nTai Chi Class', 'Gentle movement.')
  );
  const events = parseRiverValleyEvents(html, source, NOW);
  assert.equal(events.length, 2);
  assert.equal(events[1].title, 'Open Mic for Musicians');
  assert.equal(events[1].start_date, '2026-11-24');
  assert.equal(events[1].start_time, '18:30');
  assert.equal(events[1].end_time, '20:30');
}

// The Movie Night grid row takes its text from the page's "Film Night" block.
{
  const html = page(
    week(
      'item1',
      'November 15 - 21',
      ['Tues 11/17'],
      ['6:30 pm'],
      ['Monthly Movie Night (3rd Tuesdays)']
    ),
    SPECIAL_SECTION,
    detail('item-a', 'Film Night', 'All are welcome. There is no charge.')
  );
  const [movie] = parseRiverValleyEvents(html, source, NOW);
  assert.equal(movie.title, 'Monthly Movie Night');
  assert.equal(movie.description, 'All are welcome. There is no charge.');
  assert.equal(movie.cost, 'Free');
}

// A detail block's stated time beats a grid row whose columns slipped.
{
  const html = page(
    week(
      'item1',
      'November 15 - 21',
      ['Sun 11/15'],
      ['7 pm'],
      ['Drawing with Ink *Special Event*']
    ),
    detail('item-a', 'Sundays Nov. 8 & 15\n4:00 -5:30 pm\nDrawing with Ink', 'No Fear Art!')
  );
  const [drawing] = parseRiverValleyEvents(html, source, NOW);
  assert.equal(drawing.start_time, '16:00');
  assert.equal(drawing.end_time, '17:30');
}

// The venue is set outright, so the matcher can't guess one from the text.
{
  const html = page(
    week('item1', 'November 8 - 14', ['Fri 11/13'], ['9:30 am'], ['NIA *Special Event*']),
    detail('item-a', 'NIA', 'Virtually anyone can enjoy this.')
  );
  const venueSource = { ...source, default_location: 'Leavenworth Senior Center' };
  const [nia] = parseRiverValleyEvents(html, venueSource, NOW);
  assert.equal(nia.location_name, 'Leavenworth Senior Center');
}

// A dated block outside the Special Events section stays out.
{
  const html = page(
    week('item1', 'November 22 - 28', ['Tues 11/24'], ['10 am'], ['Tai Chi']),
    ONGOING_SECTION,
    detail('item-a', 'Tuesday November 24\n6:30 - 8:30 pm\nOpen Mic', 'Musicians share.')
  );
  assert.deepEqual(parseRiverValleyEvents(html, source, NOW), []);
}

// A page that no longer has the calendar repeater fails loudly.
assert.throws(() => parseRiverValleyEvents(page(), source, NOW), /No calendar weeks/);

console.log('scraper-river-valley tests passed');
