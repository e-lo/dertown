import assert from 'node:assert/strict';
import { clampDescription } from '../scraper/description';

function run() {
  const short = 'Short description';
  assert.equal(clampDescription(short, 12000), short);

  const spaced = 'Line one.\n\nLine two.\tLine three.';
  assert.equal(clampDescription(spaced, 12000), 'Line one. Line two. Line three.');

  const long = 'A'.repeat(200);
  const clamped = clampDescription(long, 100);
  assert.ok(clamped !== null);
  assert.equal(clamped!.length <= 100, true);
  assert.equal(clamped!.endsWith('…'), true);

  console.log('scraper-description tests passed');
}

run();
