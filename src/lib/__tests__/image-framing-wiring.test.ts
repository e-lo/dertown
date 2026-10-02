/**
 * Image-framing wiring canary.
 *
 * The framing panel lives in the shared EditEventModal, but each page fills and
 * saves that modal with its own inline script. A page that forgets to call
 * setValue shows stale framing from the previous event; one that forgets
 * getValue silently drops the admin's choices. Neither is caught by types or
 * lint, so assert the contract on the source.
 */
import { readFileSync } from 'node:fs';

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(ok ? `✅ PASS: ${label}` : `❌ FAIL: ${label}${detail ? `\n        ${detail}` : ''}`);
  if (!ok) failures++;
}

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const count = (src: string, re: RegExp) => (src.match(re) || []).length;

const SET = /eventImageFraming\?\.setValue\(/g;
const GET = /image_display:\s*window\.eventImageFraming\?\.getValue\(\)/g;
const DISABLE = /eventImageFraming\?\.disable\(\)/g;

console.log('🧪 Image-framing wiring\n');

const admin = read('src/pages/admin.astro');
check(
  'admin.astro: load in editExistingEvent, duplicateEvent, paste reset (≥3)',
  count(admin, SET) >= 3,
  `found ${count(admin, SET)}`
);
check('admin.astro: staged events disable the panel', count(admin, DISABLE) >= 1);
check(
  'admin.astro: new-event and existing-event saves send framing (≥2)',
  count(admin, GET) >= 2,
  `found ${count(admin, GET)}`
);

const adminEvent = read('src/pages/admin/events/[id].astro');
check('admin/events/[id]: load in populateEventForm', count(adminEvent, SET) >= 1);
check(
  'admin/events/[id]: updateEvent and createEvent send framing (≥2)',
  count(adminEvent, GET) >= 2,
  `found ${count(adminEvent, GET)}`
);

const adminNew = read('src/pages/admin/events/new.astro');
check('admin/events/new: reset on open', count(adminNew, SET) >= 1);
check('admin/events/new: createEvent sends framing', count(adminNew, GET) >= 1);

const publicEvent = read('src/pages/events/[id].astro');
check('events/[id]: load when opening the editor', count(publicEvent, SET) >= 1);
check('events/[id]: save sends framing', count(publicEvent, GET) >= 1);

console.log(failures === 0 ? '\nAll wiring checks passed' : `\n${failures} failing`);
process.exit(failures === 0 ? 0 : 1);
