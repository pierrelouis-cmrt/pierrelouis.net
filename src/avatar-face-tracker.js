// Avatar Face Tracker with Proximity Detection
// Crossfade on enter/exit, instant tracking during hover
// Disabled on mobile devices

// Grid configuration (must match your generated images)
const P_MIN = -15;
const P_MAX = 15;
const STEP = 3;
const SIZE = 256;

// Proximity threshold in pixels - only track when cursor is within this distance (circular)
const PROXIMITY_THRESHOLD = 180;

// Transition timing - only for enter/exit animations
const TRANSITION_DURATION = 250; // ms

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function quantizeToGrid(val) {
  const raw = P_MIN + (val + 1) * (P_MAX - P_MIN) / 2; // [-1,1] -> [-15,15]
  const snapped = Math.round(raw / STEP) * STEP;
  return clamp(snapped, P_MIN, P_MAX);
}

function sanitize(val) {
  const str = Number(val).toFixed(1); // force one decimal, e.g. 0 -> 0.0
  return str.replace('-', 'm').replace('.', 'p');
}

function gridToFilename(px, py) {
  return `gaze_px${sanitize(px)}_py${sanitize(py)}_${SIZE}.webp`;
}

function getDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function isMobileDevice() {
  return (
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );
}

function initializeAvatarFaceTracker() {
  // Exit early on mobile devices
  if (isMobileDevice()) {
    return;
  }

  const mainAvatar = document.querySelector('.hero-avatar');
  const avatarWrapper = document.querySelector('.hero-avatar-wrapper');

  if (!mainAvatar || !avatarWrapper) {
    return;
  }

  const basePath = '/src/face_looker/faces/';
  const originalSrc = mainAvatar.src;

  // Create overlay layer for crossfade transitions
  const overlayAvatar = document.createElement('img');
  overlayAvatar.className = 'hero-avatar hero-avatar-layer';
  overlayAvatar.alt = 'Avatar';
  overlayAvatar.style.opacity = '0';
  overlayAvatar.style.position = 'absolute';
  overlayAvatar.style.top = '0';
  overlayAvatar.style.left = '0';
  overlayAvatar.style.pointerEvents = 'none';
  overlayAvatar.style.transition = 'none';

  // Setup wrapper
  avatarWrapper.style.position = 'relative';
  avatarWrapper.appendChild(overlayAvatar);

  // Make main avatar absolute for proper stacking
  mainAvatar.style.position = 'absolute';
  mainAvatar.style.top = '0';
  mainAvatar.style.left = '0';
  mainAvatar.style.transition = 'none';

  // State management
  let isTracking = false;
  let isTransitioning = false;
  let lastPx = null;
  let lastPy = null;
  let transitionTimeout = null;

  // Crossfade from one image to another (only used for enter/exit)
  function crossfade(fromSrc, toSrc, callback) {
    if (isTransitioning) return;

    isTransitioning = true;

    // Clear any existing timeout
    if (transitionTimeout) {
      clearTimeout(transitionTimeout);
      transitionTimeout = null;
    }

    // Preload target image
    const preload = new Image();
    preload.src = toSrc;

    const performCrossfade = () => {
      // Set up initial state
      mainAvatar.src = fromSrc;
      mainAvatar.style.opacity = '0.85';
      mainAvatar.style.transition = 'none';

      overlayAvatar.src = toSrc;
      overlayAvatar.style.opacity = '0';
      overlayAvatar.style.transition = 'none';

      // Force reflow
      overlayAvatar.offsetHeight;

      // Enable transitions
      mainAvatar.style.transition = `opacity ${TRANSITION_DURATION}ms ease-in-out`;
      overlayAvatar.style.transition = `opacity ${TRANSITION_DURATION}ms ease-in-out`;

      // Trigger crossfade
      requestAnimationFrame(() => {
        mainAvatar.style.opacity = '0';
        overlayAvatar.style.opacity = '0.85';
      });

      // After transition completes
      transitionTimeout = setTimeout(() => {
        // Swap: make overlay the new main
        mainAvatar.src = toSrc;
        mainAvatar.style.opacity = '0.85';
        mainAvatar.style.transition = 'none';

        overlayAvatar.style.opacity = '0';
        overlayAvatar.style.transition = 'none';

        isTransitioning = false;
        transitionTimeout = null;

        if (callback) callback();
      }, TRANSITION_DURATION);
    };

    if (preload.complete) {
      performCrossfade();
    } else {
      preload.onload = performCrossfade;
      preload.onerror = () => {
        isTransitioning = false;
      };
    }
  }

  // Instantly update image during tracking
  function instantUpdate(imagePath) {
    if (isTransitioning) return;
    mainAvatar.style.transition = 'none';
    mainAvatar.src = imagePath;
    mainAvatar.style.opacity = '0.85';
  }

  function setFaceDirection(clientX, clientY) {
    const rect = avatarWrapper.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate distance from cursor to avatar center (circular)
    const distance = getDistance(clientX, clientY, centerX, centerY);

    // Outside proximity threshold - EXIT
    if (distance > PROXIMITY_THRESHOLD) {
      if (isTracking && !isTransitioning) {
        isTracking = false;

        // Get current image before crossfading
        const currentSrc = mainAvatar.src;

        // Crossfade back to original
        crossfade(currentSrc, originalSrc, () => {
          lastPx = null;
          lastPy = null;
        });
      }
      return;
    }

    // Inside proximity threshold
    // ENTER - first time entering radius
    if (!isTracking && !isTransitioning) {
      isTracking = true;

      // Calculate initial gaze position
      const nx = (clientX - centerX) / (rect.width / 2);
      const ny = (centerY - clientY) / (rect.height / 2);
      const clampedX = clamp(nx, -1, 1);
      const clampedY = clamp(ny, -1, 1);
      const px = quantizeToGrid(clampedX);
      const py = quantizeToGrid(clampedY);

      // Crossfade from original to first gaze
      const filename = gridToFilename(px, py);
      const imagePath = `${basePath}${filename}`;

      crossfade(originalSrc, imagePath, () => {
        lastPx = px;
        lastPy = py;
      });

      return;
    }

    // TRACKING - actively tracking cursor
    if (isTracking && !isTransitioning) {
      // Calculate gaze position
      const nx = (clientX - centerX) / (rect.width / 2);
      const ny = (centerY - clientY) / (rect.height / 2);
      const clampedX = clamp(nx, -1, 1);
      const clampedY = clamp(ny, -1, 1);
      const px = quantizeToGrid(clampedX);
      const py = quantizeToGrid(clampedY);

      // Update if gaze direction changed - INSTANT
      if (px !== lastPx || py !== lastPy) {
        const filename = gridToFilename(px, py);
        const imagePath = `${basePath}${filename}`;

        instantUpdate(imagePath);

        lastPx = px;
        lastPy = py;
      }
    }
  }

  function handleMouseMove(e) {
    requestAnimationFrame(() => {
      setFaceDirection(e.clientX, e.clientY);
    });
  }

  // Track mouse movements across the page
  window.addEventListener('mousemove', handleMouseMove, { passive: true });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (transitionTimeout) {
      clearTimeout(transitionTimeout);
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAvatarFaceTracker);
} else {
  initializeAvatarFaceTracker();
}
