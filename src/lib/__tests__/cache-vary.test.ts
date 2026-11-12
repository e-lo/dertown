import { setPublicCache } from '../cache';

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`✅ PASS: ${label}`);
  } else {
    console.log(`❌ FAIL: ${label}`);
    failures++;
  }
}

console.log('🧪 Testing cache.setPublicCache Netlify-Vary\n');

// Filtered pages: the CDN must key on the filter params, or the first visitor's
// filtered result is served for every URL (prod bug: /families/sports?sport=Hockey
// showed the cached Lacrosse-only page).
const filtered = new Headers();
setPublicCache(filtered, [], ['sport', 'season', 'age']);
const vary = filtered.get('Netlify-Vary') ?? '';
check('varies on the listed query params', vary.includes('query=sport|season|age'));
check('still varies on the session cookie', vary.includes('cookie=sb-access-token'));

// Pages without filters keep one entry per path, so tracking params
// (fbclid, utm_*) don't fragment the cache.
const plain = new Headers();
setPublicCache(plain);
check('no query vary by default', !(plain.get('Netlify-Vary') ?? '').includes('query'));
check(
  'default still varies on the session cookie',
  plain.get('Netlify-Vary') === 'cookie=sb-access-token'
);

if (failures > 0) {
  console.log(`\n❌ ${failures} test(s) failed`);
  process.exit(1);
}
console.log('\n✅ All cache-vary tests passed');
