(() => {
  const root = document.querySelector("[data-post-filters]");

  if (!root) {
    return;
  }

  const buttons = [...root.querySelectorAll("[data-post-filter]")];
  const searchInput = root.querySelector("[data-post-search]");
  const emptyState = root.querySelector("[data-post-empty]");
  const posts = [...document.querySelectorAll("[data-post-type]")];
  const state = { type: "all", query: "" };

  const setupRevealMotion = () => {
    const page = document.querySelector(".posts-page");
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!page || prefersReducedMotion) {
      return;
    }

    const intro = page.querySelector(".posts-intro");
    const revealTargets = [
      ...page.querySelectorAll(".post-row, .featured-post"),
    ];
    const revealTarget = (target, delay = 0) => {
      target.style.setProperty("--post-reveal-delay", `${delay}ms`);
      target.classList.add("is-reveal-visible");
    };

    page.classList.add("has-post-reveal-motion");

    const startReveal = () => {
      intro?.classList.add("is-reveal-visible");

      if (!("IntersectionObserver" in window)) {
        revealTargets.forEach((target) => revealTarget(target));
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const visibleEntries = entries
            .filter((entry) => entry.isIntersecting)
            .sort(
              (first, second) =>
                first.boundingClientRect.top - second.boundingClientRect.top,
            );

          visibleEntries.forEach((entry, index) => {
            revealTarget(entry.target, Math.min(index, 3) * 45);
            observer.unobserve(entry.target);
          });
        },
        {
          rootMargin: "0px 0px -8% 0px",
          threshold: 0.08,
        },
      );

      revealTargets.forEach((target) => observer.observe(target));
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(startReveal);
    });
  };

  const normalize = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const update = () => {
    const counts = new Map([["all", 0]]);
    let visibleCount = 0;

    for (const post of posts) {
      const matchesType =
        state.type === "all" || post.dataset.postType === state.type;
      const matchesQuery = normalize(post.dataset.postSearch).includes(
        state.query,
      );
      const visible = matchesType && matchesQuery;

      post.hidden = !visible;
      visibleCount += Number(visible);

      if (matchesQuery) {
        const postType = post.dataset.postType || "";
        counts.set("all", (counts.get("all") || 0) + 1);
        counts.set(postType, (counts.get(postType) || 0) + 1);
      }
    }

    for (const button of buttons) {
      const filter = button.dataset.postFilter || "all";
      const active = filter === state.type;
      const count = button.querySelector("[data-filter-count]");

      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));

      if (count) {
        count.hidden = !active;
        count.textContent = counts.get(filter) || 0;
      }
    }

    if (emptyState) {
      emptyState.hidden = visibleCount !== 0;
    }
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      state.type = button.dataset.postFilter || "all";
      update();
    });
  }

  searchInput?.addEventListener("input", () => {
    state.query = normalize(searchInput.value);
    update();
  });

  update();
  setupRevealMotion();
})();
