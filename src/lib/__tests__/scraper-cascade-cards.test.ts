import assert from 'node:assert/strict';
import {
  extractCascadeCards,
  parseCascadeDate,
  cleanOpponent,
  teamScheduleUrl,
  type VarsityTeam,
} from '../scraper/parse-cascade';
import type { SourceConfig } from '../scraper/types';

const LOGO =
  'https://sportshub2-uploads.vnn-prod.zone/files/sites/2623/2020/10/09135212/Cascade.png';

const source = {
  id: 'cascade-athletics',
  name: 'Cascade High School Athletics',
  url: 'https://www.cascadekodiakathletics.com',
  type: 'html',
  default_image: LOGO,
} as SourceConfig;

const team: VarsityTeam = {
  id: '7866316',
  sportLabel: 'Girls Volleyball',
  slug: 'girls-volleyball',
};

/** One home card (Cascade first) and one away card (Cascade second). */
function fixture(): string {
  return `
    <div>
      <span data-testid="event-1-month-and-day">Sep 8 2026</span>
      <span data-testid="event-1-time">6:30 PM</span>
      <span data-testid="event-1-event-name">Cascade High School, Kittitas Secondary School</span>
      <span data-testid="event-1-venue">Cascade High School (Leavenworth, WA)</span>
    </div>
    <div>
      <span data-testid="event-2-month-and-day">Sep 15 2026</span>
      <span data-testid="event-2-time">5:00 PM</span>
      <span data-testid="event-2-event-name">Omak High School, Cascade High School</span>
      <span data-testid="event-2-venue">Omak H.S (Omak, WA)</span>
    </div>`;
}

function run() {
  assert.equal(parseCascadeDate('Sep 8 2026'), '2026-09-08');
  assert.equal(parseCascadeDate('Oct 22 2026'), '2026-10-22');
  assert.equal(parseCascadeDate('garbage'), null);

  assert.equal(cleanOpponent('Kittitas Secondary School'), 'Kittitas');
  assert.equal(cleanOpponent('Quincy High School'), 'Quincy');
  assert.equal(cleanOpponent('Omak H.S'), 'Omak');

  assert.equal(
    teamScheduleUrl(team, '2026-2027'),
    'https://www.cascadekodiakathletics.com/sport/girls-volleyball/schedule?team=7866316&year=2026-2027'
  );

  const url = teamScheduleUrl(team, '2026-2027');
  const events = extractCascadeCards(fixture(), team, url, source);

  assert.equal(events.length, 1, 'only the home game is kept');
  const e = events[0];
  assert.equal(e.title, 'Cascade Girls Volleyball vs Kittitas');
  assert.equal(e.start_date, '2026-09-08');
  assert.equal(e.start_time, '18:30');
  assert.equal(e.end_time, null);
  assert.equal(e.location_name, 'Cascade High School', 'venue address suffix stripped');
  assert.equal(e.website, url);
  assert.equal(e.image_url, LOGO, 'default image applied');
  assert.equal(e.description, 'Cascade High School home girls volleyball game vs Kittitas.');

  console.log('scraper-cascade-cards tests passed');
}

run();
