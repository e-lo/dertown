/**
 * Two-finger trackpad swipes (and sideways mouse wheels) page the homepage
 * carousel: one slide per swipe, ignoring vertical page scrolling and the
 * trailing inertia events a trackpad keeps sending after the fingers lift.
 */
import { createWheelPager } from '../../../public/carousel-wheel.js';

let failures = 0;
function check(label: string, ok: boolean) {
  console.log(ok ? `✅ PASS: ${label}` : `❌ FAIL: ${label}`);
  if (!ok) failures++;
}

console.log('🧪 Carousel wheel paging\n');

function setup() {
  const calls: string[] = [];
  const handle = createWheelPager({
    onNext: () => calls.push('next'),
    onPrev: () => calls.push('prev'),
  });
  let prevented = 0;
  const wheel = (deltaX: number, deltaY: number, now: number) =>
    handle({ deltaX, deltaY, preventDefault: () => prevented++ }, now);
  return { calls, wheel, prevented: () => prevented };
}

{
  const { calls, wheel } = setup();
  wheel(30, 0, 0);
  wheel(30, 0, 16);
  check('a sideways swipe to the left moves to the next slide', calls.join() === 'next');
}

{
  const { calls, wheel } = setup();
  wheel(-60, 0, 0);
  check('a sideways swipe to the right moves to the previous slide', calls.join() === 'prev');
}

{
  const { calls, wheel, prevented } = setup();
  wheel(5, 80, 0);
  wheel(5, 80, 16);
  check('vertical scrolling leaves the carousel alone', calls.length === 0);
  check('vertical scrolling still scrolls the page', prevented() === 0);
}

{
  const { calls, wheel } = setup();
  for (let t = 0; t <= 300; t += 16) wheel(40, 0, t);
  check('one swipe with trailing inertia moves only one slide', calls.join() === 'next');
  wheel(60, 0, 1000);
  check('a later, separate swipe moves again', calls.join() === 'next,next');
}

{
  const { wheel, prevented } = setup();
  wheel(30, 0, 0);
  check('sideways swipes over the carousel do not trigger browser back/forward', prevented() === 1);
}

console.log(
  failures === 0 ? '\n✅ All carousel wheel tests passed' : `\n❌ ${failures} failure(s)`
);
process.exit(failures === 0 ? 0 : 1);
