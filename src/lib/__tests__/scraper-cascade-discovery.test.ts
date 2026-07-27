import assert from 'node:assert/strict';
import { currentSchoolYear } from '../scraper/parse-cascade';

function run() {
  // July (month 6) and later belong to the upcoming school year.
  assert.equal(currentSchoolYear(new Date(2026, 6, 27)), '2026-2027', 'late July → new year');
  assert.equal(currentSchoolYear(new Date(2026, 8, 8)), '2026-2027', 'September → same year');
  assert.equal(currentSchoolYear(new Date(2027, 0, 16)), '2026-2027', 'January → prior calendar year');
  // Before July belongs to the year that started the previous August.
  assert.equal(currentSchoolYear(new Date(2026, 2, 1)), '2025-2026', 'March → prior school year');

  console.log('scraper-cascade-discovery tests passed');
}

run();
