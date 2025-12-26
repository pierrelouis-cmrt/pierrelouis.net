const swiper = new Swiper(".swiper", {
  touchEventsTarget: "container",
  grabCursor: true,
  slideToClickedSlide: true,
  centeredSlides: true,
  loop: true,
  mousewheel: {
    forceToAxis: true,
  },
  pagination: {
    el: ".swiper-pagination",
    clickable: false,
    renderBullet: function () {
      return "";
    },
  },
  breakpoints: {
    320: { slidesPerView: 1.5, spaceBetween: 15 },
    768: { slidesPerView: 2.5, spaceBetween: 20 },
    1200: { slidesPerView: 3.5, spaceBetween: 25 },
  },
});

// Simple pagination system
const totalSlides = swiper.slides.length;
const paginationEl = document.querySelector(".swiper-pagination");

function createSimplePagination() {
  paginationEl.innerHTML = `
    <div class="pagination-viewport">
      <div class="pagination-container"></div>
    </div>
  `;

  const dotsContainer = paginationEl.querySelector(".pagination-container");

  // Create exactly totalSlides dots
  for (let i = 0; i < totalSlides; i++) {
    const dot = document.createElement("div");
    dot.className = "pagination-indicator";
    dot.addEventListener("click", () => swiper.slideToLoop(i));
    dotsContainer.appendChild(dot);
  }
}

function updateSimplePagination(activeIndex) {
  const dotsContainer = paginationEl.querySelector(".pagination-container");
  const dots = dotsContainer.querySelectorAll(".pagination-indicator");
  const viewport = paginationEl.querySelector(".pagination-viewport");

  // Calculate position to center active dot in viewport
  const dotSpacing = 24; // 8px + 16px gap
  const viewportWidth = parseInt(
    getComputedStyle(viewport).getPropertyValue("--viewport-width")
  );
  const viewportCenter = viewportWidth / 2;
  const offset = viewportCenter - activeIndex * dotSpacing - 4; // -4 to center the dot

  dotsContainer.style.transform = `translateX(${offset}px)`;

  // Update active states
  dots.forEach((dot, index) => {
    dot.className = "pagination-indicator";

    if (index === activeIndex) {
      dot.classList.add("active");
    }

    // Add edge styling for dots near viewport edges
    const dotPosition = offset + index * dotSpacing;
    const fadeZone = 25; // Distance from edge where fading starts
    if (dotPosition < fadeZone || dotPosition > viewportWidth - fadeZone) {
      dot.classList.add("edge");
    }
  });
}

// Initialize
createSimplePagination();
updateSimplePagination(0);

// Update on slide change
swiper.on("slideChange", function () {
  updateSimplePagination(swiper.realIndex);
});
