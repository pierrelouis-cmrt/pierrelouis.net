(() => {
  const page = document.querySelector(".case-study-page");
  const revealItems = document.querySelectorAll(
    [
      ".case-study-header",
      ".case-study-media",
      ".case-study-related__heading",
      ".case-study-related__all",
      ".case-study-related__item",
    ].join(", "),
  );

  if (!page || revealItems.length === 0) {
    return;
  }

  page.classList.add("has-case-study-reveal-motion");

  if (
    !("IntersectionObserver" in window) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    revealItems.forEach((item) => item.classList.add("is-reveal-visible"));
    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-reveal-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -7% 0px",
      threshold: 0.08,
    },
  );

  revealItems.forEach((item) => revealObserver.observe(item));
})();
