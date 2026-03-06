import assert from 'node:assert/strict';
import { parseLibCalJson } from '../scraper/parse-json';

function run() {
  const json = JSON.stringify({
    results: [
      {
        title: 'Musical Story Time',
        startdt: '2026-03-10 10:00:00',
        start: '10:00 AM',
        end: '11:00 AM',
        location: 'LEAVENWORTH- Main Area',
        shortdesc: 'This is a teaser that ends early...',
        description:
          '<p>Join us for stories, songs, rhymes, crafts, imaginative play, and all-around fun!</p><p>This program is designed for babies, toddlers, preschoolers, and their adult caregivers.</p>',
        url: 'https://ncwlibraries.libcal.com/event/16034905',
      },
    ],
  });

  const events = parseLibCalJson(json);
  assert.equal(events.length, 1);
  assert.equal(events[0].title, 'Musical Story Time');
  assert.equal(
    events[0].description,
    'Join us for stories, songs, rhymes, crafts, imaginative play, and all-around fun! This program is designed for babies, toddlers, preschoolers, and their adult caregivers.'
  );
  assert.equal(events[0].location_name, 'Leavenworth Library');

  // Fallback when full description is missing
  const fallbackJson = JSON.stringify({
    results: [
      {
        title: 'Fallback Event',
        startdt: '2026-03-11 09:00:00',
        shortdesc: 'Short description only',
      },
    ],
  });

  const fallbackEvents = parseLibCalJson(fallbackJson);
  assert.equal(fallbackEvents.length, 1);
  assert.equal(fallbackEvents[0].description, 'Short description only');

  console.log('parse-libcal-json tests passed');
}

run();
