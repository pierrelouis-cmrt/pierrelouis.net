// Grid configuration (must match your generated images)
const P_MIN = -15;
const P_MAX = 15;
const STEP = 3;
const SIZE = 256;
const FALLBACK_EXTENSION = 'webp';
const ACTIVE_EXTENSION = supportsAvif() ? 'avif' : FALLBACK_EXTENSION;

function normalizeBasePath(path) {
  const value = typeof path === 'string' && path.length > 0 ? path : '/faces/';
  return value.endsWith('/') ? value : `${value}/`;
}

function supportsAvif() {
  const canvas = document.createElement('canvas');
  if (!canvas.getContext) {
    return false;
  }
  try {
    return canvas.toDataURL('image/avif').includes('image/avif');
  } catch (error) {
    return false;
  }
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

function buildImageSources(basePath, px, py) {
  const fileStem = gridToFileStem(px, py);
  const primary = `${basePath}${fileStem}.${ACTIVE_EXTENSION}`;
  const fallback =
    ACTIVE_EXTENSION === FALLBACK_EXTENSION
      ? primary
      : `${basePath}${fileStem}.${FALLBACK_EXTENSION}`;

  return {
    primary,
    fallback,
    filename: `${fileStem}.${ACTIVE_EXTENSION}`,
  };
}

function applyImageSource(target, sources) {
  if (sources.primary === sources.fallback) {
    target.src = sources.primary;
    return;
  }

  target.onerror = () => {
    target.onerror = null;
    target.src = sources.fallback;
  };

  target.src = sources.primary;
}

function updateDebug(debugEl, x, y, filename) {
  if (!debugEl) return;
  debugEl.innerHTML = `Mouse: (${Math.round(x)}, ${Math.round(y)})<br/>Image: ${filename}`;
}

function initializeFaceTracker(container) {
  const basePath = normalizeBasePath(container.dataset.basePath);
  const showDebug = String(container.dataset.debug || 'false') === 'true';

  const img = document.createElement('img');
  img.className = 'face-image';
  img.alt = 'Face following gaze';
  container.appendChild(img);

  let debugEl = null;
  let lastPx = null;
  let lastPy = null;

  if (showDebug) {
    debugEl = document.createElement('div');
    debugEl.className = 'face-debug';
    container.appendChild(debugEl);
  }

  function setFromClient(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const nx = (clientX - centerX) / (rect.width / 2);
    const ny = (centerY - clientY) / (rect.height / 2);

    const clampedX = clamp(nx, -1, 1);
    const clampedY = clamp(ny, -1, 1);

    const px = quantizeToGrid(clampedX);
    const py = quantizeToGrid(clampedY);

    const sources = buildImageSources(basePath, px, py);
    updateDebug(debugEl, clientX - rect.left, clientY - rect.top, sources.filename);

    if (px === lastPx && py === lastPy) {
      return;
    }

    lastPx = px;
    lastPy = py;
    applyImageSource(img, sources);
  }

  function handleMouseMove(e) {
    setFromClient(e.clientX, e.clientY);
  }

  function handleTouchMove(e) {
    if (e.touches && e.touches.length > 0) {
      const t = e.touches[0];
      setFromClient(t.clientX, t.clientY);
    }
  }

  // Track pointer anywhere on the page
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('touchmove', handleTouchMove, { passive: true });

  // Initialize at center
  const rect = container.getBoundingClientRect();
  setFromClient(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.face-tracker').forEach((el) => initializeFaceTracker(el));
});
