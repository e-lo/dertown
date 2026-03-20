import assert from 'node:assert/strict';
import { __testing } from '../scraper/enrich';

function run() {
  const eventUrl = 'https://icicle.my.salesforce-sites.com/ticket/#/events/a0SPH00000DFlK52AL';
  const eventHtml = `
    <script>
      window.__INITIAL_STATE__ = {
        "instances":[
          {"url":"#/instances/a0FPH00000D9Ltl2AF"},
          {"url":"#/instances/a0FPH00000D9Ltm2AF"}
        ]
      };
    </script>
  `;

  const urls = __testing.extractSalesforceInstanceUrls(eventHtml, eventUrl);
  assert.equal(urls.length, 2);
  assert.equal(urls[0].includes('#/instances/'), true);
  assert.equal(__testing.buildSalesforceSeriesKey(eventUrl), 'salesforce-event:a0SPH00000DFlK52AL');

  const instanceHtml = `
    <script type="application/json">
      {"startDateTime":"2026-03-14T02:30:00Z","endDateTime":"2026-03-14T04:00:00Z","venueName":"Snowy Owl Theater","minPrice":20,"maxPrice":45}
    </script>
  `;

  const details = __testing.extractSalesforceInstanceDetails(instanceHtml);
  assert.equal(details.start_date, '2026-03-13');
  assert.equal(details.start_time, '19:30');
  assert.equal(details.end_time, '21:00');
  assert.equal(details.venue, 'Snowy Owl Theater');
  assert.equal(details.cost, '$20-$45');

  console.log('scraper-salesforce-enrich tests passed');
}

run();
