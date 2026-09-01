/**
 * Duplicate-event wiring canary.
 *
 * The Duplicate button lives in the shared EditEventModal, but each page that
 * mounts that modal wires `window.duplicateCurrentEvent` itself. On the public
 * event detail page the handler only navigated to `/admin/events/<id>`, which
 * loads that event in EDIT mode — so "Duplicate" silently edited the original
 * instead of creating a copy.
 *
 * Nothing in the type system or the linter catches that: it is a routing bug in
 * inline page scripts. These checks assert the wiring contract instead.
 */
import { readFileSync } from 'node:fs';

let failures = 0;
function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${label}`);
  } catch (e) {
    console.log(`❌ FAIL: ${label}\n        ${(e as Error).message}`);
    failures++;
  }
}

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

const publicEventPage = read('src/pages/events/[id].astro');
const adminEventPage = read('src/pages/admin/events/[id].astro');

console.log('🧪 Duplicate-event wiring\n');

check('public event page defines a duplicateCurrentEvent handler', () => {
  if (!/duplicateCurrentEvent\s*=/.test(publicEventPage)) {
    throw new Error('no window.duplicateCurrentEvent assignment found');
  }
});

check('public event page Duplicate does not navigate to the plain edit URL', () => {
  // Isolate the handler body so unrelated navigations (Edit, series) don't match.
  const handler = publicEventPage.match(/duplicateCurrentEvent\s*=\s*[^\n]*\n?/)?.[0] ?? '';
  const target = handler.match(/\/admin\/events\/\$\{[^}]+\}([^`'"]*)/)?.[1];
  if (target === undefined) return; // routed somewhere else entirely — checked below
  if (!/duplicate/i.test(target)) {
    throw new Error(
      `Duplicate navigates to /admin/events/<id>${target} — that page loads the event ` +
        'in edit mode, so saving updates the ORIGINAL. Needs a duplicate marker on the URL.'
    );
  }
});

check('public event page Duplicate routes through a duplicate-mode entry point', () => {
  const handler = publicEventPage.match(/duplicateCurrentEvent\s*=\s*[^\n]*\n?/)?.[0] ?? '';
  if (!/duplicate=1|duplicateEvent=/.test(handler)) {
    throw new Error(`handler carries no duplicate signal: ${handler.trim()}`);
  }
});

check('admin event page honors the ?duplicate=1 marker after loading the event', () => {
  const usesPublicMarker = /\/admin\/events\/\$\{[^}]+\}\?duplicate=1/.test(publicEventPage);
  if (!usesPublicMarker) return; // a different entry point is in use; nothing to honor here
  if (!/URLSearchParams[\s\S]{0,200}?['"]duplicate['"]/.test(adminEventPage)) {
    throw new Error('admin/events/[id].astro never reads the "duplicate" query param');
  }
  if (
    !/duplicate['"]\s*\)\s*===\s*['"]1['"][\s\S]{0,300}?duplicateCurrentEvent\(\)/.test(
      adminEventPage
    )
  ) {
    throw new Error(
      'admin/events/[id].astro reads the param but never calls duplicateCurrentEvent()'
    );
  }
});

check('admin event page still submits as create while in duplicate mode', () => {
  if (!/if\s*\(isDuplicateMode\)\s*\{\s*await createEvent\(\)/.test(adminEventPage)) {
    throw new Error('submit handler no longer branches on isDuplicateMode -> createEvent()');
  }
});

console.log(`\n${failures === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failures} TEST(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
