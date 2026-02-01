"use strict";

/** ===== Config ===== */
// No API key here. It's on the server now.
const USER = "pierrelouis-c";

// Polling cadence (ms)
const INTERVALS = {
  playing: 15000, // when music is playing
  idle: 60000, // when nothing is playing
  hidden: 120000, // when tab is hidden
};

const REQUEST_TIMEOUT_MS = 8000; // hard timeout per request
const PROXY_BASE = "/api"; // server JSON proxy base
const IMAGE_SIZE = "large"; // ~174px Last.fm image from Last.fm
const IMG_PROXY_PATH = "/img"; // PHP image proxy route (serves bytes directly)
const COVER_DISPLAY_WIDTH = 75; // CSS layout target in px

/** ===== DOM ===== */
const titleEl = document.querySelector(".music-widget .music-track-title");
const artistEl = document.querySelector(".music-widget .music-track-artist");
const coverEl = document.querySelector(".music-widget .music-album-cover");
const statusEl = document.querySelector(".music-widget .music-player-status");
const defaultCoverSvg = coverEl?.innerHTML ?? "";

/** ===== State ===== */
let currentTrackKey = null;
let pollTimerId = null;
let currentController = null;

const coverCache = new Map(); // key -> valid cover URL
const inflightCover = new Map(); // key -> Promise<string|null>
const lastRendered = { title: "", artist: "", cover: "", url: "" };

/** ===== Utils ===== */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function trackKeyFrom(obj) {
  const artist = obj?.artist?.["#text"]?.trim() ?? "";
  const name = obj?.name?.trim() ?? "";
  const mbid = obj?.mbid?.trim() ?? obj?.["mbid"]?.trim() ?? "";
  // Prefer stable mbid; fallback to normalized compound key
  return mbid || `${artist.toLowerCase()}—${name.toLowerCase()}`;
}

function lastNonEmptyImageUrl(images) {
  if (!Array.isArray(images)) return "";
  for (let i = images.length - 1; i >= 0; i--) {
    const url = images[i]?.["#text"]?.trim() ?? "";
    if (url) return url;
  }
  return "";
}

function imageUrlBySize(images, size) {
  if (!Array.isArray(images)) return "";
  const found = images.find((img) => img?.size === size);
  const url = found?.["#text"]?.trim() ?? "";
  return url || lastNonEmptyImageUrl(images);
}

function looksLikeLastfmPlaceholder(url) {
  if (!url) return true;
  // Known Last.fm placeholder hash used across sizes
  return url.includes("2a96cbd8b46e442fc41c2b86b821562f.png");
}

async function fetchJsonWithRetry(
  url,
  { retries = 2, backoffBase = 500 } = {}
) {
  let attempt = 0;
  while (true) {
    attempt++;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
      if (!res.ok) {
        // 429/5xx -> retry with backoff
        if (
          (res.status === 429 || (res.status >= 500 && res.status < 600)) &&
          attempt <= retries + 1
        ) {
          throw new Error(`HTTP ${res.status}`);
        }
      }
      const json = await res.json();
      return json;
    } catch (err) {
      if (attempt > retries + 1) throw err;
      const backoff =
        backoffBase * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
      await sleep(backoff);
    } finally {
      clearTimeout(t);
    }
  }
}

/** Build proxied image URL (width/DPR/format-aware) */
function proxyUrl(src, w = COVER_DISPLAY_WIDTH, dpr = 1, fmt = "jpeg", q = 80) {
  const u = new URL(IMG_PROXY_PATH, window.location.origin);
  u.searchParams.set("src", src);
  u.searchParams.set("w", String(w));
  u.searchParams.set("dpr", String(Math.max(1, Math.min(3, Math.round(dpr)))));
  u.searchParams.set("fmt", fmt);
  u.searchParams.set("q", String(q));
  return u.pathname + u.search;
}

