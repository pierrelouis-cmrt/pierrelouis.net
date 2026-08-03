const reducedMotionQuery = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);

const normalizeCountryName = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\b\d+x\b/gi, "")
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();

const formatMapArea = (value) =>
  `${new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    notation: "compact",
  }).format(value)} km²`;

const formatMapPercentage = (ratio) =>
  `${new Intl.NumberFormat("en", {
    maximumFractionDigits: ratio < 0.1 ? 1 : 0,
    minimumFractionDigits: ratio < 0.1 ? 1 : 0,
  }).format(ratio * 100)}%`;

const hydrateVisitedMap = async (sheet) => {
  const component = sheet.querySelector("[data-visited-map]");

  if (!component || component.dataset.mapHydrated === "true") {
    return;
  }

  component.dataset.mapHydrated = "true";

  try {
    const response = await fetch("../assets/lists/world-map.svg");

    if (!response.ok) {
      throw new Error(`Map request failed with ${response.status}`);
    }

    const documentFragment = new DOMParser().parseFromString(
      await response.text(),
      "image/svg+xml",
    );
    const map = documentFragment.documentElement;

    if (map.nodeName.toLowerCase() !== "svg") {
      throw new Error("The world map asset is not an SVG");
    }

    const paths = Array.from(map.querySelectorAll("[data-country-code]"));
    const codeByName = new Map(
      paths.map((path) => [
        normalizeCountryName(path.dataset.countryName),
        path.dataset.countryCode,
      ]),
    );
    codeByName.set("uk", "GB");

    const visitedCodes = new Set();
    sheet.querySelectorAll("[data-list-entry]").forEach((entry) => {
      const normalizedName = normalizeCountryName(entry.textContent);
      const code = codeByName.get(normalizedName);

      if (code) {
        visitedCodes.add(code);
      }
    });

    let visitedArea = 0;

    paths.forEach((path) => {
      if (!visitedCodes.has(path.dataset.countryCode)) {
        return;
      }

      const countryArea = Number(path.dataset.countryArea) || 0;
      visitedArea += countryArea;
      path.classList.add("is-visited");
    });

    const totalCountries = Number(component.dataset.totalCountries) || 195;
    const totalLandArea =
      Number(component.dataset.totalLandArea) || 148_940_000;
    const countryRatio = visitedCodes.size / totalCountries;
    const areaRatio = visitedArea / totalLandArea;
    sheet.querySelector("[data-country-status]").textContent =
      `${visitedCodes.size} of ${totalCountries} — ${formatMapPercentage(countryRatio)}`;
    sheet.querySelector("[data-area-status]").textContent =
      `${formatMapArea(visitedArea)} of ${formatMapArea(totalLandArea)} — ${formatMapPercentage(areaRatio)}`;

    map.classList.add("project-content__image", "world-map");
    component.replaceChildren(map);
    component.setAttribute("aria-busy", "false");
  } catch (error) {
    component.setAttribute("aria-busy", "false");
    component.textContent = "The map could not be drawn.";
    console.error(error);
  }
};

