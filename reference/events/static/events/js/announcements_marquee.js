// Announcement Marquee JS: vertical scroll only if overflow, mouse wheel = speed, drag = manual scroll

document.addEventListener('DOMContentLoaded', function () {
  const marquee = document.querySelector('.announcement-marquee');
  const track = marquee?.querySelector('.announcement-marquee__track');
  if (!marquee || !track) return;

  let animationFrame;
  let speed = 1; // px per frame
  let direction = -1; // -1 = up, 1 = down
  let isHovered = false;
  let isDragging = false;
  let startY = 0;
  let startScroll = 0;
  let autoScroll = false;
  let currentY = 0;
  let manualScrollTimeout;
  const DEFAULT_SPEED = 1;

  // Check if content overflows
  function checkOverflow() {
    // track.scrollHeight is total content, marquee.clientHeight is visible
    autoScroll = track.scrollHeight > marquee.clientHeight + 2; // allow for rounding
    if (!autoScroll) {
      track.style.transform = 'translateY(0)';
      cancelAnimationFrame(animationFrame);
    } else {
      startMarquee();
    }
  }

  // Calculate the height of the first set for seamless looping
  function getFirstSetHeight() {
    const items = track.querySelectorAll('.announcement-marquee__item');
    if (!items.length) return 0;
    const half = Math.floor(items.length / 2);
    let height = 0;
    for (let i = 0; i < half; i++) {
      height +=
        items[i].offsetHeight +
        parseFloat(getComputedStyle(items[i]).marginTop) +
        parseFloat(getComputedStyle(items[i]).marginBottom);
    }
    return height;
  }

  // Animate marquee
  function animate() {
    if (!autoScroll || isHovered || isDragging) return;
    currentY += speed * direction;
    const firstSetHeight = getFirstSetHeight();
    if (firstSetHeight > marquee.clientHeight) {
      if (currentY <= -firstSetHeight) currentY = 0;
      if (currentY > 0) currentY = -firstSetHeight;
      track.style.transform = `translateY(${currentY}px)`;
    } else {
      currentY = 0;
      track.style.transform = `translateY(0)`;
    }
    animationFrame = requestAnimationFrame(animate);
  }

  function startMarquee() {
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(animate);
  }

  // Mouse wheel: scroll marquee manually and pause auto-scroll
  marquee.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const firstSetHeight = getFirstSetHeight();
      currentY -= e.deltaY;
      if (firstSetHeight > marquee.clientHeight) {
        if (currentY <= -firstSetHeight) currentY = 0;
        if (currentY > 0) currentY = -firstSetHeight;
        track.style.transform = `translateY(${currentY}px)`;
      } else {
        currentY = 0;
        track.style.transform = `translateY(0)`;
      }
      speed = DEFAULT_SPEED;
      cancelAnimationFrame(animationFrame);
      clearTimeout(manualScrollTimeout);
      manualScrollTimeout = setTimeout(() => {
        if (!isHovered && !isDragging) startMarquee();
      }, 1500);
    },
    { passive: false }
  );

  // Drag to scroll
  marquee.addEventListener('mousedown', (e) => {
    isDragging = true;
    startY = e.clientY;
    startScroll = currentY;
    marquee.classList.add('dragging');
    document.body.style.userSelect = 'none';
    marquee.querySelectorAll('a').forEach((a) => (a.style.pointerEvents = 'none'));
    // Pause auto-scroll and reset speed
    speed = DEFAULT_SPEED;
    cancelAnimationFrame(animationFrame);
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const delta = e.clientY - startY;
    const firstSetHeight = getFirstSetHeight();
    currentY = startScroll + delta;
    if (firstSetHeight > marquee.clientHeight) {
      if (currentY <= -firstSetHeight) currentY = 0;
      if (currentY > 0) currentY = -firstSetHeight;
      track.style.transform = `translateY(${currentY}px)`;
    } else {
      currentY = 0;
      track.style.transform = `translateY(0)`;
    }
  });
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      marquee.classList.remove('dragging');
      document.body.style.userSelect = '';
      marquee.querySelectorAll('a').forEach((a) => (a.style.pointerEvents = ''));
      clearTimeout(manualScrollTimeout);
      manualScrollTimeout = setTimeout(() => {
        if (!isHovered && !isDragging) startMarquee();
      }, 1500);
    }
  });

  // Pause only auto-scroll on hover, but allow manual scroll
  marquee.addEventListener('mouseenter', () => {
    isHovered = true;
    cancelAnimationFrame(animationFrame);
  });
  marquee.addEventListener('mouseleave', () => {
    isHovered = false;
    if (autoScroll && !isDragging) startMarquee();
  });

  // On resize, re-check overflow
  window.addEventListener('resize', checkOverflow);
  checkOverflow();
});
