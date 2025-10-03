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
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-house w-4 h-4 mr-1 sm:mr-2"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
      right: "N + H",
      default: true,
    },
    {
      title: "About me (Who am I?)",
      value: "about",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user w-4 h-4 mr-1 sm:mr-2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      right: "N + A",
      default: true,
    },
    {
      title: "My Projects (What have I been working on?)",
      value: "projects",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-briefcase w-4 h-4 mr-1 sm:mr-2"><rect width="20" height="14" x="2" y="7" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>',
      right: "N + P",
      default: true,
    },
    {
      title: "Now (What am I upto at the moment?)",
      value: "now",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hourglass w-4 h-4 mr-1 sm:mr-2"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>',
      right: "N + N",
      default: true,
    },
    {
      title: "Writing (All my posts, kinda my personnal blog)",
      value: "writing",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-notebook-pen-icon lucide-notebook-pen w-4 h-4 mr-1 sm:mr-2"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg>',
      right: "N + W",
      default: true,
    },
    {
      title: "Uses (My toolkit, tech stacks...)",
      value: "uses",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-drafting-compass w-4 h-4 mr-1 sm:mr-2"><path d="m12.99 6.74 1.93 3.44"/><path d="M19.136 12a10 10 0 0 1-14.271 0"/><path d="m21 21-2.16-3.84"/><path d="m3 21 8.02-14.26"/><circle cx="12" cy="5" r="2"/></svg>',
      right: "N + U",
      default: true,
    },
    {
      title: "Bookmarks (Interestings posts, videos and useful websites)",
      value: "bookmarks",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bookmark-icon lucide-bookmark w-4 h-4 mr-1 sm:mr-2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
      right: "N + B",
      default: true,
    },
    {
      title: "Colophon (What's this all about?)",
      value: "colophon",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-code-xml w-4 h-4 mr-1 sm:mr-2"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>',
      right: "N + C",
      default: true,
    },
  ],
  network: [
    {
      title: "Links (My socials)",
      value: "links",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link w-4 h-4 mr-1 sm:mr-2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
      right: "N + L",
      default: true,
    },
    {
      title: "Send me an email",
      value: "email",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-at-sign w-4 h-4 mr-1 sm:mr-2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>',
      right: "N + E",
      default: true,
    },
  ],
  settings: [
    {
      title: "Toggle Theme",
      value: "theme",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-paintbrush-vertical w-4 h-4 mr-1 sm:mr-2"><path d="M10 2v2"/><path d="M14 2v4"/><path d="M17 2a1 1 0 0 1 1 1v9H6V3a1 1 0 0 1 1-1z"/><path d="M6 12a1 1 0 0 0-1 1v1a2 2 0 0 0 2 2h2a1 1 0 0 1 1 1v2.9a2 2 0 1 0 4 0V17a1 1 0 0 1 1-1h2a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1"/></svg>',
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

// Global keyboard shortcut to toggle the command palette
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    if (window.innerWidth < 768) {
      return;
    }

    e.preventDefault();
    window.dispatchEvent(new CustomEvent("open-command-palette"));
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
