import assert from 'node:assert/strict';
import { parseHtml } from '../scraper/parse-html';
import type { SourceConfig } from '../scraper/types';

function run() {
  const source: SourceConfig = {
    id: 'icicle-brewing',
    name: 'Icicle Brewing Company',
    url: 'https://iciclebrewing.com/ibc-events/',
    type: 'html',
  };

  const html = `
    <article class="mec-event-article">
      <h4 class="mec-event-title">
        <a href="https://iciclebrewing.com/ibc-events/talk-nerdy-to-me-rock-climbing-in-the-cascades/">
          Talk Nerdy to Me! Rock Climbing in the Cascades
        </a>
      </h4>
      <div class="mec-event-date">10 Mar</div>
      <div class="mec-event-time">6:30 pm - 8:30 pm</div>
      <div class="mec-event-location">Icicle Brewing Company Tasting Room</div>
      <div class="mec-event-excerpt"><p>Join us for a geology night.</p></div>
    </article>
    <article class="mec-event-article">
      <h4 class="mec-event-title">
        <a href="/ibc-events/music-bingo/">
          Music Bingo
        </a>
      </h4>
      <time datetime="2026-03-09T18:30:00-08:00">Mar 9, 2026</time>
      <div class="mec-event-time">6:30 pm - 8:30 pm</div>
    </article>
  `;

  const events = parseHtml(html, source);

  assert.equal(events.length, 2);
  assert.equal(events[0].title, 'Talk Nerdy to Me! Rock Climbing in the Cascades');
  assert.equal(events[0].start_date, '2026-03-10');
  assert.equal(events[0].start_time, '18:30');
  assert.equal(events[0].end_time, '20:30');
  assert.equal(
    events[0].website,
    'https://iciclebrewing.com/ibc-events/talk-nerdy-to-me-rock-climbing-in-the-cascades/'
  );
  assert.equal(events[1].website, 'https://iciclebrewing.com/ibc-events/music-bingo/');
  assert.equal(events[1].start_date, '2026-03-09');

  console.log('parse-icicle-brewing-html tests passed');
}

run();
