// Theme

const themeRoot = document.documentElement;
const themeQuery = window.matchMedia("(prefers-color-scheme: dark)");
const themeStorageKey = "theme";

const keepViewport = (fn) => {
  const scrollEl = document.scrollingElement || document.documentElement;
  const { scrollX, scrollY } = window;
  const savedScrollLeft = scrollEl ? scrollEl.scrollLeft : scrollX;
  const savedScrollTop = scrollEl ? scrollEl.scrollTop : scrollY;

  fn();

  const restore = () => {
    if (window.scrollX !== scrollX || window.scrollY !== scrollY) {
      window.scrollTo(scrollX, scrollY);
    }

    if (scrollEl) {
      if (scrollEl.scrollLeft !== savedScrollLeft) {
        scrollEl.scrollLeft = savedScrollLeft;
      }
      if (scrollEl.scrollTop !== savedScrollTop) {
        scrollEl.scrollTop = savedScrollTop;
      }
    }
  };

  const now = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const start = now();
  const duration = 450;

  const tick = () => {
    restore();
    if (now() - start < duration) {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
};

const applyThemeToRoot = (mode) => {
  const shouldBeDark =
    mode === "dark" || (mode === "system" && themeQuery.matches);
  themeRoot.classList.toggle("dark", shouldBeDark);
};

const persistTheme = (mode) => {
  if (mode === "system") {
    localStorage.removeItem(themeStorageKey);
  } else {
    localStorage.setItem(themeStorageKey, mode);
  }
};

const loadStoredTheme = () => {
  const saved = localStorage.getItem(themeStorageKey);
  return saved === "dark" || saved === "light" ? saved : "system";
};

document.addEventListener("alpine:init", () => {
  const apply = (store, mode, immediate = false) => {
    const run = () => {
      applyThemeToRoot(mode);
      persistTheme(mode);
      store.mode = mode;
      syncIframeTheme(mode);
    };

    if (immediate) {
      run();
    } else {
      keepViewport(run);
    }
  };

  Alpine.store("theme", {
    mode: "system",

    init() {
      apply(this, loadStoredTheme(), true);

      themeQuery.addEventListener("change", () => {
        if (this.mode === "system") {
          apply(this, "system");
        }
      });
    },

    set(mode) {
      apply(this, mode);
    },

    toggle() {
      this.set(
        this.mode === "system"
          ? "light"
          : this.mode === "light"
          ? "dark"
          : "system"
      );
    },

    dark() {
      this.set("dark");
    },

    light() {
      this.set("light");
    },

    system() {
      this.set("system");
    },
  });
});

// Updated theme syncing function using classes for multiple iframes
function syncIframeTheme(mode) {
  const iframes = document.querySelectorAll("iframe.article-embed");
  iframes.forEach((iframe) => {
    if (!iframe.contentWindow) {
      iframe.addEventListener("load", () => syncSingleIframe(iframe, mode));
      return;
    }
    syncSingleIframe(iframe, mode);
  });
}

function syncSingleIframe(iframe, mode) {
  const html = iframe.contentWindow.document.documentElement;

  html.classList.remove("dark", "light");

  if (mode === "dark") {
    html.classList.add("dark");
  } else if (mode === "light") {
    html.classList.add("light");
  } else if (mode === "system") {
    const prefersDark = themeQuery.matches;
    if (!prefersDark) {
      html.classList.add("light");
    }
  }

  const body = iframe.contentWindow.document.body;
  body.style.transition = "background-color 0.3s ease, color 0.3s ease";
  setTimeout(() => {
    body.style.transition = "";
  }, 300);
}

// Ensure sync on each iframe load (if theme set before load)
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("iframe.article-embed").forEach((iframe) => {
    iframe.addEventListener("load", () => {
      syncIframeTheme(Alpine.store("theme").mode);
    });
  });
});

