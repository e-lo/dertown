/**
 * Netlify Image CDN URLs.
 *
 * Regression: we always sent `fit=cover`. With only a width, Netlify crops to
 * that width but keeps the source height, so a 5472×3648 photo came back as a
 * 640×3648 sliver and every view zoomed into the middle of it.
 */
import { imageCdnUrl } from '../image';

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  console.log(
    pass
      ? `✅ PASS: ${name}`
      : `❌ FAIL: ${name}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}`
  );
}

const params = (url: string) => Object.fromEntries(new URL(url, 'https://x').searchParams);
const SRC = 'https://example.com/a.jpg';

console.log('🧪 image CDN URL\n');

check(
  'width only: no fit, so the image is scaled not cropped',
  params(imageCdnUrl(SRC, { width: 640 })),
  {
    url: SRC,
    w: '640',
    q: '75',
  }
);
check('width + height: defaults to cover', params(imageCdnUrl(SRC, { width: 600, height: 400 })), {
  url: SRC,
  w: '600',
  h: '400',
  fit: 'cover',
  q: '75',
});
check(
  'width + height + contain',
  params(imageCdnUrl(SRC, { width: 600, height: 400, fit: 'contain' })),
  { url: SRC, w: '600', h: '400', fit: 'contain', q: '75' }
);
check('quality override', params(imageCdnUrl(SRC, { width: 40, quality: 40 })).q, '40');
check('path', imageCdnUrl(SRC, { width: 640 }).startsWith('/.netlify/images?'), true);

console.log(failures === 0 ? '\nAll image CDN URL tests passed' : `\n${failures} failing`);
process.exit(failures === 0 ? 0 : 1);
