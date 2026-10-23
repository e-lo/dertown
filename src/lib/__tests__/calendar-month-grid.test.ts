/**
 * Month-view layout canary.
 *
 * With `repeat(7, 1fr)` a grid column can't shrink below its widest content,
 * and month pills never wrap, so one long event title stretched its whole
 * column, squeezed the others and pushed Saturday out of the frame. Columns
 * must be allowed to shrink so pills truncate, and each pill must carry its
 * full title for hover.
 */
import { readFileSync } from 'node:fs';

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(ok ? `✅ PASS: ${label}` : `❌ FAIL: ${label}`);
  if (!ok) failures++;
}

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

console.log('🧪 Calendar month grid\n');

const css = read('src/styles/components.css');
const grid = css.match(/\.cal-month-grid\s*\{[^}]*\}/)?.[0] ?? '';
check(
  'month columns can shrink below their content',
  /repeat\(7,\s*minmax\(0,\s*1fr\)\)/.test(grid)
);

const calendar = read('public/calendar.js');
const pill = calendar.match(/<span class="cal-month-pill"[^>]*>/)?.[0] ?? '';
check(
  'month pills show the full title on hover',
  /title="\$\{escapeHtml\(e\.title\)\}"/.test(pill)
);

console.log(failures === 0 ? '\n✅ All month grid checks passed' : `\n❌ ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
