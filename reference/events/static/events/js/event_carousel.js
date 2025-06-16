document.addEventListener('DOMContentLoaded', function () {
  const carousels = document.querySelectorAll('.event-carousel');

  if (!carousels.length) return; // No carousels present, exit early

  carousels.forEach((carousel) => {
    const container = carousel.querySelector('.event-carousel__inner');
    if (!container) return; // Defensive: skip if no container
    let isScrolling = false;
    let startX;
    let scrollLeft;
    let touchStartX;

    // Keyboard navigation
    document.addEventListener('keydown', function (e) {
      if (!isScrolling && carousel.querySelector('.event-carousel__item')) {
        const cardWidth = carousel.querySelector('.event-carousel__item').offsetWidth;
        if (e.key === 'ArrowLeft') {
          smoothScroll(container, -cardWidth);
        } else if (e.key === 'ArrowRight') {
          smoothScroll(container, cardWidth);
        }
      }
    });

    // Mouse drag scrolling
    carousel.addEventListener('mousedown', (e) => {
      isScrolling = true;
      startX = e.pageX - carousel.offsetLeft;
      scrollLeft = container.scrollLeft;
    });

    carousel.addEventListener('mouseleave', () => {
      isScrolling = false;
    });

    carousel.addEventListener('mouseup', () => {
      isScrolling = false;
    });

    carousel.addEventListener('mousemove', (e) => {
      if (!isScrolling) return;
      e.preventDefault();
      const x = e.pageX - carousel.offsetLeft;
      const walk = (x - startX) * 2;
      container.scrollLeft = scrollLeft - walk;
    });

    // Touch events
    carousel.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      startX = e.touches[0].clientX - carousel.offsetLeft;
      scrollLeft = container.scrollLeft;
    });

    carousel.addEventListener('touchmove', (e) => {
      if (!touchStartX) return;
      const touchCurrentX = e.touches[0].clientX;
      const walk = (touchCurrentX - startX) * 2;
      container.scrollLeft = scrollLeft - walk;
    });

    carousel.addEventListener('touchend', () => {
      touchStartX = null;
    });

    // Arrow controls
    const prevBtn = carousel.querySelector('.event-carousel__control--prev');
    const nextBtn = carousel.querySelector('.event-carousel__control--next');

    if (prevBtn && nextBtn && carousel.querySelector('.event-carousel__item')) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const cardWidth = carousel.querySelector('.event-carousel__item').offsetWidth;
        smoothScroll(container, -cardWidth);
      });

      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const cardWidth = carousel.querySelector('.event-carousel__item').offsetWidth;
        smoothScroll(container, cardWidth);
      });
    }

    // Smooth scrolling function
    function smoothScroll(element, amount) {
      const start = element.scrollLeft;
      const target = start + amount;
      const duration = 300; // ms
      const startTime = performance.now();

      function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function
        const easeInOutCubic = (progress) => {
          return progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        };

        element.scrollLeft = start + (target - start) * easeInOutCubic(progress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      }

      requestAnimationFrame(animate);
    }

    // Handle scroll wrapping
    container.addEventListener('scroll', () => {
      if (container.scrollLeft === 0) {
        // At the start, check if we should wrap to the end
        const lastCard = container.lastElementChild;
        if (lastCard) {
          container.scrollLeft = container.scrollWidth;
        }
      } else if (
        Math.abs(container.scrollLeft + container.clientWidth - container.scrollWidth) < 1
      ) {
        // At the end, check if we should wrap to the start
        container.scrollLeft = 0;
      }
    });
  });
});
