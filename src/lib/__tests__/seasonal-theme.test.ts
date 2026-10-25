import {
  CATEGORY_SLOTS,
  CONSTANTS,
  SEASON_IDS,
  SEASON_PALETTES,
  getSeasonForMonth,
  resolveSeason,
} from '../config';
import { contrastRatio, readableTextOn } from '../color-contrast';
import { buildThemeCss } from '../../../scripts/theme-css';

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`✅ PASS: ${label}`);
  } else {
    console.log(`❌ FAIL: ${label}`);
    failures++;
  }
}

console.log('🧪 Testing seasonal palettes\n');

const expectedByMonth: Record<number, string> = {
  1: 'ski',
  2: 'ski',
  3: 'ski',
  4: 'wildflower',
  5: 'wildflower',
  6: 'wildflower',
  7: 'wildflower',
  8: 'wildflower',
  9: 'fall',
  10: 'fall',
  11: 'holiday',
  12: 'holiday',
};
for (const [month, season] of Object.entries(expectedByMonth)) {
  check(`month ${month} is ${season}`, getSeasonForMonth(Number(month)) === season);
}

check('?season=fall wins over the date', resolveSeason('fall', 1) === 'fall');
check('unknown ?season= falls back to the date', resolveSeason('summer', 1) === 'ski');
check('missing ?season= uses the date', resolveSeason(null, 11) === 'holiday');
check('markup in ?season= is ignored', resolveSeason('<script>', 5) === 'wildflower');

for (let month = 1; month <= 12; month++) {
  const owners = SEASON_IDS.filter((id) => SEASON_PALETTES[id].months.includes(month));
  check(`month ${month} belongs to exactly one season`, owners.length === 1);
}

for (const category of [...CONSTANTS.tagCategories, 'featured']) {
  check(`${category} has a palette slot`, category in CATEGORY_SLOTS);
}

for (const id of SEASON_IDS) {
  const { colors, announcement } = SEASON_PALETTES[id];
  check(`${id} uses at most 7 colors`, new Set(Object.values(colors)).size <= 7);
  // Light text is the season's off-white page color, not pure white.
  const onColor = (bg: string) => readableTextOn(bg, colors.page);
  check(`${id} hero reads with off-white text`, contrastRatio(colors.page, colors.hero) >= 4.5);
  const band = colors[announcement];
  check(`${id} announcement band is readable`, contrastRatio(onColor(band), band) >= 4.5);
  for (const [category, slot] of Object.entries(CATEGORY_SLOTS)) {
    const bg = colors[slot];
    check(`${id} ${category} card is readable`, contrastRatio(onColor(bg), bg) >= 4.5);
  }
}

check('fall highlight is deep pumpkin', SEASON_PALETTES.fall.colors.highlight === '#c43b00');
check('light text can be an off-white', readableTextOn('#1d3150', '#f8f0e3') === '#f8f0e3');
check('ski sports is rosewood', SEASON_PALETTES.ski.colors.sports === '#9a5248');
check('white on black is 21:1', Math.abs(contrastRatio('#ffffff', '#000000') - 21) < 0.01);
check('canary takes dark text', readableTextOn('#ffe600') === '#111111');
check('navy takes white text', readableTextOn('#1d3150') === '#ffffff');

console.log('\n🧪 Testing generated theme CSS\n');

const css = buildThemeCss();
/** The body of the `:root[data-season="id"]` block. */
function seasonBlock(id: string): string {
  const start = css.indexOf(`:root[data-season="${id}"] {`);
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start));
}

for (const id of SEASON_IDS) {
  check(`css has a ${id} block`, seasonBlock(id) !== '');
}
check(
  'fall sports card is oxblood',
  seasonBlock('fall').includes('--color-category-sports: #6a010f;')
);
check(
  'holiday family card takes dark text',
  seasonBlock('holiday').includes('--color-category-family-text: #111111;')
);
check(
  'wildflower family card takes the off-white page color',
  seasonBlock('wildflower').includes('--color-category-family-text: #f8f7f0;')
);
check(
  'fall announcement band is amber',
  seasonBlock('fall').includes('--color-announcement-bg: #ff9b0c;')
);
check(
  'wildflower announcement band is balsamroot',
  seasonBlock('wildflower').includes('--color-announcement-bg: #f0b62b;')
);
check(
  'fall highlight text is cream (pumpkin)',
  seasonBlock('fall').includes('--color-secondary-text: #f8f0e3;')
);
check(
  'Tailwind white follows the season off-white',
  css.includes('--color-white: var(--color-surface);')
);
check('css styles untagged events', css.includes('.bg-event-default'));
check('css styles give-back events', css.includes('.bg-event-give-back'));
check(
  'event cards take their text color from the season',
  css.includes('color: var(--color-category-give-back-text) !important')
);
check('old indigo is gone', !css.includes('#4740cb'));
check('old canary is gone', !css.includes('#ffe600'));

for (const id of SEASON_IDS) {
  const page = SEASON_PALETTES[id].colors.page;
  const block = seasonBlock(id);
  const tint = (name: string) =>
    block.match(new RegExp(`--color-${name}: (#[0-9a-f]{6});`))?.[1] ?? page;
  check(
    `${id} light gray panels are a visible shade of the page, not near-white`,
    contrastRatio(page, tint('gray-50')) >= 1.05 && contrastRatio(page, tint('gray-100')) >= 1.1
  );
}

console.log(
  failures === 0 ? '\n✅ All seasonal palette tests passed' : `\n❌ ${failures} failure(s)`
);
process.exit(failures === 0 ? 0 : 1);
