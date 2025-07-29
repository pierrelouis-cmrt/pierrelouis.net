// Copy email to clipboard (unchanged)
document.addEventListener("DOMContentLoaded", () => {
  const tooltipContainer = document.querySelector(".tooltip-container");

  if (tooltipContainer) {
    const emailToCopy = "contact@pierrelouis.net";
    const tooltip = tooltipContainer.querySelector(".tooltip");
    const emailLink = tooltipContainer.querySelector("a.email.inline-icon");

    const copyIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" 
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" 
        stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
      </svg>`;

    const copyCheckIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" 
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" 
        stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy-check">
        <path d="m12 15 2 2 4-4"/>
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
      </svg>`;

    function setIcon(iconSVG) {
      const existingIcon = emailLink.querySelector("svg");
      if (existingIcon) {
        emailLink.removeChild(existingIcon);
      }
      const template = document.createElement("template");
      template.innerHTML = iconSVG.trim();
      const newIcon = template.content.firstChild;
      emailLink.appendChild(newIcon);
    }

    const handleCopyEmail = () => {
      navigator.clipboard
        .writeText(emailToCopy)
        .then(() => {
          tooltip.textContent = "Copied";
          setIcon(copyCheckIconSVG);
          setTimeout(() => {
            tooltip.textContent = "Copy Email";
            setIcon(copyIconSVG);
          }, 1000);
        })
        .catch((err) => {
          console.error("Failed to copy: ", err);
        });
    };

    tooltipContainer.addEventListener("click", handleCopyEmail);
  }
});

