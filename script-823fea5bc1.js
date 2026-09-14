const SELECTORS = {
  copyEmail: "[data-copy-email]",
  moreMenu: "[data-more-menu]",
  moreMenuToggle: "[data-more-menu-toggle]",
  moreMenuPanel: "[data-more-menu-panel]",
  mobileMenu: "[data-mobile-menu]",
  mobileMenuToggle: "[data-mobile-menu-toggle]",
  mobileMenuPanel: "[data-mobile-menu-panel]",
  siteHeader: ".site-header",
};

const LABELS = {
  moreMenuOpen: "More ↓",
  moreMenuClose: "Close ↑",
  mobileMenuOpen: "Open menu",
  mobileMenuClose: "Close menu",
  emailCopied: "Email Copied",
};

const TIMING = {
  moreMenuCloseDelay: 220,
  mobileMenuCloseDelay: 420,
  emailCopiedDelay: 1800,
};

const MOBILE_HEADER = {
  mediaQuery: "(max-width: 760px)",
  hideAfterY: 90,
  directionThreshold: 12,
};

const EXTERNAL_PROTOCOLS = new Set(["http:", "https:"]);

const configureExternalLink = (link) => {
  const href = link.getAttribute("href");

  if (!href) {
    return;
  }

  try {
    const url = new URL(href, document.baseURI);

    if (
      !EXTERNAL_PROTOCOLS.has(url.protocol) ||
      url.origin === window.location.origin
    ) {
      return;
    }

    link.target = "_blank";
    link.relList.add("noopener", "noreferrer");
  } catch {
    // Ignore malformed URLs and leave them unchanged.
  }
};

const setupExternalLinks = () => {
  document.querySelectorAll("a[href]").forEach(configureExternalLink);

  if (!document.body || !("MutationObserver" in window)) {
    return;
  }

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        configureExternalLink(mutation.target);
        continue;
      }

      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) {
          continue;
        }

        if (node.matches("a[href]")) {
          configureExternalLink(node);
        }

        node.querySelectorAll("a[href]").forEach(configureExternalLink);
      }
    }
  }).observe(document.body, {
    attributes: true,
    attributeFilter: ["href"],
    childList: true,
    subtree: true,
  });
};

setupExternalLinks();

const copyEmailLink = document.querySelector(SELECTORS.copyEmail);
const moreMenu = document.querySelector(SELECTORS.moreMenu);
const moreMenuToggle = document.querySelector(SELECTORS.moreMenuToggle);
const moreMenuPanel = document.querySelector(SELECTORS.moreMenuPanel);
const mobileMenu = document.querySelector(SELECTORS.mobileMenu);
const mobileMenuToggle = document.querySelector(SELECTORS.mobileMenuToggle);
const mobileMenuPanel = document.querySelector(SELECTORS.mobileMenuPanel);
const siteHeader = document.querySelector(SELECTORS.siteHeader);

const setupDeferredMedia = () => {
  const media = [
    ...document.querySelectorAll(
      "img[data-deferred-src], video[data-deferred-src]",
    ),
  ];
  const loadMedia = (item) => {
    if (!item.dataset.deferredSrc) {
      return;
    }

    item
      .closest("picture")
      ?.querySelectorAll("source[data-deferred-srcset]")
      .forEach((source) => {
        source.srcset = source.dataset.deferredSrcset;
        source.removeAttribute("data-deferred-srcset");
      });
    item.src = item.dataset.deferredSrc;
    item.removeAttribute("data-deferred-src");

    if (item instanceof HTMLVideoElement) {
      item.load();
    }
  };

  if (!("IntersectionObserver" in window)) {
    media.forEach(loadMedia);
    return;
  }

  const observeMedia = (targets, rootMargin) => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          loadMedia(entry.target);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin },
    );

    targets.forEach((image) => observer.observe(image));
  };

  const galleryImages = media.filter((item) =>
    item.classList.contains("photo-card__image"),
  );
  const otherMedia = media.filter(
    (item) => !item.classList.contains("photo-card__image"),
  );

  // Photo rows are tall on narrow screens, so fetch them farther ahead than
  // ordinary deferred media. This keeps the reveal imperceptible in a scroll
  // without eagerly downloading the entire gallery.
  observeMedia(galleryImages, "1100px 300px");
  observeMedia(otherMedia, "500px 300px");
};

setupDeferredMedia();

