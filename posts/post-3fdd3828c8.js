(() => {
  const page = document.querySelector(".post-page");

  if (!page) {
    return;
  }

  const postBody = document.querySelector(".post-body");
  const headerBackdrop = document.querySelector(
    "[data-post-hero-backdrop]",
  );
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (headerBackdrop && window.parent !== window) {
    window.addEventListener("message", (event) => {
      if (
        event.source === headerBackdrop.contentWindow &&
        event.data?.type === "post-header:ready"
      ) {
        window.parent.postMessage(event.data, "*");
      }
    });
  }

  const getCodeLanguage = (code) => {
    const languageClass = [...code.classList].find((className) =>
      /^(?:lang|language)-/.test(className),
    );
    return (
      languageClass?.replace(/^(?:lang|language)-/, "").toLowerCase() || null
    );
  };

  const copyText = async (value) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  };

  const enhanceCodeBlocks = () => {
    if (!postBody) {
      return [];
    }

    return [...postBody.querySelectorAll("pre > code")].map((code) => {
      const pre = code.parentElement;
      const source = code.textContent.replace(/\n$/, "");
      const lines = source.split("\n");
      const digits = Math.max(2, String(lines.length).length);
      const language = getCodeLanguage(code);
      const shouldCopy =
        pre.hasAttribute("data-code-copy") ||
        code.hasAttribute("data-code-copy");
      const figure = document.createElement("figure");
      const gutter = document.createElement("span");

      figure.className = "post-code-block";
      figure.style.setProperty(
        "--post-code-gutter-width",
        `${Math.max(54, 28 + digits * 8)}px`,
      );
      figure.setAttribute(
        "aria-label",
        language ? `${language} code example` : "Code example",
      );

      if (shouldCopy) {
        figure.classList.add("has-copy-control");
      }

      pre.before(figure);
      figure.append(pre);
      pre.classList.add("post-code");
      pre.tabIndex = 0;

      gutter.className = "post-code__gutter";
      gutter.setAttribute("aria-hidden", "true");
      lines.forEach((_, index) => {
        const line = document.createElement("span");
        line.textContent = String(index + 1);
        gutter.append(line);
      });

      figure.append(gutter);

      if (shouldCopy) {
        const copyButton = document.createElement("button");

        copyButton.className = "post-code__copy";
        copyButton.type = "button";
        copyButton.setAttribute("aria-label", "Copy code to clipboard");
        copyButton.innerHTML = `
          <svg class="post-code__copy-icon" viewBox="0 0 16 16" aria-hidden="true">
            <g class="post-code__copy-squares" fill="none" stroke="currentColor" stroke-width="1.25">
              <rect x="5.25" y="2.25" width="8.5" height="8.5" rx="1.4"></rect>
              <path d="M10.75 10.75v1.5a1.5 1.5 0 0 1-1.5 1.5h-5.5a1.5 1.5 0 0 1-1.5-1.5v-5.5a1.5 1.5 0 0 1 1.5-1.5h1.5"></path>
            </g>
            <path class="post-code__copy-check" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m3.25 8.1 3.05 3.05 6.45-6.45"></path>
          </svg>
        `;

        copyButton.addEventListener("click", async () => {
          try {
            await copyText(source);
            copyButton.dataset.copied = "true";
            copyButton.setAttribute("aria-label", "Code copied");
            window.setTimeout(() => {
              delete copyButton.dataset.copied;
              copyButton.setAttribute(
                "aria-label",
                "Copy code to clipboard",
              );
            }, 1600);
          } catch {
            copyButton.setAttribute("aria-label", "Could not copy code");
          }
        });

        figure.append(copyButton);
      }

      return Promise.resolve();
    });
  };

  const createTocList = (headings) => {
    const list = document.createElement("ol");
    list.className = "post-toc__list";

    headings.forEach((heading) => {
      const item = document.createElement("li");
      const link = document.createElement("a");

      link.className = "post-toc__link";
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent.trim();
      item.append(link);
      list.append(item);
    });

    return list;
  };

  const initTableOfContents = () => {
    const toc = document.querySelector("[data-post-toc]");
    const desktop = toc?.querySelector("[data-post-toc-desktop]");
    const mobile = toc?.querySelector("[data-post-toc-mobile]");
    const toggle = toc?.querySelector("[data-post-toc-toggle]");
    const current = toc?.querySelector("[data-post-toc-current]");
    const panel = toc?.querySelector("[data-post-toc-panel]");

    if (!postBody || !toc || !desktop || !mobile || !toggle || !current || !panel) {
      return;
    }

    const headings = [...postBody.children].filter(
      (element) => element.tagName === "H2",
    );

    const minimumHeadings = toc.dataset.tocMode === "true" ? 1 : 2;

    if (headings.length < minimumHeadings) {
      return;
    }

    const usedIds = new Set(
      [...document.querySelectorAll("[id]")]
        .filter((element) => !headings.includes(element))
        .map((element) => element.id),
    );

    headings.forEach((heading, index) => {
      if (heading.id && !usedIds.has(heading.id)) {
        usedIds.add(heading.id);
        return;
      }

      const base =
        heading.textContent
          .trim()
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || `section-${index + 1}`;
      let id = base;
      let suffix = 2;

      while (usedIds.has(id)) {
        id = `${base}-${suffix}`;
        suffix += 1;
      }

      heading.id = id;
      usedIds.add(id);
    });

    desktop.replaceChildren(createTocList(headings));
    mobile.replaceChildren(createTocList(headings));
    toc.hidden = false;

    const links = [...toc.querySelectorAll(".post-toc__link")];
    let activeId = "";
    let isTicking = false;
    let isTocScrolling = false;
    let scrollSettleTimer;

    const closeToc = ({ restoreFocus = false } = {}) => {
      toc.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      panel.setAttribute("aria-hidden", "true");

      if (restoreFocus) {
        toggle.focus();
      }
    };

    const updateStickyState = () => {
      if (window.innerWidth > 1100) {
        toc.classList.remove("is-stuck");
        return;
      }

      const stickyTop = Number.parseFloat(getComputedStyle(toc).top) || 0;
      const hasReachedStickyTop =
        toc.getBoundingClientRect().top <= stickyTop + 1;

      toc.classList.toggle("is-stuck", hasReachedStickyTop);

      if (!hasReachedStickyTop && toc.classList.contains("is-open")) {
        closeToc();
      }
    };

    const setActive = (heading) => {
      if (!heading || heading.id === activeId) {
        return;
      }

      activeId = heading.id;
      current.textContent = heading.textContent.trim();

      links.forEach((link) => {
        const isActive = link.getAttribute("href") === `#${heading.id}`;
        link.setAttribute("aria-current", isActive ? "true" : "false");
      });
    };

    const updateActive = () => {
      if (isTocScrolling) {
        isTicking = false;
        return;
      }

      const tocTop = Number.parseFloat(getComputedStyle(toc).top) || 0;
      const threshold =
        tocTop + (window.innerWidth <= 1100 ? 56 : 16);
      let active = headings[0];

      headings.forEach((heading) => {
        if (heading.getBoundingClientRect().top <= threshold) {
          active = heading;
        }
      });

      setActive(active);
      isTicking = false;
    };

    const requestActiveUpdate = () => {
      if (isTicking) {
        return;
      }

      isTicking = true;
      window.requestAnimationFrame(updateActive);
    };

    const finishTocScroll = () => {
      isTocScrolling = false;
      window.clearTimeout(scrollSettleTimer);
      requestActiveUpdate();
    };

    const handleScroll = () => {
      updateStickyState();

      if (isTocScrolling) {
        window.clearTimeout(scrollSettleTimer);
        scrollSettleTimer = window.setTimeout(finishTocScroll, 140);
      }

      if (!isTocScrolling) {
        requestActiveUpdate();
      }
    };

    toggle.addEventListener("click", () => {
      const willOpen = !toc.classList.contains("is-open");
      toc.classList.toggle("is-open", willOpen);
      toggle.setAttribute("aria-expanded", String(willOpen));
      panel.setAttribute("aria-hidden", String(!willOpen));
    });

    links.forEach((link) => {
      link.addEventListener("click", (event) => {
        const heading = headings.find(
          (candidate) => link.getAttribute("href") === `#${candidate.id}`,
        );

        if (!heading) {
          return;
        }

        event.preventDefault();
        const tocTop = Number.parseFloat(getComputedStyle(toc).top) || 0;
        const offset = tocTop + (window.innerWidth <= 1100 ? 56 : 16);
        const targetY =
          window.scrollY + heading.getBoundingClientRect().top - offset;

        window.history.pushState(null, "", `#${heading.id}`);
        isTocScrolling = !reducedMotion;
        setActive(heading);
        closeToc();
        window.scrollTo({
          top: targetY,
          behavior: reducedMotion ? "auto" : "smooth",
        });

        if (isTocScrolling) {
          window.clearTimeout(scrollSettleTimer);
          scrollSettleTimer = window.setTimeout(finishTocScroll, 900);
        } else {
          requestActiveUpdate();
        }
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toc.classList.contains("is-open")) {
        closeToc({ restoreFocus: true });
      }
    });

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 1100) {
        closeToc();
      }

      updateStickyState();
      requestActiveUpdate();
    });

    headings.forEach((heading) => heading.classList.add("post-toc__target"));
    updateStickyState();
    updateActive();
  };

  const initFootnoteReturns = () => {
    document.querySelectorAll(".post-footnote-backref").forEach((link) => {
      link.addEventListener("click", (event) => {
        const href = link.getAttribute("href") || "";
        const target = href.startsWith("#")
          ? document.getElementById(decodeURIComponent(href.slice(1)))
          : null;

        if (!target) {
          return;
        }

        event.preventDefault();
        window.history.pushState(null, "", href);

        let fallbackTimer;
        let highlightTimer;

        const highlightReference = () => {
          window.removeEventListener("scrollend", highlightReference);
          window.clearTimeout(fallbackTimer);
          target.classList.remove("is-return-highlighted");
          void target.offsetWidth;
          target.classList.add("is-return-highlighted");
          window.clearTimeout(highlightTimer);
          highlightTimer = window.setTimeout(() => {
            target.classList.remove("is-return-highlighted");
          }, 650);
        };

        if (reducedMotion) {
          target.scrollIntoView({ block: "start" });
          highlightReference();
          return;
        }

        window.addEventListener("scrollend", highlightReference, {
          once: true,
        });
        fallbackTimer = window.setTimeout(highlightReference, 2000);
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    });
  };

  const codeHighlightJobs = enhanceCodeBlocks();
  initTableOfContents();
  initFootnoteReturns();
  Promise.allSettled(codeHighlightJobs).then(() => {
    page.classList.add("has-code-highlighting");
  });

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

})();
