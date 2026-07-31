(() => {
  const root = document.querySelector("[data-photo-filters]");

  if (!root) {
    return;
  }

  const buttons = [...root.querySelectorAll("[data-country-filter]")];
  const searchInput = root.querySelector("[data-photo-search]");
  const emptyState = root.querySelector("[data-photo-empty]");
  const albums = [...document.querySelectorAll(".photo-album")];
  const lightbox = document.querySelector("[data-photo-lightbox]");
  const lightboxImage = lightbox?.querySelector("[data-photo-lightbox-image]");
  const lightboxCounter = lightbox?.querySelector("[data-photo-lightbox-counter]");
  const lightboxNav = lightbox?.querySelector("[data-photo-lightbox-nav]");
  const lightboxPrev = lightbox?.querySelector("[data-photo-lightbox-prev]");
  const lightboxNext = lightbox?.querySelector("[data-photo-lightbox-next]");
  const lightboxCloseButtons = [
    ...(lightbox?.querySelectorAll("[data-photo-lightbox-close]") || []),
  ];
  let lastFocusedElement = null;
  let lightboxItems = [];
  let lightboxIndex = -1;

  const state = {
    albumId: "",
    country: "all",
    query: "",
  };

  const setupRevealMotion = () => {
    const page = document.querySelector(".photos-page");
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!page || prefersReducedMotion) {
      return;
    }

    const intro = page.querySelector(".photos-intro");
    const revealTargets = [
      ...page.querySelectorAll(".photo-album__header, .photo-card"),
    ];
    const revealTarget = (target) => {
      target.classList.add("is-reveal-visible");
    };

    page.classList.add("has-photo-reveal-motion");

    for (const image of page.querySelectorAll(".photo-card__image")) {
      const card = image.closest(".photo-card");
      const markLoaded = () => card?.classList.add("is-image-loaded");

      if (image.complete && image.currentSrc) {
        markLoaded();
      } else {
        image.addEventListener("load", markLoaded, { once: true });
        image.addEventListener("error", markLoaded, { once: true });
      }
    }

    const startReveal = () => {
      intro?.classList.add("is-reveal-visible");

      if (!("IntersectionObserver" in window)) {
        revealTargets.forEach(revealTarget);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) {
              continue;
            }

            revealTarget(entry.target);
            observer.unobserve(entry.target);
          }
        },
        {
          rootMargin: "0px 0px -8% 0px",
          threshold: 0.08,
        },
      );

      revealTargets.forEach((target) => observer.observe(target));
    };

    // Let the browser paint the hidden state once before observing visible
    // content. Otherwise the initial observer callback can beat first paint.
    requestAnimationFrame(() => {
      requestAnimationFrame(startReveal);
    });
  };

  // Small, gallery-specific groups outperform a remote thesaurus here: they are
  // instant, predictable, and work offline. Every word in a group is equivalent.
  const SEARCH_SYNONYM_GROUPS = [
    ["architecture", "building", "structure"],
    ["city", "urban"],
    ["historic", "historical", "heritage", "old"],
    ["modern", "modernist", "contemporary"],
    ["sea", "ocean"],
    ["coast", "coastal", "seaside", "shore", "shoreline"],
    ["waterfront", "harbour", "harbor"],
    ["mountain", "mountains", "alpine"],
    ["forest", "woodland", "woods"],
    ["sunset", "dusk", "twilight"],
    ["calm", "peaceful", "serene", "tranquil"],
    ["quiet", "still", "secluded"],
    ["bright", "sunny", "luminous", "glowing"],
    ["moody", "atmospheric", "dramatic", "cinematic"],
    ["warm", "cozy", "cosy", "intimate"],
    ["grand", "majestic", "monumental", "stately"],
    ["green", "verdant"],
    ["grey", "gray", "silver", "slate"],
    ["gold", "golden", "amber", "ochre"],
    ["red", "crimson", "coral", "burgundy"],
  ];
  const SEARCH_STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "at",
    "from",
    "in",
    "of",
    "on",
    "the",
    "with",
  ]);

  const normalize = (value) => {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  };

  const searchSynonyms = new Map();

  for (const group of SEARCH_SYNONYM_GROUPS) {
    for (const term of group) {
      searchSynonyms.set(term, group);
    }
  }

  const getQueryTerms = (query) => {
    return [
      ...new Set(
        normalize(query)
          .split(/\s+/)
          .filter((term) => term && !SEARCH_STOP_WORDS.has(term)),
      ),
    ];
  };

  const matchesQuery = (searchText, query) => {
    const terms = getQueryTerms(query);
    const searchWords = new Set(searchText.split(/\s+/).filter(Boolean));

    return terms.every((term) => {
      const alternatives = searchSynonyms.get(term) || [term];
      return alternatives.some((alternative) => {
        if (searchWords.has(alternative)) {
          return true;
        }

        // Preserve convenient partial typing for the word the user entered,
        // without allowing short terms such as "old" to match "gold".
        return alternative === term && term.length >= 3
          ? [...searchWords].some((word) => word.startsWith(term))
          : false;
      });
    });
  };

  const toUrlValue = (value) => {
    return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };

  const getFilterFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const rawQuery = window.location.search.slice(1);
    let bareFilter = "";

    if (!rawQuery.includes("=") && !rawQuery.includes("&")) {
      try {
        bareFilter = decodeURIComponent(rawQuery.replace(/\+/g, " "));
      } catch {
        bareFilter = rawQuery;
      }
    }

    const requestedFilter =
      params.get("album") ||
      params.get("place") ||
      params.get("country") ||
      bareFilter;
    const requestedValue = toUrlValue(requestedFilter);
    const matchingButton = buttons.find((button) => {
      return toUrlValue(button.dataset.countryFilter) === requestedValue;
    });

    if (matchingButton) {
      return {
        albumId: "",
        country: matchingButton.dataset.countryFilter || "all",
      };
    }

    const matchingAlbum = albums.find((album) => {
      return [album.dataset.albumId, album.dataset.place].some((value) => {
        return toUrlValue(value) === requestedValue;
      });
    });

    return {
      albumId: matchingAlbum?.dataset.albumId || "",
      country: "all",
    };
  };

  const updateCountryUrl = () => {
    const url = new URL(window.location.href);
    const countryValue = toUrlValue(state.country);

    url.search = state.country === "all" ? "" : `?${countryValue}`;

    if (url.href === window.location.href) {
      return;
    }

    window.history.pushState({ country: state.country }, "", url);
  };

  const getAlbumCards = (album) => {
    return [...album.querySelectorAll(".photo-card")];
  };

  const getCardSearchText = (card, album) => {
    return normalize(`${album.dataset.search || ""} ${card.dataset.search || ""}`);
  };

  const updateButton = (button, counts) => {
    const country = button.dataset.countryFilter;
    // A direct album link is a narrower scope than any country filter. Keep
    // every country button unselected so the controls describe what is
    // actually being shown instead of incorrectly presenting the album as
    // the unfiltered "All" view.
    const isActive = !state.albumId && country === state.country;
    const count = button.querySelector("[data-filter-count]");

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));

    if (count) {
      count.hidden = !isActive;
      count.textContent = counts.get(country) || 0;
    }
  };

  const applyFilters = () => {
    const counts = new Map();
    let visibleTotal = 0;

    counts.set("all", 0);

    for (const album of albums) {
      const albumCountry = album.dataset.country || "";
      const matchesAlbum =
        !state.albumId || album.dataset.albumId === state.albumId;
      const matchesCountry =
        state.country === "all" || albumCountry === state.country;
      let visibleInAlbum = 0;

      for (const card of getAlbumCards(album)) {
        const matchesSearch = matchesQuery(getCardSearchText(card, album), state.query);
        const isVisible = matchesAlbum && matchesCountry && matchesSearch;

        card.hidden = !isVisible;

        if (matchesAlbum && matchesSearch) {
          counts.set("all", (counts.get("all") || 0) + 1);
          counts.set(albumCountry, (counts.get(albumCountry) || 0) + 1);
        }

        if (isVisible) {
          visibleInAlbum += 1;
          visibleTotal += 1;
        }
      }

      album.hidden = visibleInAlbum === 0;
    }

    for (const button of buttons) {
      updateButton(button, counts);
    }

    if (emptyState) {
      emptyState.hidden = visibleTotal !== 0;
    }
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      state.albumId = "";
      state.country = button.dataset.countryFilter || "all";
      updateCountryUrl();
      applyFilters();
    });
  }

  window.addEventListener("popstate", () => {
    Object.assign(state, getFilterFromUrl());
    applyFilters();
  });

  searchInput?.addEventListener("input", () => {
    state.query = searchInput.value;
    applyFilters();
  });

  const setLightboxImage = (index) => {
    if (!lightboxImage || lightboxItems.length === 0) {
      return;
    }

    lightboxIndex = (index + lightboxItems.length) % lightboxItems.length;

    const trigger = lightboxItems[lightboxIndex];
    lightboxImage.src = trigger.dataset.fullSrc || "";
    lightboxImage.alt = trigger.dataset.alt || "";

    if (lightboxCounter) {
      const digits = Math.max(2, String(lightboxItems.length).length);
      const current = String(lightboxIndex + 1).padStart(digits, "0");
      const total = String(lightboxItems.length).padStart(digits, "0");
      lightboxCounter.textContent = `${current}/${total}`;
    }
  };

  const getLightboxItems = (trigger) => {
    const album = trigger.closest(".photo-album");

    return album
      ? [
          ...album.querySelectorAll(
            ".photo-card:not([hidden]) [data-photo-zoom]",
          ),
        ]
      : [trigger];
  };

  const cycleLightbox = (direction) => {
    if (!lightbox || lightbox.hidden || lightboxItems.length <= 1) {
      return;
    }

    setLightboxImage(lightboxIndex + direction);
  };

  const closeLightbox = () => {
    if (!lightbox || lightbox.hidden) {
      return;
    }

    lightbox.hidden = true;
    document.body.classList.remove("has-photo-lightbox-open");

    if (lightboxImage) {
      lightboxImage.removeAttribute("src");
      lightboxImage.alt = "";
    }

    if (lightboxCounter) {
      lightboxCounter.textContent = "";
    }

    lastFocusedElement?.focus();
    lastFocusedElement = null;
    lightboxItems = [];
    lightboxIndex = -1;
  };

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-photo-zoom]");

    if (!trigger || !lightbox || !lightboxImage) {
      return;
    }

    lastFocusedElement = trigger;
    lightboxItems = getLightboxItems(trigger);
    setLightboxImage(lightboxItems.indexOf(trigger));

    if (lightboxNav) {
      lightboxNav.hidden = false;
    }

    if (lightboxPrev && lightboxNext) {
      const hasMultipleItems = lightboxItems.length > 1;
      lightboxPrev.hidden = !hasMultipleItems;
      lightboxNext.hidden = !hasMultipleItems;
    }

    lightbox.hidden = false;
    document.body.classList.add("has-photo-lightbox-open");
    lightboxCloseButtons.at(-1)?.focus();
  });

  for (const button of lightboxCloseButtons) {
    button.addEventListener("click", closeLightbox);
  }

  lightboxPrev?.addEventListener("click", () => {
    cycleLightbox(-1);
  });

  lightboxNext?.addEventListener("click", () => {
    cycleLightbox(1);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLightbox();
    }

    if (event.key === "ArrowLeft") {
      cycleLightbox(-1);
    }

    if (event.key === "ArrowRight") {
      cycleLightbox(1);
    }
  });

  Object.assign(state, getFilterFromUrl());
  applyFilters();
  setupRevealMotion();
})();