if (moreMenu && moreMenuToggle && moreMenuPanel) {
  const moreMenuOpenLabel =
    moreMenuToggle.dataset.moreMenuOpenLabel || LABELS.moreMenuOpen;
  const moreMenuCloseLabel =
    moreMenuToggle.dataset.moreMenuCloseLabel || LABELS.moreMenuClose;

  const openMenu = () => {
    moreMenu.classList.add("is-open");
    moreMenuToggle.setAttribute("aria-expanded", "true");
    moreMenuToggle.textContent = moreMenuCloseLabel;
    moreMenuPanel.hidden = false;
  };

  const closeMenu = () => {
    if (!moreMenu.classList.contains("is-open")) {
      return;
    }

    moreMenu.classList.remove("is-open");
    moreMenuToggle.setAttribute("aria-expanded", "false");
    moreMenuToggle.textContent = moreMenuOpenLabel;
    window.setTimeout(() => {
      if (!moreMenu.classList.contains("is-open")) {
        moreMenuPanel.hidden = true;
      }
    }, TIMING.moreMenuCloseDelay);
  };

  const dismissMenuOnPageClick = (event) => {
    if (
      !moreMenu.classList.contains("is-open") ||
      moreMenuToggle.contains(event.target)
    ) {
      return;
    }

    closeMenu();
  };

  moreMenuToggle.addEventListener("click", () => {
    if (moreMenu.classList.contains("is-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  document.addEventListener("click", dismissMenuOnPageClick, true);
  window.addEventListener("scroll", closeMenu, { passive: true });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && moreMenu.classList.contains("is-open")) {
      closeMenu();
      moreMenuToggle.focus();
    }
  });
}

if (mobileMenu && mobileMenuToggle && mobileMenuPanel) {
  let mobileMenuCloseTimer;

  const openMobileMenu = () => {
    window.clearTimeout(mobileMenuCloseTimer);
    mobileMenuPanel.hidden = false;
    document.body.style.setProperty(
      "--mobile-menu-scroll-y",
      `${window.visualViewport?.pageTop ?? window.scrollY}px`,
    );
    document.body.classList.add("has-mobile-menu-open");
    siteHeader?.classList.remove("is-mobile-hidden");
    mobileMenuToggle.setAttribute("aria-expanded", "true");
    mobileMenuToggle.setAttribute("aria-label", LABELS.mobileMenuClose);

    window.requestAnimationFrame(() => {
      mobileMenu.classList.add("is-open");
    });
  };

  const closeMobileMenu = ({ restoreFocus = false } = {}) => {
    mobileMenu.classList.remove("is-open");
    document.body.classList.remove("has-mobile-menu-open");
    document.body.style.removeProperty("--mobile-menu-scroll-y");
    mobileMenuToggle.setAttribute("aria-expanded", "false");
    mobileMenuToggle.setAttribute("aria-label", LABELS.mobileMenuOpen);

    mobileMenuCloseTimer = window.setTimeout(() => {
      if (!mobileMenu.classList.contains("is-open")) {
        mobileMenuPanel.hidden = true;
      }
    }, TIMING.mobileMenuCloseDelay);

    if (restoreFocus) {
      mobileMenuToggle.focus();
    }
  };

  mobileMenuToggle.addEventListener("click", () => {
    if (mobileMenu.classList.contains("is-open")) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  mobileMenuPanel.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      closeMobileMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobileMenu.classList.contains("is-open")) {
      closeMobileMenu({ restoreFocus: true });
    }
  });
}

if (siteHeader) {
  const mobileHeaderQuery = window.matchMedia(MOBILE_HEADER.mediaQuery);
  let lastScrollY = Math.max(window.scrollY, 0);
  let directionStartY = lastScrollY;
  let scrollDirection = null;
  let isTicking = false;

  const showMobileHeader = () => {
    siteHeader.classList.remove("is-mobile-hidden");
  };

  const updateMobileHeader = () => {
    const currentScrollY = Math.max(window.scrollY, 0);
    const delta = currentScrollY - lastScrollY;
    const nextDirection =
      delta > 0 ? "down" : delta < 0 ? "up" : scrollDirection;

    if (
      !mobileHeaderQuery.matches ||
      document.body.classList.contains("has-mobile-menu-open") ||
      currentScrollY <= MOBILE_HEADER.directionThreshold
    ) {
      showMobileHeader();
      directionStartY = currentScrollY;
      scrollDirection = nextDirection;
      lastScrollY = currentScrollY;
      isTicking = false;
      return;
    }

    if (nextDirection !== scrollDirection) {
      scrollDirection = nextDirection;
      directionStartY = lastScrollY;
    }

    const directionDistance = Math.abs(currentScrollY - directionStartY);

    if (
      scrollDirection === "down" &&
      currentScrollY > MOBILE_HEADER.hideAfterY &&
      directionDistance > MOBILE_HEADER.directionThreshold
    ) {
      siteHeader.classList.add("is-mobile-hidden");
    }

    if (
      scrollDirection === "up" &&
      directionDistance > MOBILE_HEADER.directionThreshold
    ) {
      showMobileHeader();
    }

    lastScrollY = currentScrollY;
    isTicking = false;
  };

  const requestMobileHeaderUpdate = () => {
    if (isTicking) {
      return;
    }

    isTicking = true;
    window.requestAnimationFrame(updateMobileHeader);
  };

  const resetMobileHeaderScroll = () => {
    showMobileHeader();
    lastScrollY = Math.max(window.scrollY, 0);
    directionStartY = lastScrollY;
    scrollDirection = null;
  };

  window.addEventListener("scroll", requestMobileHeaderUpdate, {
    passive: true,
  });

  if (typeof mobileHeaderQuery.addEventListener === "function") {
    mobileHeaderQuery.addEventListener("change", resetMobileHeaderScroll);
  } else {
    mobileHeaderQuery.addListener(resetMobileHeaderScroll);
  }
}

if (copyEmailLink) {
  const label = copyEmailLink.textContent;
  const email = copyEmailLink.dataset.email;

  copyEmailLink.addEventListener("click", async (event) => {
    if (!navigator.clipboard || !email) {
      return;
    }

    event.preventDefault();

    try {
      await navigator.clipboard.writeText(email);
      copyEmailLink.textContent = LABELS.emailCopied;
      window.setTimeout(() => {
        copyEmailLink.textContent = label;
      }, TIMING.emailCopiedDelay);
    } catch {
      window.location.href = `mailto:${email}`;
    }
  });
}
