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

// Avatar attraction system with anti-blur optimizations and improved magnet effect
document.addEventListener("DOMContentLoaded", () => {
  const avatar = document.getElementById("avatar");

  if (!avatar) return;

  // ========== OPTIMIZED PARAMETERS ==========
  const CONFIG = {
    // Attraction settings
    maxAttractionDistance: 250,
    magneticDistance: 40, // Radius around original position for magnetic attach
    attractionStrength: 0.2, // Subtle pull strength

    // Spring parameters for smoothness and bounciness (tuned for ~60fps)
    attractionStiffness: 0.15, // Subtle and smooth attraction
    attractionDamping: 0.3, // Smooth without much oscillation
    snapStiffness: 0.2, // For bouncy snap back
    snapDamping: 0.1, // Low damping for bouncy overshoot/oscillation

    // Anti-blur settings
    pixelPerfect: true, // Round all positions to integers
    useTranslate3d: true, // Use 3D transforms for hardware acceleration

    // Other settings
    redirectUrl: "/playground/avatar/",
  };

  // ========== STATE VARIABLES ==========
  let mouseX = 0;
  let mouseY = 0;
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
    const rect = avatar.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  function getDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  // ========== UPDATE FUNCTION ==========
  function updateAvatarPosition(time) {
    const dt = (time - lastTime) / 1000; // Delta time in seconds
    lastTime = time;

    if (!originalCenter) {
      originalCenter = getAvatarCenter();
    }

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
      // Magnetic mode: Follow cursor exactly at its position (perfectly centered)
      targetX = mouseX - originalCenter.x;
      targetY = mouseY - originalCenter.y;
      isMagnetic = true;
    } else if (mouseDist < CONFIG.maxAttractionDistance) {
      // Attraction mode: Subtle pull towards cursor
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
      // Snap back mode: Bounce back to original position
      targetX = 0;
      targetY = 0;
      stiffness = CONFIG.snapStiffness;
      damping = CONFIG.snapDamping;
    }

    if (isMagnetic) {
      // For exact following in magnetic mode (no lag, perfect centering)
      currentOffsetX = targetX;
      currentOffsetY = targetY;
      velX = 0;
      velY = 0;
    } else {
      // Spring simulation for smooth, bouncy movement
      const accX = stiffness * (targetX - currentOffsetX) - damping * velX;
      const accY = stiffness * (targetY - currentOffsetY) - damping * velY;
      velX += accX * dt * 60; // Scale for consistency (assuming ~60fps base)
      velY += accY * dt * 60;
      currentOffsetX += velX * dt * 60;
      currentOffsetY += velY * dt * 60;
    }

    // === PIXEL-PERFECT ANTI-BLUR TRANSFORM APPLICATION ===
    const roundedX = roundToPixel(currentOffsetX);
    const roundedY = roundToPixel(currentOffsetY);

    if (CONFIG.useTranslate3d) {
      avatar.style.transform = `scale(0.25) translate3d(${roundedX}px, ${roundedY}px, 0)`;
    } else {
      avatar.style.transform = `scale(0.25) translate(${roundedX}px, ${roundedY}px)`;
    }

    // Force browser to use integer positioning
    avatar.style.webkitTransform = avatar.style.transform;
    avatar.style.mozTransform = avatar.style.transform;

    animationId = requestAnimationFrame(updateAvatarPosition);
  }

  // ========== EVENT HANDLERS ==========
  // Global mouse tracking with pixel rounding
  document.addEventListener("mousemove", (e) => {
    mouseX = CONFIG.pixelPerfect ? Math.round(e.clientX) : e.clientX;
    mouseY = CONFIG.pixelPerfect ? Math.round(e.clientY) : e.clientY;
  });

  // Avatar hover events
  avatar.addEventListener("mouseenter", () => {
    isHovering = true;
    avatar.classList.add("intense");
  });

  avatar.addEventListener("mouseleave", () => {
    isHovering = false;
    avatar.classList.remove("intense");
  });

  // Avatar click redirect
  avatar.addEventListener("click", () => {
    window.location.href = CONFIG.redirectUrl;
  });

  // ========== INITIALIZE ==========
  // Get initial center before any movement
  originalCenter = getAvatarCenter();
  animationId = requestAnimationFrame(updateAvatarPosition);

  // Pause attraction when page is not visible
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
});
