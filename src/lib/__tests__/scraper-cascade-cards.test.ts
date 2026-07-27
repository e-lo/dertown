import assert from 'node:assert/strict';
import {
  extractCascadeCards,
  extractOpponent,
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

/**
 * Four cards covering the real formats the live site produces. Home/away is
 * carried by a `<span>Home|Away</span>` badge rendered right after the time
 * (no data-testid), NOT by the event-name's shape:
 *   1. HOME, comma format ("Cascade High School, Opponent")
 *   2. HOME, opponent-only name ("Quincy High School") — no comma, no "Cascade"
 *   3. AWAY (must be dropped even though the name mentions Cascade)
 *   4. HOME, "vs." format with a truncated opponent name
 */
function fixture(): string {
  return `
    <div>
      <span data-testid="event-1-month-and-day">Sep 8 2026</span>
      <span data-testid="event-1-time">6:30 PM</span>
      <span>Home</span>
      <span data-testid="event-1-event-name">Cascade High School, Kittitas Secondary School</span>
      <span data-testid="event-1-venue">Cascade High School (Leavenworth, WA)</span>
    </div>
    <div>
      <span data-testid="event-2-month-and-day">Sep 10 2026</span>
      <span data-testid="event-2-time">4:00 PM</span>
      <span>Home</span>
      <span data-testid="event-2-event-name">Quincy High School</span>
      <span data-testid="event-2-venue">Cascade Upper (Bus Garage) (Leavenworth, WA)</span>
    </div>
    <div>
      <span data-testid="event-3-month-and-day">Sep 15 2026</span>
      <span data-testid="event-3-time">5:00 PM</span>
      <span>Away</span>
      <span data-testid="event-3-event-name">Omak High School, Cascade High School</span>
      <span data-testid="event-3-venue">Omak H.S (Omak, WA)</span>
    </div>
    <div>
      <span data-testid="event-4-month-and-day">Oct 2 2026</span>
      <span data-testid="event-4-time">7:00 PM</span>
      <span>Home</span>
      <span data-testid="event-4-event-name">Cascade High School (Leavenworth) vs. Okanogan High...</span>
      <span data-testid="event-4-venue">Peshastin-Dryden Sports Complex (Peshastin, WA)</span>
    </div>`;
}

function run() {
  // Date parsing
  assert.equal(parseCascadeDate('Sep 8 2026'), '2026-09-08');
  assert.equal(parseCascadeDate('Oct 22 2026'), '2026-10-22');
  assert.equal(parseCascadeDate('garbage'), null);

  // Opponent-name cleanup across the real suffix/decoration variants
  assert.equal(cleanOpponent('Kittitas Secondary School'), 'Kittitas');
  assert.equal(cleanOpponent('Quincy High School'), 'Quincy');
  assert.equal(cleanOpponent('Omak H.S'), 'Omak');
  assert.equal(cleanOpponent('Okanogan High...'), 'Okanogan');

  // Opponent extraction across the three event-name formats
  assert.equal(extractOpponent('Cascade High School, Ephrata'), 'Ephrata');
  assert.equal(extractOpponent('Quincy High School'), 'Quincy');
  assert.equal(
    extractOpponent('Cascade High School (Leavenworth) vs. Okanogan High...'),
    'Okanogan'
  );
  // Even for an away-formatted name, the opponent is the non-Cascade side.
  assert.equal(extractOpponent('Omak High School, Cascade High School'), 'Omak');

  // URL building
  assert.equal(
    teamScheduleUrl(team, '2026-2027'),
    'https://www.cascadekodiakathletics.com/sport/girls-volleyball/schedule?team=7866316&year=2026-2027'
  );

  const url = teamScheduleUrl(team, '2026-2027');
  const events = extractCascadeCards(fixture(), team, url, source);

  // The away game (card 3) is dropped; the three home games remain.
  assert.equal(events.length, 3, 'only the three home games are kept');
  assert.ok(
    !events.some((e) => /Omak/.test(e.title)),
    'the away game against Omak must be dropped'
  );

  const byTitle = new Map(events.map((e) => [e.title, e]));

  // Card 1 — comma format, full field mapping
  const kittitas = byTitle.get('Cascade Girls Volleyball vs Kittitas');
  assert.ok(kittitas, 'home comma-format game present');
  assert.equal(kittitas!.start_date, '2026-09-08');
  assert.equal(kittitas!.start_time, '18:30');
  assert.equal(kittitas!.end_time, null);
  assert.equal(kittitas!.location_name, 'Cascade High School', 'venue address suffix stripped');
  assert.equal(kittitas!.website, url);
  assert.equal(kittitas!.image_url, LOGO, 'default image applied');
  assert.equal(
    kittitas!.description,
    'Cascade High School home girls volleyball game vs Kittitas.'
  );

  // Card 2 — opponent-only name at the bus-garage venue (previously dropped)
  const quincy = byTitle.get('Cascade Girls Volleyball vs Quincy');
  assert.ok(quincy, 'home opponent-only-name game present');
  assert.equal(quincy!.start_date, '2026-09-10');
  assert.equal(quincy!.start_time, '16:00');
  assert.equal(quincy!.location_name, 'Cascade Upper (Bus Garage)', 'nested parenthetical kept');

  // Card 4 — "vs." format with a truncated opponent name (previously dropped)
  const okanogan = byTitle.get('Cascade Girls Volleyball vs Okanogan');
  assert.ok(okanogan, 'home "vs." format game present');
  assert.equal(okanogan!.start_date, '2026-10-02');
  assert.equal(okanogan!.start_time, '19:00');
  assert.equal(okanogan!.location_name, 'Peshastin-Dryden Sports Complex');

  console.log('scraper-cascade-cards tests passed');
}

run();
