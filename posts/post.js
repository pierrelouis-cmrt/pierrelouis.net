(() => {
  const page = document.querySelector(".post-page");

  if (!page) {
    return;
  }

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const revealItems = document.querySelectorAll(
    ".post-body > *, .post-endmatter__inner",
  );
  const lightbox = document.querySelector("[data-post-lightbox]");
  const lightboxImage = lightbox?.querySelector("[data-post-lightbox-image]");
  const lightboxCounter = lightbox?.querySelector(
    "[data-post-lightbox-counter]",
  );
  const lightboxNav = lightbox?.querySelector("[data-post-lightbox-nav]");
  const lightboxPrev = lightbox?.querySelector("[data-post-lightbox-prev]");
  const lightboxNext = lightbox?.querySelector("[data-post-lightbox-next]");
  const lightboxCloseButtons = [
    ...(lightbox?.querySelectorAll("[data-post-lightbox-close]") || []),
  ];
  const lightboxItems = [
    ...document.querySelectorAll("[data-post-lightbox-item]"),
  ];
  let lightboxIndex = -1;
  let lastFocusedElement = null;

  page.classList.add("has-post-motion");

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      page.classList.add("is-post-ready");
    });
  });

  if (!("IntersectionObserver" in window) || reducedMotion) {
    revealItems.forEach((item) => item.classList.add("is-reveal-visible"));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-reveal-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -6% 0px",
        threshold: 0.06,
      },
    );

    revealItems.forEach((item) => revealObserver.observe(item));
  }

  const setLightboxImage = (index) => {
    if (!lightboxImage || lightboxItems.length === 0) {
      return;
    }

    lightboxIndex = (index + lightboxItems.length) % lightboxItems.length;

    const sourceImage = lightboxItems[lightboxIndex].querySelector("img");

    if (!sourceImage) {
      return;
    }

    lightboxImage.src = sourceImage.currentSrc || sourceImage.src;
    lightboxImage.alt = sourceImage.alt;

    if (lightboxCounter) {
      const digits = Math.max(2, String(lightboxItems.length).length);
      const current = String(lightboxIndex + 1).padStart(digits, "0");
      const total = String(lightboxItems.length).padStart(digits, "0");
      lightboxCounter.textContent = `${current}/${total}`;
    }
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
    document.body.classList.remove("has-post-lightbox-open");

    if (lightboxImage) {
      lightboxImage.removeAttribute("src");
      lightboxImage.alt = "";
    }

    if (lightboxCounter) {
      lightboxCounter.textContent = "";
    }

    lastFocusedElement?.focus();
    lastFocusedElement = null;
    lightboxIndex = -1;
  };

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-post-lightbox-item]");

    if (!trigger || !lightbox || !lightboxImage) {
      return;
    }

    lastFocusedElement = trigger;
    setLightboxImage(lightboxItems.indexOf(trigger));

    if (lightboxNav) {
      lightboxNav.hidden = lightboxItems.length <= 1;
    }

    lightbox.hidden = false;
    document.body.classList.add("has-post-lightbox-open");
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
    if (!lightbox || lightbox.hidden) {
      return;
    }

    if (event.key === "Escape") {
      closeLightbox();
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      cycleLightbox(event.key === "ArrowRight" ? 1 : -1);
    }
  });

  document.querySelectorAll("[data-post-gallery]").forEach((gallery) => {
    const viewport = gallery.querySelector("[data-gallery-viewport]");

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
        behavior: reducedMotion ? "auto" : "smooth",
      });
    });

    viewport.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0) {
        return;
      }

      if (event.target.closest("a[href]")) {
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
})();