// Content interaction
document.addEventListener("DOMContentLoaded", function () {
  // Set up scroll animations
  const observerOptions = {
    root: null,
    rootMargin: "0px",
    threshold: 0.1,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll(".animate-on-scroll").forEach((element) => {
    observer.observe(element);
  });
});

// Global command palette data for reuse across pages
window.COMMAND_ITEMS_DATA = {
  pages: [
    {
      title: "Home",
      value: "home",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-house w-4 h-4 mr-2"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
      right: "N + H",
      default: true,
    },
    {
      title: "About me (Who am I?)",
      value: "about",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user w-4 h-4 mr-2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      right: "N + A",
      default: true,
    },
    {
      title: "My Projects (What have I been working on?)",
      value: "projects",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-briefcase w-4 h-4 mr-2"><rect width="20" height="14" x="2" y="7" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>',
      right: "N + P",
      default: true,
    },
    {
      title: "Now (What am I upto at the moment?)",
      value: "now",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hourglass w-4 h-4 mr-2"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>',
      right: "N + N",
      default: true,
    },
    {
      title: "Writing (All my posts, kinda my personnal blog)",
      value: "writing",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-notebook-pen-icon lucide-notebook-pen w-4 h-4 mr-2"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg>',
      right: "N + W",
      default: true,
    },
    {
      title: "Uses (My toolkit, tech stacks...)",
      value: "uses",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-drafting-compass w-4 h-4 mr-2"><path d="m12.99 6.74 1.93 3.44"/><path d="M19.136 12a10 10 0 0 1-14.271 0"/><path d="m21 21-2.16-3.84"/><path d="m3 21 8.02-14.26"/><circle cx="12" cy="5" r="2"/></svg>',
      right: "N + U",
      default: true,
    },
    {
      title: "Bookmarks (Interestings posts, videos and useful websites)",
      value: "bookmarks",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bookmark-icon lucide-bookmark w-4 h-4 mr-2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
      right: "N + B",
      default: true,
    },
    {
      title: "Colophon (What's this all about?)",
      value: "colophon",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-code-xml w-4 h-4 mr-2"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>',
      right: "N + C",
      default: true,
    },
  ],
  network: [
    {
      title: "Links (My socials)",
      value: "links",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link w-4 h-4 mr-2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
      right: "N + L",
      default: true,
    },
    {
      title: "Send me an email",
      value: "email",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-at-sign w-4 h-4 mr-2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>',
      right: "N + E",
      default: true,
    },
  ],
  settings: [
    {
      title: "Toggle Theme",
      value: "theme",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-paintbrush-vertical w-4 h-4 mr-2"><path d="M10 2v2"/><path d="M14 2v4"/><path d="M17 2a1 1 0 0 1 1 1v9H6V3a1 1 0 0 1 1-1z"/><path d="M6 12a1 1 0 0 0-1 1v1a2 2 0 0 0 2 2h2a1 1 0 0 1 1 1v2.9a2 2 0 1 0 4 0V17a1 1 0 0 1 1-1h2a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1"/></svg>',
      right: "N + T",
      default: true,
    },
  ],
};

window.COMMAND_ACTION_MAP = {
  home: "/",
  about: "/about",
  projects: "/projects",
  now: "/now",
  writing: "/posts",
  uses: "/uses",
  bookmarks: "/bookmarks",
  colophon: "/colophon",
  links: "/links",
  email: "mailto:contact@pierrelouis.net?subject=Just%20wanted%20to%20say%20hi",
};

// Mapping for quick navigation shortcuts using the "n" prefix
window.SHORTCUT_MAP = {
  h: "/",
  a: "/about",
  p: "/projects",
  n: "/now",
  w: "/posts",
  b: "/bookmarks",
  u: "/uses",
  c: "/colophon",
  l: "/links",
  e: "mailto:contact@pierrelouis.net?subject=Hi,%20I'm%20....%20and...%20",
};

// Mobile Command Drawer Implementation (Exact CodePen mechanics)
document.addEventListener("DOMContentLoaded", function () {
  const drawer = document.querySelector(".drawer");
  if (!drawer) return;

  const root = document.documentElement;
  let metricsRaf = null;
  let cachedSafeAreaInsetBottom = null;

  const parseLengthValue = (value) => {
    if (!value) return 0;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const measureSafeAreaInsetBottom = () => {
    if (!document.body) return 0;
    const probe = document.createElement("div");
    probe.style.position = "fixed";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    probe.style.bottom = "0";
    probe.style.left = "0";
    probe.style.width = "0";
    probe.style.height = "env(safe-area-inset-bottom, 0px)";
    document.body.appendChild(probe);
    let measured = parseLengthValue(window.getComputedStyle(probe).height);
    if (!measured) {
      probe.style.height = "constant(safe-area-inset-bottom)";
      measured = parseLengthValue(window.getComputedStyle(probe).height);
    }
    document.body.removeChild(probe);
    return measured;
  };

  const getSafeAreaInsetBottom = () => {
    if (cachedSafeAreaInsetBottom !== null) {
      return cachedSafeAreaInsetBottom;
    }
    cachedSafeAreaInsetBottom = measureSafeAreaInsetBottom();
    return cachedSafeAreaInsetBottom;
  };

  const updateDrawerMetrics = () => {
    if (window.innerWidth >= 768) {
      root.style.removeProperty("--mobile-drawer-hidden-distance");
      cachedSafeAreaInsetBottom = null;
      return;
    }
    const viewport = window.visualViewport;
    const viewportHeight = viewport
      ? viewport.height + viewport.offsetTop
      : window.innerHeight || document.documentElement.clientHeight;
    const safeAreaInsetBottom = getSafeAreaInsetBottom();
    const totalDistance = Math.ceil((viewportHeight || 0) + safeAreaInsetBottom + 1);
    root.style.setProperty(
      "--mobile-drawer-hidden-distance",
      `${totalDistance}px`
    );
  };

  const scheduleDrawerMetricsUpdate = () => {
    if (metricsRaf) cancelAnimationFrame(metricsRaf);
    metricsRaf = requestAnimationFrame(() => {
      metricsRaf = null;
      updateDrawerMetrics();
    });
  };

  updateDrawerMetrics();
  window.addEventListener("resize", scheduleDrawerMetricsUpdate, {
    passive: true,
  });
  window.visualViewport?.addEventListener("resize", scheduleDrawerMetricsUpdate);
  window.visualViewport?.addEventListener("scroll", scheduleDrawerMetricsUpdate);
  window.addEventListener("orientationchange", () => {
    cachedSafeAreaInsetBottom = null;
    scheduleDrawerMetricsUpdate();
  });

  const scroller = drawer.querySelector(".drawer__scroller");
  const slide = drawer.querySelector(".drawer__slide");
  const searchInput = document.querySelector("#drawer-search");
  const itemsContainer = document.querySelector(".command-items-container");
  const content = drawer.querySelector(".drawer__content");
  const closeTargets = drawer.querySelectorAll("[data-command-drawer-close]");

  let isAnimatingClose = false;
  let allowImmediateClose = false;
  let closeFallback;
  let contentTransitionEndHandler;
  let scrollCloseRaf;
  let isClosingFromSwipe = false;
  let lastScrollTop = scroller.scrollTop;
  const SCROLL_CLOSE_THRESHOLD = 8;

  const clearClosingAnimation = () => {
    if (closeFallback) {
      clearTimeout(closeFallback);
      closeFallback = null;
    }
    if (contentTransitionEndHandler) {
      content.removeEventListener("transitionend", contentTransitionEndHandler);
      contentTransitionEndHandler = null;
    }
    drawer.removeAttribute("data-closing");
    isAnimatingClose = false;
  };

  const hideDrawerInstantly = () => {
    allowImmediateClose = true;
    drawer.hidePopover();
    allowImmediateClose = false;
  };

  const openDrawer = () => {
    clearClosingAnimation();
    isAnimatingClose = false;
    drawer.removeAttribute("data-closing");
    updateDrawerMetrics();
    drawer.showPopover();
    requestAnimationFrame(() => {
      const targetTop = slide?.offsetHeight || scroller.scrollHeight || 0;
      scroller.scrollTo({ top: targetTop, behavior: "instant" });
      lastScrollTop = targetTop;
    });
  };

  drawer.openCommandDrawer = openDrawer;

  const closeDrawer = ({ immediate = false } = {}) => {
    if (!drawer.matches(":popover-open")) return;

    if (immediate || !content) {
      clearClosingAnimation();
      hideDrawerInstantly();
      return;
    }

    if (isAnimatingClose) return;

    isAnimatingClose = true;
    drawer.dataset.closing = "true";

    const finish = () => {
      clearClosingAnimation();
      hideDrawerInstantly();
    };

    contentTransitionEndHandler = (event) => {
      if (event.target !== content) return;
      finish();
    };

    content.addEventListener("transitionend", contentTransitionEndHandler);

    closeFallback = window.setTimeout(() => {
      finish();
    }, 600);
  };

  const finishSwipeClose = () => {
    if (isClosingFromSwipe || isAnimatingClose) return;
    isClosingFromSwipe = true;
    if (scrollCloseRaf) {
      cancelAnimationFrame(scrollCloseRaf);
      scrollCloseRaf = null;
    }
    drawer.dataset.snapped = true;
    document.documentElement.dataset.dragging = false;
    closeDrawer({ immediate: true });
  };

  closeTargets.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      closeDrawer();
    });
  });

  const formatCommandCategory = (value) =>
    value
      .split(/[\s_-]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  // Populate command items
  function renderItems(searchTerm = "") {
    const items = window.COMMAND_ITEMS_DATA;
    let html = "";

    for (const category in items) {
      const categoryItems = items[category].filter((item) => {
        if (!searchTerm) return item.default;
        return item.title.toLowerCase().includes(searchTerm.toLowerCase());
      });

      if (categoryItems.length > 0) {
        html += `<div class="command-item-category">${formatCommandCategory(
          category
        )}</div>`;
        categoryItems.forEach((item) => {
          html += `
            <div class="command-item" data-value="${item.value}">
              ${item.icon}
              <span>${
                item.value === "theme" ? "Toggle Theme" : item.title
              }</span>
            </div>
          `;
        });
      }
    }

    itemsContainer.innerHTML = html;

    // Add click handlers
    itemsContainer.querySelectorAll(".command-item").forEach((item) => {
      item.addEventListener("click", function () {
        const value = this.dataset.value;
        if (value === "theme") {
          if (window.Alpine && window.Alpine.store("theme")) {
            window.Alpine.store("theme").toggle();
          }
        } else {
          const url = window.COMMAND_ACTION_MAP[value];
          if (url) window.location.href = url;
        }
        closeDrawer();
      });
    });
  }

  // Search functionality
  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        renderItems(this.value);
      }, 100);
    });
  }

  // Initial render
  renderItems();

  // Scroll snap change support (exact CodePen implementation)
  const scrollSnapChangeSupport = "onscrollsnapchange" in window;
  const scrollAnimationSupport = CSS.supports("animation-timeline: scroll()");

  if (scrollSnapChangeSupport) {
    scroller.addEventListener("scrollsnapchange", () => {
      if (scroller.scrollTop === 0) {
        drawer.dataset.snapped = true;
        closeDrawer({ immediate: true });
      }
    });
  }

  const anchor = drawer.querySelector(".drawer__anchor");
  const options = {
    root: drawer,
    rootMargin: "0px 0px -1px 0px",
    threshold: 1.0,
  };

  let observer;
  let syncer;
  let syncs = new Array(10);
  let index = 0;

  function addNumber(num) {
    syncs[index] = num;
    index = (index + 1) % syncs.length;
  }

  let frame = 0;
  const syncDrawer = () => {
    syncer = requestAnimationFrame(() => {
      document.documentElement.style.setProperty(
        "--closed",
        1 - scroller.scrollTop / slide.offsetHeight
      );

      if (new Set(syncs).size === 1 && syncs[0] === slide.offsetHeight) {
        frame++;
      }
      if (frame >= 10) {
        frame = 0;
        syncs = new Array(10);
        scroller.addEventListener("scroll", scrollDriver, { once: true });
      } else {
        addNumber(scroller.scrollTop);
        syncDrawer();
      }
    });
  };

  const scrollDriver = () => {
    syncDrawer();
  };

  const callback = (entries) => {
    const { isIntersecting, intersectionRatio } = entries[0];
    const isVisible = intersectionRatio === 1;

    if (
      !isVisible &&
      !isIntersecting &&
      scroller.scrollTop - (window.visualViewport?.offsetTop || 0) <
        slide.offsetHeight * 0.5
    ) {
      drawer.dataset.snapped = true;
      closeDrawer({ immediate: true });
      observer.disconnect();
    }
  };

  drawer.addEventListener("beforetoggle", (event) => {
    if (event.newState === "closed" && !allowImmediateClose) {
      event.preventDefault();
      closeDrawer();
    }

    if (event.newState === "open") {
      clearClosingAnimation();
      requestAnimationFrame(() => {
        const targetTop = slide?.offsetHeight || scroller.scrollHeight || 0;
        scroller.scrollTo({ top: targetTop, behavior: "instant" });
      });
    }
  });

  // Reset the drawer once closed
  drawer.addEventListener("toggle", (event) => {
    if (event.newState === "closed") {
      clearClosingAnimation();
      drawer.dataset.snapped = false;
      scroller.removeEventListener("scroll", scrollDriver);
      if (syncer) cancelAnimationFrame(syncer);
      document.documentElement.style.removeProperty("--closed");
      if (searchInput) searchInput.value = "";
      renderItems();
      isClosingFromSwipe = false;
      lastScrollTop = scroller.scrollTop;
      if (scrollCloseRaf) {
        cancelAnimationFrame(scrollCloseRaf);
        scrollCloseRaf = null;
      }
      document.documentElement.dataset.dragging = false;
      document.body.classList.remove("overflow-hidden");
    }
    if (event.newState === "open" && !scrollSnapChangeSupport) {
      clearClosingAnimation();
      if (!observer) observer = new IntersectionObserver(callback, options);
      observer.observe(anchor);
    }
    if (event.newState === "open" && !scrollAnimationSupport) {
      scroller.addEventListener("scroll", scrollDriver, { once: true });
    }
    if (event.newState === "open") {
      isClosingFromSwipe = false;
      lastScrollTop = scroller.scrollTop;
    }
  });

  // Drag mechanics (exact CodePen implementation)
  const attachDrag = (element) => {
    let startY = 0;
    let drag = 0;
    let scrollStart;

    const reset = () => {
      startY = drag = 0;
      const top = scroller.scrollTop < scrollStart * 0.5 ? 0 : scrollStart;

      const handleScroll = () => {
        if (scroller.scrollTop === top) {
          document.documentElement.dataset.dragging = false;
          scroller.removeEventListener("scroll", handleScroll);
          lastScrollTop = scroller.scrollTop;
          if (top === 0) finishSwipeClose();
        }
      };
      scroller.addEventListener("scroll", handleScroll);

      scroller.scrollTo({
        top,
        behavior: "smooth",
      });

      handleScroll();
    };

    const handle = ({ y }) => {
      drag += Math.abs(y - startY);
      scroller.scrollTo({
        top: scrollStart - (y - startY),
        behavior: "instant",
      });
    };

    const teardown = (event) => {
      if (event.target.tagName !== "BUTTON") {
        reset();
      }
      document.removeEventListener("mousemove", handle);
      document.removeEventListener("mouseup", teardown);
    };

    const activate = ({ y }) => {
      startY = y;
      scrollStart = scroller.scrollTop;
      document.documentElement.dataset.dragging = true;
      document.addEventListener("mousemove", handle);
      document.addEventListener("mouseup", teardown);
    };

    element.addEventListener("click", (event) => {
      if (drag > 5) event.preventDefault();
      reset();
    });
    element.addEventListener("mousedown", activate);
  };

  attachDrag(drawer);

  const handleScrollClose = () => {
    if (scrollCloseRaf) cancelAnimationFrame(scrollCloseRaf);
    scrollCloseRaf = requestAnimationFrame(() => {
      if (!drawer.matches(":popover-open")) {
        scrollCloseRaf = null;
        return;
      }
      const currentTop = scroller.scrollTop;
      const isPullingDown = currentTop <= lastScrollTop;
      lastScrollTop = currentTop;
      if (
        isPullingDown &&
        currentTop <= SCROLL_CLOSE_THRESHOLD &&
        !isClosingFromSwipe
      ) {
        finishSwipeClose();
      }
      scrollCloseRaf = null;
    });
  };

  scroller.addEventListener("scroll", handleScrollClose, { passive: true });

  // Handle VisualViewport changes for iOS
  window.visualViewport?.addEventListener("resize", () => {
    document.documentElement.style.setProperty(
      "--sw-keyboard-height",
      window.visualViewport.offsetTop
    );
  });

  // Update command button to handle both desktop and mobile properly
  const commandButton = document.querySelector(
    'button[aria-label="Open command palette"]'
  );
  if (commandButton) {
    commandButton.removeEventListener("click", commandButton._clickHandler, true);
    commandButton._clickHandler = function (e) {
      if (window.innerWidth < 768) {
        e.preventDefault();
        e.stopImmediatePropagation();
        // Close Alpine palette if open
        if (
          window.Alpine &&
          window.Alpine.$data &&
          window.Alpine.$data.commandOpen
        ) {
          window.Alpine.$data.commandOpen = false;
        }
        document.body.classList.remove("overflow-hidden");
        // Open drawer
        const drawer = document.getElementById("command-drawer");
        if (drawer) {
          openDrawer();
        }
      }
    };
    commandButton.addEventListener("click", commandButton._clickHandler, true);
  }
});

