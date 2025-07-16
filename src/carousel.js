const swiper = new Swiper(".swiper", {
  // Make dragging work even when grabbing empty space between slides
  touchEventsTarget: "container",

  // Existing options
  grabCursor: true,
  slideToClickedSlide: true,
  centeredSlides: true,
  loop: true,
  mousewheel: {
    forceToAxis: true,
  },
  pagination: {
    el: ".swiper-pagination",
    clickable: true,
  },
  breakpoints: {
    320: { slidesPerView: 1.5, spaceBetween: 15 },
    768: { slidesPerView: 2.5, spaceBetween: 20 },
    1200: { slidesPerView: 3.5, spaceBetween: 25 },
  },
});
