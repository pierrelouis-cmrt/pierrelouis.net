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
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock3-icon lucide-clock-3 w-4 h-4 mr-1 sm:mr-2"><path d="M12 6v6h4"/><circle cx="12" cy="12" r="10"/></svg>',
      right: "N + K",
      default: true,
    },
    {
      title: "Someday (Someday I will...)",
      value: "someday",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hourglass-icon lucide-hourglass w-4 h-4 mr-1 sm:mr-2"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>',
      right: "N + S",
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
      title: "Photos (Some of my best shots)",
      value: "photos",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-camera-icon lucide-camera w-4 h-4 mr-1 sm:mr-2"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/></svg>',
      right: "N + G",
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
  articles: [],
  notes: [],
  experiments: [],
};

window.COMMAND_ACTION_MAP = {
  home: "/",
  about: "/about",
  projects: "/projects",
  now: "/now",
  someday: "/someday",
  writing: "/posts",
  uses: "/uses",
  photos: "/photos",
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
  k: "/now",
  s: "/someday",
  w: "/posts",
  b: "/bookmarks",
  u: "/uses",
  g: "/photos",
  c: "/colophon",
  l: "/links",
  e: "mailto:contact@pierrelouis.net?subject=Hi,%20I'm%20....%20and...%20",
};

const COMMAND_POST_CATEGORY_MAP = {
  Articles: { key: "articles" },
  Notes: { key: "notes" },
  Experiments: { key: "experiments" },
};

const COMMAND_POST_ICONS = {
  Articles:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-notebook-pen w-4 h-4 mr-1 sm:mr-2"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg>',
  Notes:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sticky-note w-4 h-4 mr-1 sm:mr-2"><path d="M15 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9Z"/><path d="M15 2v6a2 2 0 0 0 2 2h6"/><path d="M9 10h6"/><path d="M9 14h6"/></svg>',
  Experiments:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flask-conical w-4 h-4 mr-1 sm:mr-2"><path d="M10 2v6a2 2 0 0 1-.3 1.05L4.3 18.9A2 2 0 0 0 6.03 22h11.94a2 2 0 0 0 1.73-3.1l-5.4-9.85A2 2 0 0 1 14 8V2"/><path d="M14 16h-4"/><path d="M14 12h-4"/></svg>',
};

