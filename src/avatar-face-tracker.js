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

const FALLBACK_EXTENSION = 'webp';
const ACTIVE_EXTENSION = supportsAvif() ? 'avif' : FALLBACK_EXTENSION;
const SLOW_CONNECTION_TYPES = new Set(['slow-2g', '2g', '3g']);

const preloadedImages = new Set();
const startedPreloads = new Set();

const GRID_VALUES = buildGridValues();
const FACE_FILE_STEMS = buildFaceFileStems(GRID_VALUES);
const PRELOAD_BATCH_SIZE = 6;
const ALLOW_AGGRESSIVE_PRELOAD = canAggressivelyPreload();

function supportsAvif() {
  const canvas = document.createElement('canvas');
  if (!canvas.getContext) {
    return false;
  }
  try {
    return canvas.toDataURL('image/avif').indexOf('image/avif') !== -1;
  } catch (error) {
    return false;
  }
}

function canAggressivelyPreload() {
  const connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection ||
    navigator.msConnection;

  if (!connection || !connection.effectiveType) {
    return true;
  }

  return !SLOW_CONNECTION_TYPES.has(connection.effectiveType);
}

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

function gridToFileStem(px, py) {
  return `gaze_px${sanitize(px)}_py${sanitize(py)}_${SIZE}`;
}

function buildGridValues() {
  const values = [];
  for (let v = P_MIN; v <= P_MAX; v += STEP) {
    values.push(Number(v.toFixed(1)));
  }
  return values;
}

function buildFaceFileStems(values) {
  const stems = [];
  for (let i = 0; i < values.length; i += 1) {
    for (let j = 0; j < values.length; j += 1) {
      stems.push(gridToFileStem(values[i], values[j]));
    }
  }
  return stems;
}

function buildImageSrc(basePath, fileStem, extension = ACTIVE_EXTENSION) {
  return `${basePath}${fileStem}.${extension}`;
}

function getImageSources(basePath, px, py) {
  const fileStem = gridToFileStem(px, py);
  const primarySrc = buildImageSrc(basePath, fileStem, ACTIVE_EXTENSION);
  const fallbackSrc =
    ACTIVE_EXTENSION === FALLBACK_EXTENSION
      ? primarySrc
      : buildImageSrc(basePath, fileStem, FALLBACK_EXTENSION);

  return {
    primarySrc,
    fallbackSrc,
  };
}

function applySource(img, primarySrc, fallbackSrc) {
  if (primarySrc === fallbackSrc) {
    img.src = primarySrc;
    return;
  }

  img.onerror = () => {
    img.onerror = null;
    img.src = fallbackSrc;
  };
  img.src = primarySrc;
}

function getDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function isMobileDevice() {
  const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const supportsMatchMedia = typeof window.matchMedia === 'function';
  const hasCoarsePointer = supportsMatchMedia && window.matchMedia('(pointer: coarse)').matches;
  const lacksHover = supportsMatchMedia && window.matchMedia('(hover: none)').matches;

  // Treat as mobile if it explicitly reports a coarse, non-hover pointer (touch-first) or matches mobile UA
  return uaMobile || (hasCoarsePointer && lacksHover);
}

function scheduleIdleWork(callback) {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback);
  }
  return setTimeout(() => {
    callback({ didTimeout: false, timeRemaining: () => 0 });
  }, 25);
}

function startPreloadingAllFaces(basePath) {
  if (!ALLOW_AGGRESSIVE_PRELOAD) {
    return;
  }

  const normalizedPath = basePath.endsWith('/') ? basePath : `${basePath}/`;
  if (startedPreloads.has(normalizedPath)) {
    return;
  }

  startedPreloads.add(normalizedPath);

  const sources = FACE_FILE_STEMS.map((stem) => ({
    primary: buildImageSrc(normalizedPath, stem),
    fallback:
      ACTIVE_EXTENSION === FALLBACK_EXTENSION
        ? null
        : buildImageSrc(normalizedPath, stem, FALLBACK_EXTENSION),
  }));
  let index = 0;

  function loadChunk(deadline) {
    let processed = 0;

    while (index < sources.length) {
      if (
        deadline &&
        typeof deadline.timeRemaining === 'function' &&
        deadline.timeRemaining() <= 2 &&
        processed > 0
      ) {
        break;
      }

      const { primary, fallback } = sources[index];
      index += 1;

      if (preloadedImages.has(primary)) {
        continue;
      }

      preloadedImages.add(primary);

      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';

      if (fallback) {
        const handleError = () => {
          img.removeEventListener('error', handleError);
          img.src = fallback;
        };
        img.addEventListener('error', handleError);
      }

      img.src = primary;

      processed += 1;

      if (!deadline && processed >= PRELOAD_BATCH_SIZE) {
        break;
      }
    }

    if (index < sources.length) {
      scheduleIdleWork(loadChunk);
    }
  }

  scheduleIdleWork(loadChunk);
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

  const basePath = '/faces/';
  const originalSrc = mainAvatar.src;
  const originalSources = { primarySrc: originalSrc, fallbackSrc: originalSrc };

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
  function crossfade(fromSrc, targetSources, callback) {
    if (isTransitioning) return;

    isTransitioning = true;

    // Clear any existing timeout
    if (transitionTimeout) {
      clearTimeout(transitionTimeout);
      transitionTimeout = null;
    }

    const { primarySrc, fallbackSrc } = targetSources;

    // Preload target image
    const preload = new Image();
    let resolvedSrc = primarySrc;

    const handleCleanup = () => {
      isTransitioning = false;
      transitionTimeout = null;
      preload.onload = null;
      preload.onerror = null;
    };

    const performCrossfade = (srcToUse) => {
      // Set up initial state
      mainAvatar.src = fromSrc;
      mainAvatar.style.opacity = '0.85';
      mainAvatar.style.transition = 'none';

      applySource(overlayAvatar, srcToUse, fallbackSrc);
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
        applySource(mainAvatar, srcToUse, fallbackSrc);
        mainAvatar.style.opacity = '0.85';
        mainAvatar.style.transition = 'none';

        overlayAvatar.style.opacity = '0';
        overlayAvatar.style.transition = 'none';

        handleCleanup();

        if (callback) callback();
      }, TRANSITION_DURATION);
    };

    const handleLoad = () => {
      performCrossfade(resolvedSrc);
    };

    const handleError = () => {
      if (fallbackSrc && resolvedSrc !== fallbackSrc) {
        resolvedSrc = fallbackSrc;
        preload.src = fallbackSrc;
        return;
      }
      handleCleanup();
    };

    preload.onload = handleLoad;
    preload.onerror = handleError;
    preload.src = primarySrc;
  }

  // Instantly update image during tracking
  function instantUpdate(targetSources) {
    if (isTransitioning) return;
    mainAvatar.style.transition = 'none';
    applySource(mainAvatar, targetSources.primarySrc, targetSources.fallbackSrc);
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
        crossfade(currentSrc, originalSources, () => {
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
      startPreloadingAllFaces(basePath);

      // Calculate initial gaze position
      const nx = (clientX - centerX) / (rect.width / 2);
      const ny = (centerY - clientY) / (rect.height / 2);
      const clampedX = clamp(nx, -1, 1);
      const clampedY = clamp(ny, -1, 1);
      const px = quantizeToGrid(clampedX);
      const py = quantizeToGrid(clampedY);

      // Crossfade from original to first gaze
      const targetSources = getImageSources(basePath, px, py);

      crossfade(originalSrc, targetSources, () => {
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
        const targetSources = getImageSources(basePath, px, py);

        instantUpdate(targetSources);

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
