// Theme

document.addEventListener("alpine:init", () => {
  Alpine.store("theme", {
    mode: "system",

    init() {
      // Check for saved theme preference
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "dark") {
        this.dark();
      } else if (savedTheme === "light") {
        this.light();
      } else {
        this.system();
      }

      // Watch for system theme changes
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", () => {
          if (this.mode === "system") {
            this.applySystemTheme();
          }
        });
    },

    toggle() {
      if (this.mode === "system") {
        this.light();
      } else if (this.mode === "light") {
        this.dark();
      } else {
        this.system();
      }
    },

    dark() {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      this.mode = "dark";
    },

    light() {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      this.mode = "light";
    },

    system() {
      localStorage.removeItem("theme");
      this.mode = "system";
      this.applySystemTheme();
    },

    applySystemTheme() {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    },
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
  u: "/uses",
  c: "/colophon",
  l: "/links",
  e: "mailto:contact@pierrelouis.net?subject=Hi,%20I'm%20....%20and...%20",
};

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
function openLightbox(src) {
  const img = document.getElementById("lightbox-img");
  const box = document.getElementById("lightbox");
  if (!img || !box) return;
  img.src = src;
  box.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const box = document.getElementById("lightbox");
  if (!box) return;
  box.style.display = "none";
  document.body.style.overflow = "auto";
}

window.addEventListener("click", (e) => {
  const box = document.getElementById("lightbox");
  if (box && e.target === box) {
    closeLightbox();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeLightbox();
  }
});

// Global keyboard shortcut to toggle the command palette
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  }
});

// Handle "n" prefix navigation shortcuts
let nPrefix = false;
let nPrefixTimeout;
document.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (nPrefix) {
    const active = document.activeElement.tagName;
    if (
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      (window.SHORTCUT_MAP[key] || key === "t")
    ) {
      if (["INPUT", "TEXTAREA"].includes(active)) {
        nPrefix = false;
        return;
      }
      e.preventDefault();
      if (key === "t") {
        if (window.Alpine) Alpine.store("theme").toggle();
      } else {
        const target = window.SHORTCUT_MAP[key];
        if (target) window.location.href = target;
      }
    }
    nPrefix = false;
    return;
  }

  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && key === "n") {
    nPrefix = true;
    clearTimeout(nPrefixTimeout);
    nPrefixTimeout = setTimeout(() => {
      nPrefix = false;
    }, 1000);
  }
});
