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
  const projects = [...document.querySelectorAll("[data-project-tags]")];
  const sections = [...document.querySelectorAll("[data-project-section]")];
  let activeFilter = "all";

  const update = () => {
    for (const project of projects) {
      const tags = project.dataset.projectTags?.split(/\s+/) || [];

      project.hidden =
        activeFilter !== "all" && !tags.includes(activeFilter);
    }

    for (const section of sections) {
      section.hidden = !section.querySelector(
        "[data-project-tags]:not([hidden])",
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

document.querySelectorAll("[data-project-gallery]").forEach((gallery) => {
  const viewport = gallery.querySelector("[data-project-gallery-viewport]");

  if (!viewport) {
    return;
  }

  let dragStartX = 0;
  let dragStartScroll = 0;
  let didDrag = false;

  viewport.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    viewport.scrollBy({
      left: viewport.clientWidth * 0.75 * direction,
      behavior: reducedMotionQuery.matches ? "auto" : "smooth",
    });
  });

  viewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) {
      return;
    }

    dragStartX = event.clientX;
    dragStartScroll = viewport.scrollLeft;
    didDrag = false;
    viewport.classList.add("is-dragging");
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!viewport.classList.contains("is-dragging")) {
      return;
    }

    const dragDistance = event.clientX - dragStartX;

    if (Math.abs(dragDistance) > 4) {
      didDrag = true;

      if (!viewport.hasPointerCapture(event.pointerId)) {
        viewport.setPointerCapture(event.pointerId);
      }
    }

    viewport.scrollLeft = dragStartScroll - dragDistance;
  });

  const endDrag = (event) => {
    if (!viewport.classList.contains("is-dragging")) {
      return;
    }

    viewport.classList.remove("is-dragging");

    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }

    window.setTimeout(() => {
      didDrag = false;
    }, 0);
  };

  viewport.addEventListener(
    "click",
    (event) => {
      if (!didDrag) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );

  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
});

const interactiveFrameSync = new WeakMap();

document.querySelectorAll(".project-interactive__frame").forEach((frame) => {
  let resizeObserver = null;
  let syncFrame = 0;

  const syncHeight = () => {
    syncFrame = 0;

    try {
      const frameDocument = frame.contentDocument;
      const frameBody = frameDocument?.body;
      const frameRoot = frameDocument?.documentElement;

      if (!frameBody || !frameRoot) {
        return;
      }

      const contentHeight = Math.ceil(
        Math.max(
          frameBody.offsetHeight,
          frameBody.scrollHeight,
          frameRoot.offsetHeight,
          frameRoot.scrollHeight,
        ),
      );

      if (contentHeight > 0 && frame.offsetHeight !== contentHeight) {
        frame.style.height = `${contentHeight}px`;
      }
    } catch {
      // Interactive project sources are validated as same-site at build time.
    }
  };

  const requestHeightSync = () => {
    window.cancelAnimationFrame(syncFrame);
    syncFrame = window.requestAnimationFrame(syncHeight);
  };

  const observeContent = () => {
    resizeObserver?.disconnect();

    try {
      const frameDocument = frame.contentDocument;

      if (!frameDocument?.documentElement || !frameDocument.body) {
        return;
      }

      resizeObserver = new ResizeObserver(requestHeightSync);
      resizeObserver.observe(frameDocument.documentElement);
      resizeObserver.observe(frameDocument.body);
      requestHeightSync();
    } catch {
      // Leave the CSS fallback height in place if access is unavailable.
    }
  };

  interactiveFrameSync.set(frame, requestHeightSync);
  frame.addEventListener("load", observeContent);

  if (frame.contentDocument?.readyState === "complete") {
    observeContent();
  }
});

const resizeProjectInteractiveFrames = (root = document) => {
  root.querySelectorAll(".project-interactive__frame").forEach((frame) => {
    interactiveFrameSync.get(frame)?.();
  });
};