(() => {
  const postsEndpoint = "/posts/posts.json";
  const now = () => new Date();

  const monthIndex = (month) => {
    if (!month) return NaN;
    return new Date(`${month} 1 2000`).getMonth();
  };

  const slugify = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9 _-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

  const ensureBuckets = () => {
    Object.values(COMMAND_POST_CATEGORY_MAP).forEach(({ key }) => {
      if (!Array.isArray(window.COMMAND_ITEMS_DATA[key])) {
        window.COMMAND_ITEMS_DATA[key] = [];
      }
    });
  };

  const integratePosts = (posts) => {
    ensureBuckets();

    const today = now();
    const added = [];

    const sorted = [...posts].sort(
      (a, b) =>
        (b.year || 0) - (a.year || 0) ||
        monthIndex(b.month) - monthIndex(a.month) ||
        (b.day || 0) - (a.day || 0)
    );

    sorted.forEach((post) => {
      if (!post || !post.title || !post.tag) return;

      const categoryMeta = COMMAND_POST_CATEGORY_MAP[post.tag];
      if (!categoryMeta) return;

      const { key } = categoryMeta;
      const slug = slugify(post.title);
      const value = `post-${key}-${slug}`;

      if (window.COMMAND_ACTION_MAP[value]) return;

      const postDate = new Date(
        `${post.month || "Jan"} ${post.day || 1} ${
          post.year || today.getFullYear()
        }`
      );
      if (Number.isNaN(postDate) || postDate > today) return;

      const iconMarkup =
        COMMAND_POST_ICONS[post.tag] || COMMAND_POST_ICONS.Articles;
      const url = `/posts/${slug}.html`;
      const right =
        post.month && post.year ? `${post.month} ${post.year}` : undefined;

      const item = {
        title: post.title,
        value,
        icon: iconMarkup,
        default: false,
      };

      if (right) {
        item.right = right;
      }

      window.COMMAND_ITEMS_DATA[key].push(item);
      window.COMMAND_ACTION_MAP[value] = url;
      added.push(item);
    });

    if (added.length > 0) {
      window.dispatchEvent(
        new CustomEvent("command-palette-data-updated", {
          detail: { source: "posts", count: added.length },
        })
      );
    }
  };

  let postsPromise = null;

  window.loadCommandPalettePosts = () => {
    if (postsPromise) {
      return postsPromise;
    }

    postsPromise = fetch(postsEndpoint, { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load posts.json: ${response.status}`);
        }
        return response.json();
      })
      .then((posts) => {
        if (Array.isArray(posts)) {
          integratePosts(posts);
        }
      })
      .catch((error) => {
        console.error("[CommandPalette] Unable to load posts JSON", error);
      });

    return postsPromise;
  };

  window.loadCommandPalettePosts();
})();

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

(() => {
  const html = document.documentElement;
  const body = document.body;
  const RESET_DELAY = 200;
  const DEFAULT_PALETTE = { dark: "#0f0f0f", light: "#faf9f9" };
  const PALETTES = {
    overlay: DEFAULT_PALETTE,
    drawer: DEFAULT_PALETTE,
    lightbox: { dark: "#14161d", light: "#e4e3e1" },
  };

  const state = {
    stack: [],
    resetTimer: null,
    observer: null,
    mediaQuery: null,
    mediaHandler: null,
    bodySnapshot: null,
  };

  const ensureMeta = (() => {
    let meta;
    return () => {
      if (meta && meta.isConnected) return meta;
      meta =
        document.querySelector("meta[name='theme-color']") ||
        Object.assign(document.createElement("meta"), { name: "theme-color" });
      if (!meta.isConnected) document.head.appendChild(meta);
      return meta;
    };
  })();

  const pickPalette = (source) => PALETTES[source] || DEFAULT_PALETTE;

  const resolveColor = (palette) =>
    (palette || pickPalette(state.stack[state.stack.length - 1] || "overlay"))[
      html.classList.contains("dark") ? "dark" : "light"
    ];

  const applyThemeColor = () =>
    ensureMeta().setAttribute("content", resolveColor());

  const scheduleThemeColor = () => {
    applyThemeColor();
    requestAnimationFrame(applyThemeColor);
    setTimeout(applyThemeColor, 60);
  };

  const clearResetTimer = () => {
    if (state.resetTimer) {
      clearTimeout(state.resetTimer);
      state.resetTimer = null;
    }
  };

  const scheduleReset = () => {
    state.resetTimer = setTimeout(() => {
      ensureMeta().setAttribute("content", "#ffffff");
      state.resetTimer = null;
    }, RESET_DELAY);
  };

  const startWatchers = () => {
    if (!state.observer)
      state.observer = new MutationObserver(scheduleThemeColor);
    state.observer.observe(html, {
      attributes: true,
      attributeFilter: ["class"],
    });

    if (!state.mediaQuery && window.matchMedia) {
      try {
        state.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      } catch (error) {
        state.mediaQuery = null;
      }
    }

    if (state.mediaQuery && !state.mediaHandler) {
      const mq = state.mediaQuery;
      const handler = (state.mediaHandler = scheduleThemeColor);
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", handler);
      } else if (typeof mq.addListener === "function") {
        mq.addListener(handler);
      }
    }
  };

  const stopWatchers = () => {
    state.observer?.disconnect();
    if (state.mediaQuery && state.mediaHandler) {
      const mq = state.mediaQuery;
      if (typeof mq.removeEventListener === "function") {
        mq.removeEventListener("change", state.mediaHandler);
      } else if (typeof mq.removeListener === "function") {
        mq.removeListener(state.mediaHandler);
      }
      state.mediaHandler = null;
    }
  };

  const lockBody = () => {
    if (!body || state.bodySnapshot) return;
    state.bodySnapshot = {
      overflow: body.style.overflow,
      position: body.style.position,
      width: body.style.width,
      left: body.style.left,
      top: body.style.top,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.width = "100%";
    body.style.left = "0";
    body.style.top = `-${state.bodySnapshot.scrollY}px`;
  };

  const unlockBody = () => {
    if (!body || !state.bodySnapshot) return;
    const snapshot = state.bodySnapshot;
    body.style.overflow = snapshot.overflow || "";
    body.style.position = snapshot.position || "";
    body.style.width = snapshot.width || "";
    body.style.left = snapshot.left || "";
    body.style.top = snapshot.top || "";
    state.bodySnapshot = null;

    requestAnimationFrame(() => {
      window.scrollTo(snapshot.scrollX, snapshot.scrollY);
    });
  };

  const removeFromStack = (source) => {
    if (!state.stack.length) return;
    if (!source) {
      state.stack.pop();
      return;
    }
    const index = state.stack.lastIndexOf(source);
    if (index === -1) {
      state.stack.pop();
      return;
    }
    state.stack.splice(index, 1);
  };

  const controller = {
    open(source = "overlay") {
      clearResetTimer();
      if (!state.stack.length) {
        lockBody();
        startWatchers();
      }
      state.stack.push(source);
      scheduleThemeColor();
    },

    close(source = "overlay") {
      if (!state.stack.length) return;
      clearResetTimer();
      removeFromStack(source);
      if (state.stack.length) {
        scheduleThemeColor();
        return;
      }
      stopWatchers();
      scheduleReset();
      unlockBody();
    },

    updateThemeColor: scheduleThemeColor,

    resetThemeColor() {
      clearResetTimer();
      ensureMeta().setAttribute("content", "#ffffff");
    },

    getColorFor(source, isDark) {
      const palette = pickPalette(source);
      return palette[isDark ? "dark" : "light"];
    },

    hasActiveOverlays() {
      return state.stack.length > 0;
    },
  };

  window.__overlayChromeController = controller;
})();

(() => {
  class LightboxGallery {
    constructor(overlay) {
      this.overlay = overlay;
      this.shell = overlay.querySelector(".image-lightbox__shell");
      this.imageEl = overlay.querySelector("[data-lightbox-active-image]");
      this.captionEl = overlay.querySelector("[data-lightbox-caption]");
      this.thumbnailsEl = overlay.querySelector("[data-lightbox-thumbnails]");
      this.closeButtons = overlay.querySelectorAll("[data-lightbox-close]");
      this.prevButton = overlay.querySelector("[data-lightbox-prev]");
      this.nextButton = overlay.querySelector("[data-lightbox-next]");

      this.groups = new Map();
      this.thumbnailButtons = [];
      this.preloaded = new Set();
      this._navLock = false;

      const fallbackSlug = window.location.pathname
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      this.defaultGroupId = fallbackSlug ? `page-${fallbackSlug}` : "page-root";
      this.activeGroupId = null;
      this.activeItems = [];
      this.activeIndex = 0;
      this.lastFocused = null;
      this.boundHandlers = false;
      this.themeObserver = null;
      this.prefersDarkMedia = null;
      this.mediaListenerAttached = false;
      this.boundMediaChange = null;
      this.themeTimer = null;
      this.themeResetDelay = 200;

      if (this.shell && !this.shell.hasAttribute("tabindex")) {
        this.shell.setAttribute("tabindex", "-1");
      }
    }

    init() {
      if (!this.overlay || !this.imageEl) return;
      this.collectItems();
      if (this.groups.size === 0) return;
      this.bindControls();
    }

    collectItems() {
      const triggers = Array.from(
        document.querySelectorAll("[data-lightbox-item]")
      );

      triggers.forEach((trigger) => {
        if (!trigger || trigger.dataset.lightboxReady === "true") return;

        const groupId = this.resolveGroupId(trigger);
        if (!this.groups.has(groupId)) {
          this.groups.set(groupId, []);
        }

        const groupItems = this.groups.get(groupId);
        const item = {
          element: trigger,
          groupId,
          getSource: () =>
            trigger.dataset.lightboxSrc || trigger.currentSrc || trigger.src,
          getThumb: () =>
            trigger.dataset.lightboxThumb || trigger.currentSrc || trigger.src,
          getCaption: () =>
            trigger.dataset.lightboxCaption ||
            trigger.getAttribute("alt") ||
            "",
        };

        item.index = groupItems.length;
        groupItems.push(item);

        trigger.dataset.lightboxReady = "true";
        trigger.dataset.lightboxGroupResolved = groupId;
        trigger.dataset.lightboxIndex = String(item.index);

        if (!trigger.hasAttribute("tabindex")) {
          trigger.tabIndex = 0;
        }

        const openFromTrigger = (event) => {
          event.preventDefault();
          this.open(groupId, item.index);
        };

        trigger.addEventListener("click", openFromTrigger);
        trigger.addEventListener("keydown", (event) => {
          if (event.defaultPrevented) return;
          const key = event.key;
          if (
            key === "Enter" ||
            key === " " ||
            key === "Space" ||
            key === "Spacebar"
          ) {
            openFromTrigger(event);
          }
        });
      });
    }

    resolveGroupId(trigger) {
      const direct = (trigger.dataset.lightboxGroup || "").trim();
      if (direct) return direct;
      const ancestor = trigger.closest("[data-lightbox-group]");
      if (ancestor && ancestor.dataset.lightboxGroup) {
        return ancestor.dataset.lightboxGroup;
      }
      return this.defaultGroupId;
    }

    bindControls() {
      this.closeButtons.forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          this.close();
        });
      });

      this.prevButton?.addEventListener("click", (event) => {
        event.preventDefault();
        this.showPrevious();
      });

      this.nextButton?.addEventListener("click", (event) => {
        event.preventDefault();
        this.showNext();
      });
    }

    open(groupId, index = 0) {
      this.collectItems();
      const group = this.groups.get(groupId);
      if (!group || group.length === 0) return;

      this.activeGroupId = groupId;
      this.activeItems = group;
      this.activeIndex = this.normalizeIndex(index);
      this.lastFocused = document.activeElement;
      this._navLock = false;

      this.overlay.classList.add("is-active");
      this.overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("lightbox-open");
      const overlayController = window.__overlayChromeController;
      const canUseController =
        overlayController && typeof overlayController.open === "function";

      if (canUseController) {
        overlayController.open("lightbox");
      } else {
        this.clearThemeTimer();
        this.updateThemeColor();
        this.startThemeWatchers();
      }

      this.buildThumbnails();
      this.showIndex(this.activeIndex, { focusThumbnail: false });
      this.attachGlobalHandlers();
      this.focusPrimaryControl();
    }

    showIndex(index, { focusThumbnail = true } = {}) {
      if (!this.activeItems || this.activeItems.length === 0) {
        this._navLock = false;
        return;
      }

      this.activeIndex = this.normalizeIndex(index);
      this.renderActiveItem();
      this.updateControls();
      this.updateThumbnails({ focusCurrent: focusThumbnail });
      this.preloadAdjacent();
      this._navLock = false;
    }

    showNext() {
      if (this._navLock) return;
      this._navLock = true;
      this.showIndex(this.activeIndex + 1);
    }

    showPrevious() {
      if (this._navLock) return;
      this._navLock = true;
      this.showIndex(this.activeIndex - 1);
    }

    normalizeIndex(index) {
      if (!this.activeItems || this.activeItems.length === 0) return 0;
      const count = this.activeItems.length;
      const normalized = ((index % count) + count) % count;
      return normalized;
    }

    renderActiveItem() {
      const item = this.activeItems[this.activeIndex];
      if (!item) return;

      const src = item.getSource();
      if (src && this.imageEl.src !== src) {
        this.imageEl.src = src;
      }

      const caption = item.getCaption().trim();
      this.imageEl.alt = caption;

      if (this.captionEl) {
        if (caption) {
          this.captionEl.textContent = caption;
          this.captionEl.hidden = false;
        } else {
          this.captionEl.textContent = "";
          this.captionEl.hidden = true;
        }
      }
    }

    updateControls() {
      const hasMultiple = this.activeItems.length > 1;

      if (this.prevButton) {
        this.prevButton.disabled = !hasMultiple;
        this.prevButton.hidden = !hasMultiple;
      }

      if (this.nextButton) {
        this.nextButton.disabled = !hasMultiple;
        this.nextButton.hidden = !hasMultiple;
      }

      if (this.thumbnailsEl) {
        if (!hasMultiple) {
          this.thumbnailsEl.hidden = true;
        } else {
          this.thumbnailsEl.hidden = false;
        }
      }
    }

    buildThumbnails() {
      if (!this.thumbnailsEl) return;

      this.thumbnailsEl.innerHTML = "";
      this.thumbnailButtons = [];

      if (!this.activeItems || this.activeItems.length <= 1) {
        this.thumbnailsEl.hidden = true;
        return;
      }

      this.thumbnailsEl.hidden = false;

      this.activeItems.forEach((item, idx) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "image-lightbox__thumbnail";
        button.setAttribute("data-index", String(idx));
        button.setAttribute("role", "listitem");

        const thumbImg = document.createElement("img");
        thumbImg.loading = "lazy";
        thumbImg.decoding = "async";
        const thumbSrc = item.getThumb();
        if (thumbSrc) {
          thumbImg.src = thumbSrc;
        }
        const caption = item.getCaption().trim();
        thumbImg.alt = caption ? `${caption} thumbnail` : `Image ${idx + 1}`;

        button.appendChild(thumbImg);
        button.addEventListener("click", (event) => {
          event.preventDefault();
          this.showIndex(idx, { focusThumbnail: false });
        });

        this.thumbnailsEl.appendChild(button);
        this.thumbnailButtons.push(button);
      });
    }

    updateThumbnails({ focusCurrent = false } = {}) {
      if (!this.thumbnailButtons.length) return;

      this.thumbnailButtons.forEach((button, idx) => {
        if (idx === this.activeIndex) {
          button.classList.add("is-active");
          if (focusCurrent) {
            button.focus({ preventScroll: true });
          }
          requestAnimationFrame(() => {
            button.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "center",
            });
          });
        } else {
          button.classList.remove("is-active");
        }
      });
    }

    preloadAdjacent() {
      if (!this.activeItems || this.activeItems.length <= 1) return;

      const count = this.activeItems.length;
      const neighborIndexes = [
        (this.activeIndex + 1) % count,
        (this.activeIndex - 1 + count) % count,
      ];

      neighborIndexes.forEach((idx) => {
        const item = this.activeItems[idx];
        if (!item) return;
        const src = item.getSource();
        if (!src || this.preloaded.has(src)) return;
        this.preloaded.add(src);
        const img = new Image();
        img.src = src;
      });
    }

    close() {
      if (!this.overlay.classList.contains("is-active")) return;

      this.overlay.classList.remove("is-active");
      this.overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("lightbox-open");
      const overlayControllerClose = window.__overlayChromeController;
      const canUseControllerClose =
        overlayControllerClose &&
        typeof overlayControllerClose.close === "function" &&
        overlayControllerClose.hasActiveOverlays &&
        overlayControllerClose.hasActiveOverlays();

      if (canUseControllerClose) {
        overlayControllerClose.close("lightbox");
      } else {
        this.stopThemeWatchers();
        this.scheduleThemeReset();
      }
      this._navLock = false;

      this.detachGlobalHandlers();

      if (this.thumbnailsEl) {
        this.thumbnailsEl.hidden = true;
      }

      this.activeGroupId = null;
      this.activeItems = [];
      this.activeIndex = 0;

      const toFocus = this.lastFocused;
      this.lastFocused = null;
      if (toFocus && typeof toFocus.focus === "function") {
        setTimeout(() => toFocus.focus(), 0);
      }
    }

    attachGlobalHandlers() {
      if (this.boundHandlers) return;
      this.keydownHandler = (event) => this.onKeydown(event);
      this.focusHandler = (event) => this.handleFocusIn(event);
      document.addEventListener("keydown", this.keydownHandler);
      document.addEventListener("focusin", this.focusHandler);
      this.boundHandlers = true;
    }

    detachGlobalHandlers() {
      if (!this.boundHandlers) return;
      if (this.keydownHandler) {
        document.removeEventListener("keydown", this.keydownHandler);
      }
      if (this.focusHandler) {
        document.removeEventListener("focusin", this.focusHandler);
      }
      this.boundHandlers = false;
    }

    onKeydown(event) {
      if (!this.overlay.classList.contains("is-active")) return;

      switch (event.key) {
        case "Escape":
          event.preventDefault();
          this.close();
          break;
        case "ArrowRight":
          event.preventDefault();
          this.showNext();
          break;
        case "ArrowLeft":
          event.preventDefault();
          this.showPrevious();
          break;
        case "Home":
          event.preventDefault();
          this.showIndex(0);
          break;
        case "End":
          event.preventDefault();
          this.showIndex(this.activeItems.length - 1);
          break;
        default:
          break;
      }
    }

    handleFocusIn(event) {
      if (!this.overlay.classList.contains("is-active")) return;
      if (!this.shell) return;
      if (this.shell.contains(event.target)) return;
      this.focusPrimaryControl();
    }

    focusPrimaryControl() {
      const target = this.closeButtons?.[0] || this.shell;
      if (target && typeof target.focus === "function") {
        target.focus({ preventScroll: true });
      }
    }

    ensureMetaThemeTag() {
      let meta = document.querySelector("meta[name='theme-color']");
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        document.head.appendChild(meta);
      }
      return meta;
    }

    updateThemeColor() {
      const meta = this.ensureMetaThemeTag();
      const isDark = document.documentElement.classList.contains("dark");
      const controller = window.__overlayChromeController;
      if (controller && typeof controller.getColorFor === "function") {
        meta.content = controller.getColorFor("lightbox", isDark);
        return;
      }
      meta.content = isDark ? "#14161d" : "#e4e3e1";
    }

    resetThemeColor() {
      const meta = document.querySelector("meta[name='theme-color']");
      if (meta) {
        meta.content = "#ffffff";
      }
    }

    startThemeWatchers() {
      if (!this.themeObserver) {
        this.themeObserver = new MutationObserver(() =>
          this.updateThemeColor()
        );
        this.themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });
      }

      if (!this.boundMediaChange) {
        this.boundMediaChange = () => this.updateThemeColor();
      }
      if (!this.prefersDarkMedia && window.matchMedia) {
        try {
          this.prefersDarkMedia = window.matchMedia(
            "(prefers-color-scheme: dark)"
          );
        } catch (error) {
          this.prefersDarkMedia = null;
        }
      }

      if (this.prefersDarkMedia && !this.mediaListenerAttached) {
        const media = this.prefersDarkMedia;
        if (typeof media.addEventListener === "function") {
          media.addEventListener("change", this.boundMediaChange);
          this.mediaListenerAttached = true;
        } else if (typeof media.addListener === "function") {
          media.addListener(this.boundMediaChange);
          this.mediaListenerAttached = true;
        }
      }
    }

    stopThemeWatchers() {
      if (this.themeObserver) {
        this.themeObserver.disconnect();
        this.themeObserver = null;
      }

      if (this.prefersDarkMedia && this.mediaListenerAttached) {
        const media = this.prefersDarkMedia;
        if (typeof media.removeEventListener === "function") {
          media.removeEventListener("change", this.boundMediaChange);
        } else if (typeof media.removeListener === "function") {
          media.removeListener(this.boundMediaChange);
        }
        this.mediaListenerAttached = false;
      }
    }

    clearThemeTimer() {
      if (this.themeTimer) {
        clearTimeout(this.themeTimer);
        this.themeTimer = null;
      }
    }

    scheduleThemeReset() {
      this.clearThemeTimer();
      this.themeTimer = setTimeout(() => {
        this.resetThemeColor();
        this.themeTimer = null;
      }, this.themeResetDelay);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.getElementById("lightbox");
    if (!overlay) return;
    const gallery = new LightboxGallery(overlay);
    gallery.init();
  });
})();

// Footnote navigation enhancement
(() => {
  document.addEventListener("DOMContentLoaded", () => {
    // Add IDs to footnote references in the text
    const footnoteRefs = document.querySelectorAll(".article-footnote-ref");
    footnoteRefs.forEach((ref) => {
      const link = ref.querySelector("a[href^='#fn']");
      if (!link) return;

      // Extract the footnote id from the href (e.g., "#fn1" -> "1")
      const match = link.getAttribute("href")?.match(/^#fn(.+)$/);
      if (!match) return;

      const footnoteId = match[1];
      const refId = `fnref${footnoteId}`;

      // Add the ID to the sup element
      if (!ref.id) {
        ref.id = refId;
      }
    });

    // Handle back arrow clicks with smooth scrolling
    const backRefs = document.querySelectorAll(".article-footnote-backref");
    backRefs.forEach((backRef) => {
      backRef.addEventListener("click", (e) => {
        const href = backRef.getAttribute("href");
        if (!href) return;

        const targetId = href.replace("#", "");
        const target = document.getElementById(targetId);

        if (!target) return;
        e.preventDefault();

        // Smooth scroll with offset for header
        const offsetTop =
          target.getBoundingClientRect().top + window.pageYOffset - 100;

        try {
          window.scrollTo({
            top: offsetTop,
            behavior: "smooth",
          });
        } catch (error) {
          window.scrollTo(0, offsetTop);
        }

        // Optional: Add a brief highlight effect
        target.style.transition = "background-color 0.3s ease";
        target.style.backgroundColor = "var(--bg-hover)";
        setTimeout(() => {
          target.style.backgroundColor = "";
        }, 800);
      });
    });
  });
})();