// Prefetch internal pages on hover for snappier navigation
document.addEventListener("DOMContentLoaded", () => {
  const cache = new Set();
  document.querySelectorAll("a[href]").forEach((link) => {
    const url = link.href;
    if (url.startsWith(location.origin) && !link.target && !url.includes("#")) {
      link.addEventListener(
        "pointerenter",
        () => {
          if (cache.has(url)) return;
          cache.add(url);
          const l = document.createElement("link");
          l.rel = "prefetch";
          l.href = url;
          document.head.appendChild(l);
        },
        { passive: true }
      );
    }
  });
});

// Lazy load images that do not specify a loading attribute
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("img:not([loading])").forEach((img) => {
    img.setAttribute("loading", "lazy");
  });
});

// Lightweight lightbox helpers for the projects page
document.addEventListener("DOMContentLoaded", () => {
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");

  const open = (src) => {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  const close = () => {
    if (!lightbox || !lightboxImg) return;
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxImg.removeAttribute("src");
    document.body.style.overflow = "";
  };

  window.openLightbox = open;
  window.closeLightbox = close;

  document.querySelectorAll(".project-preview-image").forEach((img) => {
    img.addEventListener("click", () => open(img.src));
  });

  lightbox?.addEventListener("click", (e) => {
    if (
      e.target.id === "lightbox" ||
      e.target.classList.contains("image-lightbox-close")
    ) {
      close();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
});

// Global keyboard shortcut to toggle the command palette
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (window.innerWidth < 768) {
      const drawer = document.getElementById("command-drawer");
      if (drawer?.openCommandDrawer) {
        drawer.openCommandDrawer();
      } else if (drawer) {
        drawer.showPopover();
      }
    } else {
      window.dispatchEvent(new CustomEvent("open-command-palette"));
    }
  }
});

// Hold-N multi-chord shortcuts
(() => {
  let nHeld = false;
  let inactivityTimer = null;
  const INACTIVITY_MS = 1500;

  const isTypingField = () => {
    const ae = document.activeElement;
    return (
      ae &&
      (ae.tagName === "INPUT" ||
        ae.tagName === "TEXTAREA" ||
        ae.isContentEditable)
    );
  };

  const reset = () => {
    nHeld = false;
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = null;
  };

  const bumpInactivity = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(reset, INACTIVITY_MS);
  };

  document.addEventListener(
    "keydown",
    (e) => {
      const key = e.key.toLowerCase();

      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && key === "n") {
        if (isTypingField()) return;
        nHeld = true;
        bumpInactivity();
        e.preventDefault();
        return;
      }

      if (nHeld && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        if (isTypingField()) return reset();

        if (e.repeat) return;

        if (key === "t") {
          e.preventDefault();
          document.querySelector("button.theme-toggle")?.click();
          bumpInactivity();
          return;
        }

        const target = window.SHORTCUT_MAP?.[key];
        if (target) {
          e.preventDefault();
          window.location.href = target;
        }
      }
    },
    { capture: true }
  );

  document.addEventListener("keyup", (e) => {
    if (e.key.toLowerCase() === "n") reset();
  });
  window.addEventListener("blur", reset);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) reset();
  });
})();

(() => {
  const backToTop = document.querySelector("[data-back-to-top]");
  if (!backToTop) return;

  const prefersReducedMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  const supportsSmoothScroll =
    "scrollBehavior" in document.documentElement.style;

  const animateFallback = () => {
    const startY =
      window.pageYOffset || document.documentElement.scrollTop || 0;
    if (startY === 0 || !window.requestAnimationFrame) {
      window.scrollTo(0, 0);
      return;
    }

    const duration = Math.min(600, Math.max(250, startY / 2));
    const startTime = (window.performance && performance.now) || Date.now();

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      const nextY = Math.round(startY * (1 - eased));
      window.scrollTo(0, nextY);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  };

  backToTop.addEventListener(
    "click",
    (event) => {
      event.preventDefault();

      if (prefersReducedMotion && prefersReducedMotion.matches) {
        window.scrollTo(0, 0);
        return;
      }

      if (supportsSmoothScroll) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      animateFallback();
    },
    { passive: false }
  );
})();
