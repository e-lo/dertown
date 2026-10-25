/**
 * Featured events are marked with a star, not a "Featured" text pill, and the
 * star still says "Featured event" to screen readers and on hover.
 */
import { readFileSync } from 'node:fs';

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(ok ? `✅ PASS: ${label}` : `❌ FAIL: ${label}`);
  if (!ok) failures++;
}

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

console.log('🧪 Featured star\n');

const carousel = read('src/components/EventCarouselCard.astro');
check('carousel cards drop the Featured text pill', !/variant="featured"/.test(carousel));
check('carousel cards show the featured star', carousel.includes('<FeaturedStar'));

const star = read('src/components/ui/FeaturedStar.astro');
check('the star is labelled for screen readers', star.includes('aria-label="Featured event"'));
check('the star explains itself on hover', star.includes('title="Featured event"'));
check('the star uses the season highlight color', star.includes('var(--color-secondary)'));

console.log(
  failures === 0 ? '\n✅ All featured star checks passed' : `\n❌ ${failures} failure(s)`
);
process.exit(failures === 0 ? 0 : 1);
