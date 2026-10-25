/**
 * Seasonal-theme wiring canary.
 *
 * Seasonal category colors can be pale (powder blue, blush, amber) or deep, so
 * anything drawn on them must take the generated readable text color rather
 * than a hardcoded white, and nothing may keep the retired indigo/canary
 * palette. None of this is caught by types or lint, so assert it on the source.
 */
import { readFileSync } from 'node:fs';

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(ok ? `✅ PASS: ${label}` : `❌ FAIL: ${label}${detail ? `\n        ${detail}` : ''}`);
  if (!ok) failures++;
}

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** The markup from the element carrying `marker` up to its closing tag `close`. */
function blockAfter(src: string, marker: string, close: string): string {
  const start = src.indexOf(marker);
  return start < 0 ? '' : src.slice(start, src.indexOf(close, start));
}

console.log('🧪 Seasonal theme wiring\n');

const doGoodHero = blockAfter(read('src/pages/do-good.astro'), 'bg-event-give-back', '</p>');
check('do-good hero exists', doGoodHero !== '');
check('do-good hero text inherits the give-back text color', !doGoodHero.includes('text-white'));

const parks = blockAfter(read('src/pages/things-to-do.astro'), 'bg-blue-green', '</h2>');
check('things-to-do parks heading inherits the outdoors text color', !parks.includes('text-white'));

const components = read('src/styles/components.css');
check(
  'components.css does not override the text-primary utility',
  !/^\.text-primary\s*\{/m.test(components)
);
check(
  'calendar month pills take their text color from the category',
  !/\.cal-month-pill\s*\{[^}]*color:\s*white/.test(components)
);

const listCard = read('src/components/EventListCard.astro');
check(
  'list cards fall back to bg-event-default for tags with no slot',
  listCard.includes('CATEGORY_SLOTS') && listCard.includes("'bg-event-default'")
);

const calendar = read('public/calendar.js');
check('calendar.js no longer hardcodes canary', !calendar.toLowerCase().includes('#ffe600'));
check('calendar.js no longer hardcodes indigo', !calendar.toLowerCase().includes('#4740cb'));
check('calendar.js reads the seasonal category variables', calendar.includes('--color-category-'));

const literalWhite = /(background(-color)?|color):\s*(white|#fff|#ffffff)\s*[;}]/;
for (const p of [
  'src/styles/components.css',
  'src/components/MapboxMap.astro',
  'src/pages/events/map.astro',
]) {
  check(`${p} uses the season off-white instead of pure white`, !literalWhite.test(read(p)));
}

const navbar = read('src/components/Navbar.astro');
check('menu highlights are not light gray on off-white', !/hover:bg-gray-(50|100)\b/.test(navbar));
check('menu highlights use the season primary', navbar.includes('hover:bg-primary'));

const adminLayout = read('src/components/AdminLayout.astro');
check(
  'admin page background is the season dark primary',
  /<body[^>]*\bbg-primary-dark\b/.test(adminLayout) && !/<body[^>]*from-gray-50/.test(adminLayout)
);

console.log(
  failures === 0 ? '\n✅ All seasonal wiring checks passed' : `\n❌ ${failures} failure(s)`
);
process.exit(failures === 0 ? 0 : 1);
