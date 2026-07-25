const carouselQuery = window.matchMedia("(max-width: 1100px)");
const reducedMotionQuery = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);

document.querySelectorAll("[data-project-carousel]").forEach((carousel) => {
  const track = carousel.querySelector("[data-project-carousel-track]");
  const items = Array.from(
    track?.querySelectorAll(".featured-project__item") || [],
  );
  const previousButton = carousel.querySelector("[data-project-carousel-prev]");
  const nextButton = carousel.querySelector("[data-project-carousel-next]");
  const status = carousel.querySelector("[data-project-carousel-status]");

  if (
    !track ||
    items.length === 0 ||
    !previousButton ||
    !nextButton ||
    !status
  ) {
    return;
  }

  let activeIndex = 0;
  let isTicking = false;

  const maximumScroll = () => Math.max(track.scrollWidth - track.clientWidth, 0);

  const itemScrollLeft = (item) => {
    const itemCenter =
      item.offsetLeft -
      track.offsetLeft +
      item.offsetWidth / 2;

    return Math.min(
      Math.max(itemCenter - track.clientWidth / 2, 0),
      maximumScroll(),
    );
  };

  const nearestItemIndex = () => {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    items.forEach((item, index) => {
      const distance = Math.abs(itemScrollLeft(item) - track.scrollLeft);

      if (distance < closestDistance) {
        closestIndex = index;
        closestDistance = distance;
      }
    });

    return closestIndex;
  };

  const updateControls = () => {
    activeIndex = carouselQuery.matches ? nearestItemIndex() : 0;
    status.textContent = `${activeIndex + 1} / ${items.length}`;
    previousButton.disabled = !carouselQuery.matches || activeIndex === 0;
    nextButton.disabled =
      !carouselQuery.matches || activeIndex === items.length - 1;
    isTicking = false;
  };

  const requestControlUpdate = () => {
    if (isTicking) {
      return;
    }

    isTicking = true;
    window.requestAnimationFrame(updateControls);
  };

  const scrollToItem = (index) => {
    const nextIndex = Math.min(Math.max(index, 0), items.length - 1);

    track.scrollTo({
      left: itemScrollLeft(items[nextIndex]),
      behavior: reducedMotionQuery.matches ? "auto" : "smooth",
    });
  };

  const syncMode = () => {
    track.tabIndex = carouselQuery.matches ? 0 : -1;

    if (!carouselQuery.matches) {
      track.scrollTo({ left: 0, behavior: "auto" });
    }

    window.requestAnimationFrame(updateControls);
  };

  previousButton.addEventListener("click", () => {
    scrollToItem(activeIndex - 1);
  });

  nextButton.addEventListener("click", () => {
    scrollToItem(activeIndex + 1);
  });

  track.addEventListener("scroll", requestControlUpdate, { passive: true });

  track.addEventListener("keydown", (event) => {
    if (!carouselQuery.matches) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollToItem(activeIndex - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollToItem(activeIndex + 1);
    }

    if (event.key === "Home") {
      event.preventDefault();
      scrollToItem(0);
    }

    if (event.key === "End") {
      event.preventDefault();
      scrollToItem(items.length - 1);
    }
  });

  if (typeof carouselQuery.addEventListener === "function") {
    carouselQuery.addEventListener("change", syncMode);
  } else {
    carouselQuery.addListener(syncMode);
  }

  window.addEventListener("resize", requestControlUpdate, { passive: true });
  syncMode();
});
