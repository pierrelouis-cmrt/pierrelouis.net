const carouselQuery = window.matchMedia("(max-width: 1100px)");
const reducedMotionQuery = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);

(() => {
  const root = document.querySelector("[data-project-filters]");

  if (!root) {
    return;
  }

  const buttons = [...root.querySelectorAll("[data-project-filter]")];
  const projects = [...document.querySelectorAll("[data-project-category]")];
  const sections = [...document.querySelectorAll("[data-project-section]")];
  let activeFilter = "all";

  const update = () => {
    for (const project of projects) {
      project.hidden =
        activeFilter !== "all" &&
        project.dataset.projectCategory !== activeFilter;
    }

    for (const section of sections) {
      section.hidden = !section.querySelector(
        "[data-project-category]:not([hidden])",
      );
    }

    for (const button of buttons) {
      const isActive = button.dataset.projectFilter === activeFilter;
      const count = button.querySelector("[data-filter-count]");

      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));

      if (count) {
        count.hidden = !isActive;
      }
    }
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.projectFilter || "all";
      update();
    });
  }

  update();
})();

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

(() => {
  const page = document.body;
  const stage = document.querySelector(".site-shell");
  const triggers = Array.from(
    document.querySelectorAll("[data-playground-sheet-open]"),
  );
  const randomTrigger = document.querySelector(
    "[data-playground-sheet-random]",
  );
  const sheetElements = Array.from(
    document.querySelectorAll("[data-playground-sheet]"),
  );

  if (!page?.classList.contains("projects-page") || !stage || !sheetElements.length) {
    return;
  }

  const sheets = new Map();
  const closeDuration = 420;
  const projectsPath = new URL("./", window.location.href).pathname;
  let activeSheet = null;
  let activeSlug = null;
  let activeTrigger = null;
  let isClosing = false;
  let pendingCloseDragY = null;
  let pendingSlug = null;

  sheetElements.forEach((sheet) => {
    sheets.set(sheet.dataset.playgroundSheet, sheet);
    document.body.append(sheet);
  });

  const slugFromLocation = () => {
    if (!window.location.pathname.startsWith(projectsPath)) {
      return null;
    }

    const relativePath = window.location.pathname
      .slice(projectsPath.length)
      .replace(/^\/+|\/+$/g, "");
    const slug = decodeURIComponent(relativePath);

    return !slug.includes("/") && sheets.has(slug) ? slug : null;
  };

  const sheetUrl = (slug) => {
    const url = new URL(window.location.href);
    return `${projectsPath}${encodeURIComponent(slug)}/${url.search}`;
  };

  const pageUrl = () => {
    const url = new URL(window.location.href);
    return `${projectsPath}${url.search}`;
  };

  const showDialog = (sheet) => {
    if (typeof sheet.showModal === "function") {
      sheet.showModal();
      return;
    }

    sheet.setAttribute("open", "");
  };

  const closeDialog = (sheet) => {
    if (typeof sheet.close === "function" && sheet.open) {
      sheet.close();
      return;
    }

    sheet.removeAttribute("open");
  };

  const clearStageDragStyles = () => {
    stage.style.removeProperty("transform");
    stage.style.removeProperty("filter");
    stage.style.removeProperty("border-radius");
  };

  const setStageProgress = (progress) => {
    const clampedProgress = Math.min(Math.max(progress, 0), 1);
    const scale = 1 - clampedProgress * 0.05;
    const translate = clampedProgress * 10;
    const saturation = 1 - clampedProgress * 0.6;
    const brightness = 1 - clampedProgress * 0.3;

    stage.style.transform = `translateY(${translate}px) scale(${scale})`;
    stage.style.filter =
      `saturate(${saturation}) brightness(${brightness})`;
    const radius = clampedProgress * 24;
    stage.style.borderRadius = `${radius}px ${radius}px 0 0`;
  };

  const finalizeClose = (sheet, { restoreFocus = true } = {}) => {
    closeDialog(sheet);
    sheet.classList.remove("is-open", "is-closing", "is-dragging");
    sheet.style.removeProperty("transform");
    page.classList.remove(
      "has-playground-sheet-open",
      "is-playground-sheet-closing",
      "is-playground-sheet-dragging",
    );
    clearStageDragStyles();

    const triggerToRestore = activeTrigger;
    activeSheet = null;
    activeSlug = null;
    activeTrigger = null;
    isClosing = false;
    pendingCloseDragY = null;

    if (restoreFocus && triggerToRestore?.isConnected) {
      triggerToRestore.focus({ preventScroll: true });
    }

    if (pendingSlug) {
      const nextSlug = pendingSlug;
      pendingSlug = null;
      openSheet(nextSlug, { updateHistory: false });
    }
  };

  const animateClose = ({ restoreFocus = true, dragY = null } = {}) => {
    if (!activeSheet || isClosing) {
      return;
    }

    const sheet = activeSheet;
    isClosing = true;
    page.classList.remove("is-playground-sheet-dragging");
    page.classList.add("is-playground-sheet-closing");
    sheet.classList.remove("is-dragging");
    sheet.classList.add("is-closing");

    if (dragY !== null) {
      const progress = 1 - Math.min(dragY / sheet.clientHeight, 1);
      sheet.style.transform = `translateY(${dragY}px)`;
      setStageProgress(progress);
      void sheet.offsetHeight;
    }

    let closeTimer;
    const finish = () => {
      window.clearTimeout(closeTimer);
      sheet.removeEventListener("transitionend", onTransitionEnd);
      finalizeClose(sheet, { restoreFocus });
    };
    const onTransitionEnd = (event) => {
      if (event.target === sheet && event.propertyName === "transform") {
        finish();
      }
    };

    sheet.addEventListener("transitionend", onTransitionEnd);

    window.requestAnimationFrame(() => {
      page.classList.remove("has-playground-sheet-open");
      sheet.classList.remove("is-open");
      sheet.style.transform = "translateY(100vh)";

      if (dragY !== null) {
        setStageProgress(0);
      }
    });

    closeTimer = window.setTimeout(
      finish,
      reducedMotionQuery.matches ? 30 : closeDuration + 120,
    );
  };

  const requestClose = ({ dragY = null } = {}) => {
    if (!activeSheet || isClosing) {
      return;
    }

    pendingCloseDragY = dragY;

    if (
      window.history.state?.playgroundSheet === activeSlug &&
      slugFromLocation() === activeSlug
    ) {
      window.history.back();
      return;
    }

    window.history.replaceState(
      { ...window.history.state, playgroundSheet: null },
      "",
      pageUrl(),
    );
    animateClose({ dragY });
  };

  const openSheet = (
    slug,
    { updateHistory = true, trigger = null } = {},
  ) => {
    const sheet = sheets.get(slug);

    if (!sheet) {
      return;
    }

    if (activeSheet === sheet && !isClosing) {
      return;
    }

    if (activeSheet) {
      pendingSlug = slug;
      animateClose({ restoreFocus: false });
      return;
    }

    activeSheet = sheet;
    activeSlug = slug;
    activeTrigger = trigger;
    isClosing = false;
    sheet.querySelector(".playground-sheet__surface")?.scrollTo({
      top: 0,
      behavior: "auto",
    });
    showDialog(sheet);
    page.classList.add("has-playground-sheet-open");

    if (updateHistory) {
      window.history.pushState(
        { ...window.history.state, playgroundSheet: slug },
        "",
        sheetUrl(slug),
      );
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        sheet.classList.add("is-open");
        sheet.focus({ preventScroll: true });
      });
    });

  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      openSheet(trigger.dataset.playgroundSheetOpen, { trigger });
    });
  });

  randomTrigger?.addEventListener("click", () => {
    const slugs = [...sheets.keys()];
    const slug = slugs[Math.floor(Math.random() * slugs.length)];

    openSheet(slug, { trigger: randomTrigger });
  });

  sheets.forEach((sheet) => {
    sheet
      .querySelector("[data-playground-sheet-close]")
      ?.addEventListener("click", () => requestClose());

    sheet.addEventListener("cancel", (event) => {
      event.preventDefault();
      requestClose();
    });

    const handle = sheet.querySelector("[data-playground-sheet-handle]");

    if (!handle) {
      return;
    }

    let dragStartY = 0;
    let dragStartTime = 0;
    let dragY = 0;
    let dragging = false;
    let suppressHandleClick = false;

    const finishDrag = (event) => {
      if (!dragging) {
        return;
      }

      dragging = false;

      if (handle.hasPointerCapture?.(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }

      const elapsed = Math.max(performance.now() - dragStartTime, 1);
      const velocity = dragY / elapsed;
      const shouldClose =
        dragY > sheet.clientHeight * 0.18 || velocity > 0.7;

      page.classList.remove("is-playground-sheet-dragging");
      sheet.classList.remove("is-dragging");

      if (shouldClose) {
        requestClose({ dragY });
        return;
      }

      page.classList.add("is-playground-sheet-closing");
      sheet.classList.add("is-closing");
      sheet.style.transform = "translateY(0)";
      setStageProgress(1);

      const clearSnapStyles = () => {
        page.classList.remove("is-playground-sheet-closing");
        sheet.classList.remove("is-closing");
        sheet.style.removeProperty("transform");
        clearStageDragStyles();
      };

      sheet.addEventListener("transitionend", clearSnapStyles, { once: true });
      window.setTimeout(
        clearSnapStyles,
        reducedMotionQuery.matches ? 30 : closeDuration + 120,
      );
    };

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || isClosing) {
        return;
      }

      dragging = true;
      dragStartY = event.clientY;
      dragStartTime = performance.now();
      dragY = 0;
      suppressHandleClick = false;
      handle.setPointerCapture?.(event.pointerId);
      page.classList.add("is-playground-sheet-dragging");
      sheet.classList.add("is-dragging");
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragging) {
        return;
      }

      dragY = Math.max(event.clientY - dragStartY, 0);
      suppressHandleClick ||= dragY > 6;
      const progress = 1 - Math.min(dragY / sheet.clientHeight, 1);
      sheet.style.transform = `translateY(${dragY}px)`;
      setStageProgress(progress);
    });

    handle.addEventListener("click", (event) => {
      if (suppressHandleClick) {
        event.preventDefault();
        suppressHandleClick = false;
        return;
      }

      requestClose();
    });

    handle.addEventListener("pointerup", finishDrag);
    handle.addEventListener("pointercancel", finishDrag);
    handle.addEventListener("lostpointercapture", finishDrag);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
  });

  window.addEventListener("popstate", () => {
    const nextSlug = slugFromLocation();

    if (nextSlug) {
      if (activeSlug === nextSlug && !isClosing) {
        return;
      }

      openSheet(nextSlug, { updateHistory: false });
      return;
    }

    if (activeSheet) {
      animateClose({ dragY: pendingCloseDragY });
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeSheet && !isClosing) {
      event.preventDefault();
      requestClose();
    }
  });

  const initialSlug = slugFromLocation();

  if (initialSlug) {
    openSheet(initialSlug, { updateHistory: false });
  }
})();