/** Preload an image (usually proxied) to verify it loads; resolves with URL or null */
function preloadImage(url) {
  return new Promise((resolve) => {
    if (!url || looksLikeLastfmPlaceholder(url)) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** ===== API wrappers (via your PHP proxy) ===== */
async function getRecentNowPlaying() {
  // PHP caches this briefly; much lower Last.fm traffic
  const url = `${PROXY_BASE}/now-playing`;
  const data = await fetchJsonWithRetry(url, { retries: 2 });
  const list = data?.recenttracks?.track;
  if (!Array.isArray(list) || list.length === 0) return null;
  const t = list[0];
  const now = t?.["@attr"]?.nowplaying === "true";
  return now ? t : null; // return only if now playing
}

async function getTrackInfoCover(artist, track) {
  const params = new URLSearchParams({ artist, track });
  const url = `${PROXY_BASE}/cover?${params.toString()}`;
  const data = await fetchJsonWithRetry(url, { retries: 2 });
  const images = data?.track?.album?.image;
  const urlCandidate = imageUrlBySize(images, IMAGE_SIZE);
  // Preload via our proxy (1x) so the cached file is generated
  const proxied = urlCandidate
    ? proxyUrl(urlCandidate, COVER_DISPLAY_WIDTH, 1, "jpeg", 80)
    : "";
  const ok = await preloadImage(proxied);
  return ok ? urlCandidate : null;
}

/** ===== Rendering ===== */
function setLink(el, text, url) {
  if (!el) return;
  let a = el.querySelector("a");
  if (!a) {
    a = document.createElement("a");
    a.target = "_blank";
    a.rel = "noopener";
    el.replaceChildren(a);
  }
  if (a.textContent !== text) a.textContent = text;
  if (a.href !== url) a.href = url;
}

function setText(el, text) {
  if (!el) return;
  if (el.textContent !== text) el.textContent = text;
}

function setCover(urlOrNull) {
  if (!coverEl) return;
  if (!urlOrNull) {
    if (coverEl.innerHTML !== defaultCoverSvg)
      coverEl.innerHTML = defaultCoverSvg;
    return;
  }
  const existingImg = coverEl.querySelector("img");
  const src1x = proxyUrl(urlOrNull, COVER_DISPLAY_WIDTH, 1, "jpeg", 80);
  const src2x = proxyUrl(urlOrNull, COVER_DISPLAY_WIDTH, 2, "jpeg", 80);
  if (existingImg) {
    const desiredSrcset = `${src1x} 1x, ${src2x} 2x`;
    if (existingImg.src !== src1x || existingImg.srcset !== desiredSrcset) {
      existingImg.src = src1x;
      existingImg.srcset = desiredSrcset;
      existingImg.alt = "Album art";
      existingImg.width = COVER_DISPLAY_WIDTH;
      existingImg.height = COVER_DISPLAY_WIDTH;
      existingImg.decoding = "async";
    }
  } else {
    const img = document.createElement("img");
    img.src = src1x;
    img.srcset = `${src1x} 1x, ${src2x} 2x`;
    img.alt = "Album art";
    img.width = COVER_DISPLAY_WIDTH;
    img.height = COVER_DISPLAY_WIDTH;
    img.decoding = "async";
    coverEl.replaceChildren(img);
  }
}

function showStatus(show) {
  if (!statusEl) return;
  const want = show ? "flex" : "none";
  if (statusEl.style.display !== want) statusEl.style.display = want;
}

/** ===== Core flow ===== */
async function resolveCoverForTrack(track) {
  const artist = track?.artist?.["#text"] ?? "";
  const name = track?.name ?? "";
  const key = trackKeyFrom(track);

  if (coverCache.has(key)) return coverCache.get(key);

  // Try image from recenttracks first (preload via proxy so it gets cached)
  const recentUrl = imageUrlBySize(track?.image, IMAGE_SIZE);
  const okRecent = await preloadImage(
    recentUrl ? proxyUrl(recentUrl, COVER_DISPLAY_WIDTH, 1, "jpeg", 80) : ""
  );
  if (okRecent) {
    coverCache.set(key, recentUrl);
    return recentUrl;
  }

  // De-duplicate concurrent getInfo calls per track
  if (!inflightCover.has(key)) {
    inflightCover.set(
      key,
      (async () => {
        const ok = await getTrackInfoCover(artist, name);
        if (ok) coverCache.set(key, ok);
        return ok; // might be null
      })().finally(() => {
        setTimeout(() => inflightCover.delete(key), 0);
      })
    );
  }
  return await inflightCover.get(key);
}

function nextInterval({ isPlaying }) {
  if (document.hidden) return INTERVALS.hidden;
  return isPlaying ? INTERVALS.playing : INTERVALS.idle;
}

function scheduleNext(ms) {
  clearTimeout(pollTimerId);
  pollTimerId = setTimeout(pollOnce, ms);
}

async function pollOnce() {
  if (currentController) currentController.abort();
  currentController = new AbortController();

  try {
    const track = await getRecentNowPlaying();

    if (!track) {
      if (currentTrackKey !== null) currentTrackKey = null;
      setText(titleEl, "Nothing right now");
      setText(artistEl, "I'm not currently listening to any music");
      setCover(null);
      showStatus(false);
      scheduleNext(nextInterval({ isPlaying: false }));
      return;
    }

    const key = trackKeyFrom(track);
    const artist = track?.artist?.["#text"] ?? "";
    const name = track?.name ?? "";
    const url = track?.url ?? "#";

    const changed = key !== currentTrackKey;
    currentTrackKey = key;

    if (changed || lastRendered.title !== name || lastRendered.url !== url) {
      setLink(titleEl, name, url);
      lastRendered.title = name;
      lastRendered.url = url;
    }
    if (changed || lastRendered.artist !== artist) {
      setText(artistEl, artist);
      lastRendered.artist = artist;
    }

    const coverUrl = await resolveCoverForTrack(track);
    if (changed || lastRendered.cover !== (coverUrl || "")) {
      setCover(coverUrl || null);
      lastRendered.cover = coverUrl || "";
    }

    showStatus(true);
    scheduleNext(nextInterval({ isPlaying: true }));
  } catch (_err) {
    scheduleNext(Math.min(120000, INTERVALS.idle * 2)); // mild backoff
  }
}

/** Visibility-aware polling */
document.addEventListener("visibilitychange", () => {
  scheduleNext(nextInterval({ isPlaying: currentTrackKey !== null }));
});

/** Boot */
pollOnce();
