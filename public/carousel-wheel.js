/**
 * Turns sideways wheel input (two-finger trackpad swipes, horizontal mouse
 * wheels) into one-slide carousel moves. Vertical scrolling is ignored so the
 * page still scrolls. After a move, the rest of that swipe — including the
 * inertia events a trackpad keeps sending — is swallowed until the input goes
 * quiet, so one swipe moves one slide.
 */

/** Sideways travel (px) that counts as a swipe. */
const SWIPE_DISTANCE = 40;
/** Quiet time (ms) that ends a swipe and its inertia. */
const SWIPE_GAP = 200;

export function createWheelPager({ onNext, onPrev }) {
  let travel = 0;
  let locked = false;
  let lastEvent = -Infinity;

  return function handleWheel(event, now = performance.now()) {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();

    if (now - lastEvent >= SWIPE_GAP) {
      locked = false;
      travel = 0;
    }
    lastEvent = now;
    if (locked) return;

    travel += event.deltaX;
    if (Math.abs(travel) < SWIPE_DISTANCE) return;
    if (travel > 0) onNext();
    else onPrev();
    locked = true;
  };
}