window.addEventListener(
  "resize",
  () => resizeProjectInteractiveFrames(),
  { passive: true },
);

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
  const root = document.documentElement;
  const sheetBackgroundColor = "#f8f8f7";
  const closeDuration = 420;
  let activeSheet = null;
  let activeSlug = null;
  let activeTrigger = null;
  let isClosing = false;
  let pendingCloseDragY = null;
  let pendingSlug = null;
  const existingThemeColor = document.querySelector(
    'meta[name="theme-color"]',
  );
  const defaultThemeColor = existingThemeColor?.content ?? null;
  const defaultRootBackgroundColor = root.style.backgroundColor;
  let themeColor = existingThemeColor;

  const setSheetThemeColor = () => {
    root.style.backgroundColor = sheetBackgroundColor;

    if (!themeColor) {
      themeColor = document.createElement("meta");
      themeColor.name = "theme-color";
      document.head.append(themeColor);
    }

    themeColor.content = sheetBackgroundColor;
  };

  const restoreThemeColor = () => {
    if (defaultRootBackgroundColor) {
      root.style.backgroundColor = defaultRootBackgroundColor;
    } else {
      root.style.removeProperty("background-color");
    }

    if (!themeColor) {
      return;
    }

    if (defaultThemeColor === null) {
      themeColor.remove();
      themeColor = null;
      return;
    }

    themeColor.content = defaultThemeColor;
  };

  sheetElements.forEach((sheet) => {
    sheets.set(sheet.dataset.playgroundSheet, sheet);
    document.body.append(sheet);
  });

  const sheetSlugFromUrl = () => {
    const slug = new URL(window.location.href).searchParams.get("sheet");

    return slug && sheets.has(slug) ? slug : null;
  };

  const urlWithSheet = (slug) => {
    const url = new URL(window.location.href);
    url.searchParams.set("sheet", slug);

    return `${url.pathname}${url.search}${url.hash}`;
  };

  const urlWithoutSheet = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("sheet");

    return `${url.pathname}${url.search}${url.hash}`;
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
    sheet.style.removeProperty("transition-duration");
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

    if (!pendingSlug) {
      restoreThemeColor();
    }

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
      sheetSlugFromUrl() === activeSlug
    ) {
      window.history.back();
      return;
    }

    window.history.replaceState(
      { ...window.history.state, playgroundSheet: null },
      "",
      urlWithoutSheet(),
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
    setSheetThemeColor();
    showDialog(sheet);
    page.classList.add("has-playground-sheet-open");

    if (updateHistory) {
      window.history.pushState(
        { ...window.history.state, playgroundSheet: slug },
        "",
        urlWithSheet(slug),
      );
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        sheet.classList.add("is-open");
        resizeProjectInteractiveFrames(sheet);
        sheet.focus({ preventScroll: true });
      });
    });
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
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

    // Keep the grab area outside the scrolling surface so iOS rubber-band
    // overscroll cannot pull the handle away from the sheet edge.
    sheet.prepend(handle);

    let dragStartY = 0;
    let dragY = 0;
    let dragging = false;
    let suppressHandleClick = false;
    let dragSamples = [];

    const recordDragSample = (clientY) => {
      const now = performance.now();
      dragSamples.push({ time: now, y: clientY });
      dragSamples = dragSamples.filter((sample) => now - sample.time <= 100);
    };

    const recentVelocity = () => {
      if (dragSamples.length < 2) {
        return 0;
      }

      const first = dragSamples[0];
    const last = dragSamples[dragSamples.length - 1];
      return (last.y - first.y) / Math.max(last.time - first.time, 1);
    };

    const finishDrag = (event) => {
      if (!dragging) {
        return;
      }

      if (Number.isFinite(event.clientY)) {
        recordDragSample(event.clientY);
      }

      dragging = false;

      if (handle.hasPointerCapture?.(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }

      const velocity = Math.max(recentVelocity(), 0);
      const shouldClose =
        dragY > Math.min(sheet.clientHeight * 0.14, 120) ||
        (dragY > 18 && velocity > 0.45);

      page.classList.remove("is-playground-sheet-dragging");
      sheet.classList.remove("is-dragging");

      if (shouldClose) {
        const remainingDistance = Math.max(sheet.clientHeight - dragY, 0);
        const momentumDuration = remainingDistance / Math.max(velocity, 0.8);
        sheet.style.transitionDuration = `${Math.round(
          Math.min(closeDuration, Math.max(180, momentumDuration)),
        )}ms`;
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
      dragY = 0;
      suppressHandleClick = false;
      dragSamples = [];
      recordDragSample(event.clientY);
      handle.setPointerCapture?.(event.pointerId);
      page.classList.add("is-playground-sheet-dragging");
      sheet.classList.add("is-dragging");
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragging) {
        return;
      }

      dragY = Math.max(event.clientY - dragStartY, 0);
      recordDragSample(event.clientY);
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
    const nextSlug = sheetSlugFromUrl();

    if (nextSlug && sheets.has(nextSlug)) {
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

  const initialSlug = sheetSlugFromUrl();

  if (initialSlug && sheets.has(initialSlug)) {
    openSheet(initialSlug, { updateHistory: false });
  }
})();
