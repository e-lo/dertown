// EmblaCarousel is loaded globally via CDN
import { createWheelPager } from '/carousel-wheel.js';

document.addEventListener('DOMContentLoaded', function () {
  const emblaNode = document.querySelector('.embla');
  const prevBtn = document.getElementById('embla-prev');
  const nextBtn = document.getElementById('embla-next');
  if (!emblaNode || typeof window.EmblaCarousel !== 'function') return;

  const embla = window.EmblaCarousel(emblaNode, {
    loop: true,
    align: 'start',
    draggable: true,
    slidesToScroll: 1,
  });

  if (prevBtn) prevBtn.addEventListener('click', () => embla.scrollPrev());
  if (nextBtn) nextBtn.addEventListener('click', () => embla.scrollNext());

  // Two-finger trackpad swipes and sideways mouse wheels page the carousel
  const handleWheel = createWheelPager({ onNext: () => embla.scrollNext(), onPrev: () => embla.scrollPrev() });
  emblaNode.addEventListener('wheel', (e) => handleWheel(e), { passive: false });

  // Keyboard navigation: left/right arrow keys
  document.addEventListener('keydown', function (e) {
    // Only trigger if carousel is in viewport
    const rect = emblaNode.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (!inView) return;
    if (e.key === 'ArrowLeft') {
      embla.scrollPrev();
    } else if (e.key === 'ArrowRight') {
      embla.scrollNext();
    }
  });
}); 