(() => {
  const page = document.body;
  const stage = document.querySelector(".site-shell");
  const triggers = Array.from(
    document.querySelectorAll("[data-list-sheet-open]"),
  );
  const sheetElements = Array.from(
    document.querySelectorAll("[data-list-sheet]"),
  );

  if (
    !page?.classList.contains("lists-page") ||
    !stage ||
    !sheetElements.length
  ) {
    return;
  }

  const sheets = new Map();
  const root = document.documentElement;
  const sheetBackgroundColor = "#f8f8f7";
  const triggersBySlug = new Map(
    triggers.map((trigger) => [trigger.dataset.listSheetOpen, trigger]),
  );
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

  const dispatchLifecycle = (sheet, name, detail = {}) => {
    sheet.dispatchEvent(
      new CustomEvent(`list-sheet:${name}`, {
        detail: {
          sheet,
          slug: sheet.dataset.listSheet,
          ...detail,
        },
      }),
    );
  };

  const syncEntryCount = (sheet) => {
    const counter = sheet.querySelector("[data-list-entry-count]");

    if (!counter) {
      return;
    }

    const count = sheet.querySelectorAll("[data-list-entry]").length;
    const label = `${count} ${count === 1 ? "entry" : "entries"}`;

    if (counter.textContent !== label) {
      counter.textContent = label;
    }
  };

  const hydrateSheetCover = (sheet, trigger) => {
    const mount = sheet.querySelector("[data-list-sheet-cover]");
    const source = trigger?.querySelector(".list-card__media");

    if (!mount || !source || mount.childElementCount > 0) {
      return;
    }

    const cover = source.cloneNode(true);
    cover.classList.remove("list-card__media");
    cover.classList.add("list-sheet-cover__art");
    mount.append(cover);
  };

  sheetElements.forEach((sheet) => {
    const slug = sheet.dataset.listSheet;

    if (!slug || sheets.has(slug)) {
      return;
    }

    const trigger = triggersBySlug.get(slug);
    hydrateSheetCover(sheet, trigger);
    syncEntryCount(sheet);
    new MutationObserver(() => syncEntryCount(sheet)).observe(sheet, {
      attributeFilter: ["data-list-entry"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    sheet.addEventListener("list-sheet:before-open", () => {
      void hydrateVisitedMap(sheet);
    });
    sheets.set(slug, sheet);
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
    const radius = clampedProgress * 24;

    stage.style.transform = `translateY(${translate}px) scale(${scale})`;
    stage.style.filter =
      `saturate(${saturation}) brightness(${brightness})`;
    stage.style.borderRadius = `${radius}px ${radius}px 0 0`;
  };

  const finalizeClose = (sheet, { restoreFocus = true } = {}) => {
    closeDialog(sheet);
    sheet.classList.remove("is-open", "is-closing", "is-dragging");
    sheet.style.removeProperty("transform");
    sheet.style.removeProperty("transition-duration");
    page.classList.remove(
      "has-list-sheet-open",
      "is-list-sheet-closing",
      "is-list-sheet-dragging",
    );
    clearStageDragStyles();
    dispatchLifecycle(sheet, "close");

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
    dispatchLifecycle(sheet, "before-close");
    page.classList.remove("is-list-sheet-dragging");
    page.classList.add("is-list-sheet-closing");
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
      page.classList.remove("has-list-sheet-open");
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
      window.history.state?.listSheet === activeSlug &&
      sheetSlugFromUrl() === activeSlug
    ) {
      window.history.back();
      return;
    }

    window.history.replaceState(
      { ...window.history.state, listSheet: null },
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

    if (!sheet || (activeSheet === sheet && !isClosing)) {
      return;
    }

    if (activeSheet) {
      pendingSlug = slug;
      animateClose({ restoreFocus: false });
      return;
    }

    activeSheet = sheet;
    activeSlug = slug;
    activeTrigger =
      trigger ??
      triggers.find((candidate) => candidate.dataset.listSheetOpen === slug) ??
      null;
    isClosing = false;
    sheet.querySelector(".list-sheet__surface")?.scrollTo({
      top: 0,
      behavior: "auto",
    });
    dispatchLifecycle(sheet, "before-open", { trigger: activeTrigger });
    syncEntryCount(sheet);
    setSheetThemeColor();
    showDialog(sheet);
    page.classList.add("has-list-sheet-open");

    if (updateHistory) {
      window.history.pushState(
        { ...window.history.state, listSheet: slug },
        "",
        urlWithSheet(slug),
      );
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        sheet.classList.add("is-open");
        sheet.focus({ preventScroll: true });
        dispatchLifecycle(sheet, "open", { trigger: activeTrigger });
        syncEntryCount(sheet);
      });
    });
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      openSheet(trigger.dataset.listSheetOpen, { trigger });
    });
  });

  sheets.forEach((sheet) => {
    sheet
      .querySelector("[data-list-sheet-close]")
      ?.addEventListener("click", () => requestClose());

    sheet.addEventListener("cancel", (event) => {
      event.preventDefault();
      requestClose();
    });

    const handle = sheet.querySelector("[data-list-sheet-handle]");

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

      page.classList.remove("is-list-sheet-dragging");
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

      page.classList.add("is-list-sheet-closing");
      sheet.classList.add("is-closing");
      sheet.style.transform = "translateY(0)";
      setStageProgress(1);

      const clearSnapStyles = () => {
        page.classList.remove("is-list-sheet-closing");
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
      page.classList.add("is-list-sheet-dragging");
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

  const initialSlug = sheetSlugFromUrl();

  if (initialSlug) {
    openSheet(initialSlug, { updateHistory: false });
  }
})();
