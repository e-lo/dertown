/**
 * Autocomplete dropdown wiring canary.
 *
 * `.autocomplete-dropdown` in src/styles/admin.css is `display: none` by
 * default and is only revealed by the companion `.autocomplete-dropdown.block`
 * rule. Toggling Tailwind's `hidden` class alone therefore does nothing: the
 * base rule keeps the dropdown collapsed no matter what.
 *
 * Every autocomplete is wired by hand in an inline page script, and the public
 * event detail page's `setupAc()` toggled only `hidden` — so the location,
 * organization and parent-event dropdowns in its edit modal never appeared.
 * Neither the type checker nor eslint can see a CSS contract broken by a
 * missing class name, so assert it here.
 */
import { readFileSync, readdirSync } from 'node:fs';

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

const root = new URL('../../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');

/** Every .astro file under src/, so a new autocomplete host is covered on day one. */
function astroFiles(dir: string): string[] {
  return readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return astroFiles(path);
    return entry.name.endsWith('.astro') ? [path] : [];
  });
}

console.log('🧪 Autocomplete dropdown wiring\n');

check('admin.css still gates .autocomplete-dropdown behind the block class', () => {
  const css = read('src/styles/admin.css');
  if (!/\.autocomplete-dropdown\s*\{[^}]*display:\s*none/.test(css)) {
    throw new Error(
      '.autocomplete-dropdown no longer defaults to display:none — the "block" ' +
        'requirement below may be obsolete; revisit this canary.'
    );
  }
  if (!/\.autocomplete-dropdown\.block\s*\{[^}]*display:\s*block/.test(css)) {
    throw new Error('.autocomplete-dropdown.block no longer reveals the dropdown');
  }
});

// A dropdown is shown by removing `hidden`; because of the CSS above that is
// only half the job. Pair each reveal with the `block` class that actually
// makes it visible, and each hide with removing it again.
const REVEAL = /\b([A-Za-z_$][\w$]*)\.classList\.remove\(\s*'hidden'\s*\)/g;
const CONCEAL = /\b([A-Za-z_$][\w$]*)\.classList\.add\(\s*'hidden'\s*\)/g;
const IS_DROPDOWN = /dropdown/i;
const WINDOW = 200;

/** Does `name` get `classList.<verb>('block')` within a window around `index`? */
function togglesBlockNearby(source: string, name: string, verb: string, index: number): boolean {
  const nearby = source.slice(Math.max(0, index - WINDOW), index + WINDOW);
  return new RegExp(`\\b${name}\\.classList\\.${verb}\\(\\s*'block'\\s*\\)`).test(nearby);
}

for (const file of astroFiles('src/pages').concat(astroFiles('src/components'))) {
  const source = read(file);
  if (!source.includes('autocomplete-dropdown')) continue;

  check(`${file} pairs every dropdown reveal with the block class`, () => {
    const unpaired = [...source.matchAll(REVEAL)]
      .filter((m) => IS_DROPDOWN.test(m[1]))
      .filter((m) => !togglesBlockNearby(source, m[1], 'add', m.index ?? 0))
      .map((m) => m[0]);
    if (unpaired.length) {
      throw new Error(
        `${unpaired.length} reveal(s) never add 'block', so the dropdown stays ` +
          `display:none: ${[...new Set(unpaired)].join(', ')}`
      );
    }
  });

  check(`${file} pairs every dropdown hide with dropping the block class`, () => {
    const unpaired = [...source.matchAll(CONCEAL)]
      .filter((m) => IS_DROPDOWN.test(m[1]))
      .filter((m) => !togglesBlockNearby(source, m[1], 'remove', m.index ?? 0))
      .map((m) => m[0]);
    if (unpaired.length) {
      throw new Error(
        `${unpaired.length} hide(s) leave 'block' on, so 'hidden' has to fight it: ` +
          `${[...new Set(unpaired)].join(', ')}`
      );
    }
  });
}

console.log(`\n${failures === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failures} TEST(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
