import {
  CATEGORY_SLOTS,
  CONSTANTS,
  SEASON_IDS,
  SEASON_PALETTES,
  getSeasonForMonth,
  resolveSeason,
} from '../config';
import { contrastRatio, readableTextOn } from '../color-contrast';

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
  1: 'ski', 2: 'ski', 3: 'ski',
  4: 'wildflower', 5: 'wildflower', 6: 'wildflower', 7: 'wildflower', 8: 'wildflower',
  9: 'fall', 10: 'fall',
  11: 'holiday', 12: 'holiday',
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
  check(`${id} hero reads with white text`, contrastRatio('#ffffff', colors.hero) >= 4.5);
  const band = colors[announcement];
  check(`${id} announcement band is readable`, contrastRatio(readableTextOn(band), band) >= 4.5);
  for (const [category, slot] of Object.entries(CATEGORY_SLOTS)) {
    const bg = colors[slot];
    check(`${id} ${category} card is readable`, contrastRatio(readableTextOn(bg), bg) >= 4.5);
  }
}

check('fall highlight is pumpkin', SEASON_PALETTES.fall.colors.highlight === '#d74100');
check('ski sports is rosewood', SEASON_PALETTES.ski.colors.sports === '#9a5248');
check('white on black is 21:1', Math.abs(contrastRatio('#ffffff', '#000000') - 21) < 0.01);
check('canary takes dark text', readableTextOn('#ffe600') === '#111111');
check('navy takes white text', readableTextOn('#1d3150') === '#ffffff');

console.log(failures === 0 ? '\n✅ All seasonal palette tests passed' : `\n❌ ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