// Super-robust Avatar attraction system for production environments
(function () {
  "use strict";

  const CONFIG = {
    maxAttractionDistance: 250,
    magneticDistance: 40,
    attractionStrength: 0.2,
    attractionStiffness: 0.15,
    attractionDamping: 0.3,
    snapStiffness: 0.2,
    snapDamping: 0.1,
    pixelPerfect: true,
    useTranslate3d: true,
    redirectUrl: "/playground/avatar/",
    maxInitRetries: 15,
    retryDelay: 150,
    chromeExtraDelay: 300, // Extra delay for Chrome
  };

  let initAttempts = 0;
  let avatar = null;
  let isInitialized = false;
  let isChrome =
    /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

  // ========== CSS AND STYLE READINESS DETECTION ==========
  function waitForStyles() {
    return new Promise((resolve) => {
      // Wait for all stylesheets to load
      if (document.styleSheets.length === 0) {
        setTimeout(() => resolve(), 100);
        return;
      }

      let loaded = 0;
      const total = document.styleSheets.length;

      for (let i = 0; i < total; i++) {
        const sheet = document.styleSheets[i];
        try {
          // Try to access cssRules to ensure sheet is loaded
          if (sheet.cssRules || sheet.rules) {
            loaded++;
          } else {
            // If we can't access rules, assume it's still loading
            setTimeout(() => {
              loaded++;
              if (loaded >= total) resolve();
            }, 50);
          }
        } catch (e) {
          // Sheet might still be loading
          setTimeout(() => {
            loaded++;
            if (loaded >= total) resolve();
          }, 50);
        }
      }

      if (loaded >= total) {
        resolve();
      }
    });
  }

  function isCSSReady(element) {
    try {
      const styles = window.getComputedStyle(element);

      // Check if CSS custom properties are computed
      const transform = styles.transform;
      const willChange = styles.willChange;

      // Verify the element has the expected CSS applied
      const hasExpectedStyles =
        styles.position === "relative" &&
        styles.cursor === "pointer" &&
        transform !== "none" &&
        !transform.includes("var("); // Ensure CSS variables are resolved

      return hasExpectedStyles;
    } catch (e) {
      return false;
    }
  }

  function findAvatar() {
    return (
      document.getElementById("avatar") ||
      document.querySelector(".avatar") ||
      document.querySelector("[id='avatar']")
    );
  }

  function isElementReady(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);

    const hasValidDimensions = rect.width > 0 && rect.height > 0;
    const isVisible =
      styles.display !== "none" && styles.visibility !== "hidden";
    const hasCSSReady = isCSSReady(element);

    return hasValidDimensions && isVisible && hasCSSReady;
  }

  function forceStyleRecalculation() {
    // Multiple methods to force style recalculation
    document.body.offsetHeight;
    avatar.offsetHeight;
    window.getComputedStyle(avatar).transform;

    // Force a repaint
    avatar.style.opacity = "0.999";
    requestAnimationFrame(() => {
      avatar.style.opacity = "";
    });
  }

  async function tryInitialize() {
    initAttempts++;

    // Wait for styles first
    await waitForStyles();

    avatar = findAvatar();

    if (!avatar) {
      if (initAttempts < CONFIG.maxInitRetries) {
        setTimeout(tryInitialize, CONFIG.retryDelay);
        return;
      }
      console.warn("Avatar element not found after multiple attempts");
      return;
    }

    // Force style recalculation
    forceStyleRecalculation();

    // Extra delay for Chrome on Windows
    const extraDelay = isChrome ? CONFIG.chromeExtraDelay : 0;

    setTimeout(() => {
      if (!isElementReady(avatar)) {
        if (initAttempts < CONFIG.maxInitRetries) {
          setTimeout(tryInitialize, CONFIG.retryDelay);
          return;
        }
        console.warn("Avatar element not ready after multiple attempts");
        return;
      }

      // Triple-frame delay to ensure everything is settled
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            initializeAvatarSystem();
          });
        });
      });
    }, extraDelay);
  }

  // ========== MAIN AVATAR SYSTEM ==========
  function initializeAvatarSystem() {
    if (isInitialized) return;
    isInitialized = true;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let originalCenter = null;
    let currentOffsetX = 0;
    let currentOffsetY = 0;
    let velX = 0;
    let velY = 0;
    let isHovering = false;
    let animationId = null;
    let lastTime = performance.now();

    // ========== UTILITY FUNCTIONS ==========
    function roundToPixel(value) {
      return CONFIG.pixelPerfect ? Math.round(value) : value;
    }

    function getAvatarCenter() {
      try {
        // Force style recalculation before getting position
        forceStyleRecalculation();

        const rect = avatar.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Additional validation
        if (isNaN(centerX) || isNaN(centerY) || centerX <= 0 || centerY <= 0) {
          // Wait a bit and try again
          setTimeout(() => {
            originalCenter = getAvatarCenter();
          }, 100);
          return null;
        }

        return { x: centerX, y: centerY };
      } catch (e) {
        console.warn("Error getting avatar center:", e);
        return null;
      }
    }

    function getDistance(x1, y1, x2, y2) {
      return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    function applyTransform(x, y) {
      const roundedX = roundToPixel(x);
      const roundedY = roundToPixel(y);

      // Get the current scale from CSS (in case --avatar-scale is defined)
      const currentTransform = window.getComputedStyle(avatar).transform;
      let scaleValue = "0.25";

      // Try to extract scale from existing transform if it exists
      if (currentTransform && currentTransform !== "none") {
        const scaleMatch = currentTransform.match(
          /scaleKATEX_INLINE_OPEN([\d.]+)KATEX_INLINE_CLOSE/
        );
        if (scaleMatch) {
          scaleValue = scaleMatch[1];
        }
      }

      const transform = CONFIG.useTranslate3d
        ? `scale(${scaleValue}) translate3d(${roundedX}px, ${roundedY}px, 0)`
        : `scale(${scaleValue}) translate(${roundedX}px, ${roundedY}px)`;

      avatar.style.transform = transform;
      avatar.style.webkitTransform = transform;
      avatar.style.mozTransform = transform;
      avatar.style.msTransform = transform;
    }

    // ========== UPDATE FUNCTION ==========
    function updateAvatarPosition(time) {
      if (!avatar || !originalCenter) {
        // Try to get center again if we don't have it
        if (!originalCenter) {
          originalCenter = getAvatarCenter();
        }
        if (!originalCenter) {
          animationId = requestAnimationFrame(updateAvatarPosition);
          return;
        }
      }

      const dt = Math.min((time - lastTime) / 1000, 0.016);
      lastTime = time;

      const mouseDist = getDistance(
        mouseX,
        mouseY,
        originalCenter.x,
        originalCenter.y
      );

      let targetX = 0;
      let targetY = 0;
      let stiffness = 0;
      let damping = 0;
      let isMagnetic = false;

      if (mouseDist < CONFIG.magneticDistance) {
        targetX = mouseX - originalCenter.x;
        targetY = mouseY - originalCenter.y;
        isMagnetic = true;
      } else if (mouseDist < CONFIG.maxAttractionDistance) {
        const directionX = (mouseX - originalCenter.x) / mouseDist;
        const directionY = (mouseY - originalCenter.y) / mouseDist;
        const attractionFactor = 1 - mouseDist / CONFIG.maxAttractionDistance;
        targetX =
          directionX * mouseDist * attractionFactor * CONFIG.attractionStrength;
        targetY =
          directionY * mouseDist * attractionFactor * CONFIG.attractionStrength;
        stiffness = CONFIG.attractionStiffness;
        damping = CONFIG.attractionDamping;
      } else {
        targetX = 0;
        targetY = 0;
        stiffness = CONFIG.snapStiffness;
        damping = CONFIG.snapDamping;
      }

      if (isMagnetic) {
        currentOffsetX = targetX;
        currentOffsetY = targetY;
        velX = 0;
        velY = 0;
      } else {
        const accX = stiffness * (targetX - currentOffsetX) - damping * velX;
        const accY = stiffness * (targetY - currentOffsetY) - damping * velY;
        velX += accX * dt * 60;
        velY += accY * dt * 60;
        currentOffsetX += velX * dt * 60;
        currentOffsetY += velY * dt * 60;
      }

      applyTransform(currentOffsetX, currentOffsetY);
      animationId = requestAnimationFrame(updateAvatarPosition);
    }

    // ========== EVENT HANDLERS ==========
    document.addEventListener(
      "mousemove",
      (e) => {
        mouseX = CONFIG.pixelPerfect ? Math.round(e.clientX) : e.clientX;
        mouseY = CONFIG.pixelPerfect ? Math.round(e.clientY) : e.clientY;
      },
      { passive: true }
    );

    avatar.addEventListener("mouseenter", () => {
      isHovering = true;
      avatar.classList.add("intense");
    });

    avatar.addEventListener("mouseleave", () => {
      isHovering = false;
      avatar.classList.remove("intense");
    });

    avatar.addEventListener("click", () => {
      window.location.href = CONFIG.redirectUrl;
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (animationId) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }
      } else {
        lastTime = performance.now();
        animationId = requestAnimationFrame(updateAvatarPosition);
      }
    });

    window.addEventListener(
      "resize",
      () => {
        setTimeout(() => {
          forceStyleRecalculation();
          originalCenter = getAvatarCenter();
        }, 100);
      },
      { passive: true }
    );

    // ========== FINAL INITIALIZATION ==========
    setTimeout(
      () => {
        forceStyleRecalculation();
        originalCenter = getAvatarCenter();

        if (originalCenter) {
          lastTime = performance.now();
          animationId = requestAnimationFrame(updateAvatarPosition);
          console.log("Avatar magnet system initialized successfully");
        } else {
          console.warn("Failed to get valid avatar center position");
          // Try one more time after a longer delay
          setTimeout(() => {
            originalCenter = getAvatarCenter();
            if (originalCenter) {
              animationId = requestAnimationFrame(updateAvatarPosition);
            }
          }, 500);
        }
      },
      isChrome ? 200 : 100
    ); // Longer delay for Chrome
  }

  // ========== MULTIPLE INITIALIZATION STRATEGIES ==========

  // Wait for fonts and images to load as well
  Promise.all([
    new Promise((resolve) => {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", resolve);
      } else {
        resolve();
      }
    }),
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((resolve) => {
      if (document.readyState === "complete") {
        resolve();
      } else {
        window.addEventListener("load", resolve);
      }
    }),
  ]).then(() => {
    // Extra delay for Chrome
    setTimeout(tryInitialize, isChrome ? 500 : 100);
  });

  // Fallback timeout
  setTimeout(() => {
    if (!isInitialized) {
      tryInitialize();
    }
  }, 2000);
})();
