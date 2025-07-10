document.addEventListener('DOMContentLoaded', function() {
  const gliderEl = document.querySelector('.glider');
  if (!gliderEl) return;
  function initGlider() {
    if (gliderEl && typeof window.Glider !== 'undefined' && !gliderEl.__glider) {
      gliderEl.__glider = new window.Glider(gliderEl, {
        slidesToShow: 'auto',
        itemWidth: 300,
        slidesToScroll: 1,
        draggable: true,
        arrows: {
          prev: '.glider-prev',
          next: '.glider-next'
        },
        responsive: [
          {
            breakpoint: 640,
            settings: {
              slidesToShow: 1,
              slidesToScroll: 1,
              itemWidth: 300
            }
          },
          {
            breakpoint: 1024,
            settings: {
              slidesToShow: 2,
              slidesToScroll: 1,
              itemWidth: 300
            }
          },
          {
            breakpoint: 1280,
            settings: {
              slidesToShow: 3,
              slidesToScroll: 1,
              itemWidth: 300
            }
          }
        ]
      });
    }
  }
  if (typeof window.Glider === 'undefined') {
    const checkGlider = setInterval(() => {
      if (typeof window.Glider !== 'undefined') {
        clearInterval(checkGlider);
        initGlider();
      }
    }, 100);
    setTimeout(() => {
      clearInterval(checkGlider);
    }, 5000);
  } else {
    initGlider();
  }
}); 