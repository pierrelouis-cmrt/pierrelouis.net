"use strict";

/** ===== Config ===== */
const API_KEY = "71608a96243f764afe28114be64c6e01"; // Consider moving server-side
const USER = "pierrelouis-c";

// Polling cadence (ms)
const INTERVALS = {
  playing: 15000, // when music is playing
  idle: 60000, // when nothing is playing
  hidden: 120000, // when tab is hidden
};

const API_BASE = "https://ws.audioscrobbler.com/2.0/";
const REQUEST_TIMEOUT_MS = 8000; // hard timeout per request

/** ===== DOM ===== */
const titleEl = document.querySelector(".now-playing .title");
const artistEl = document.querySelector(".now-playing .artist");
const coverEl = document.querySelector(".now-playing .cover");
const statusEl = document.querySelector(".now-playing .status");
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

function looksLikeLastfmPlaceholder(url) {
  if (!url) return true;
  // Last.fm default placeholder commonly contains this hash file
  return url.includes("2a96cbd8b46e442fc41c2b86b821562f.png");
}

function buildUrl(method, params = {}) {
  const u = new URL(API_BASE);
  u.searchParams.set("method", method);
  u.searchParams.set("api_key", API_KEY);
  u.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  return u.toString();
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
        // Other errors: stop
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

/** Preload an image to verify it actually loads; resolves with URL or null */
function preloadImage(url) {
  return new Promise((resolve) => {
    if (!url || looksLikeLastfmPlaceholder(url)) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** ===== API wrappers ===== */
async function getRecentNowPlaying() {
  const url = buildUrl("user.getrecenttracks", { user: USER, limit: 1 });
  const data = await fetchJsonWithRetry(url, { retries: 2 });
  const list = data?.recenttracks?.track;
  if (!Array.isArray(list) || list.length === 0) return null;
  const t = list[0];
  const now = t?.["@attr"]?.nowplaying === "true";
  return now ? t : null; // return only if now playing
}

async function getTrackInfoCover(artist, track) {
  const url = buildUrl("track.getInfo", { artist, track });
  const data = await fetchJsonWithRetry(url, { retries: 2 });
  const images = data?.track?.album?.image;
  const urlCandidate = lastNonEmptyImageUrl(images);
  return await preloadImage(urlCandidate);
}

/** ===== Rendering ===== */
function setLink(el, text, url) {
  if (!el) return;
  // Reuse / update existing anchor if present
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
  if (existingImg) {
    if (existingImg.src !== urlOrNull) {
      existingImg.src = urlOrNull;
      existingImg.alt = "Album art";
      existingImg.width = 75;
      existingImg.height = 75;
    }
  } else {
    const img = document.createElement("img");
    img.src = urlOrNull;
    img.alt = "Album art";
    img.width = 75;
    img.height = 75;
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

  // try image from recenttracks first
  const recentUrl = lastNonEmptyImageUrl(track?.image);
  const okRecent = await preloadImage(recentUrl);
  if (okRecent) {
    coverCache.set(key, okRecent);
    return okRecent;
  }

  // de-duplicate concurrent getInfo calls per track
  if (!inflightCover.has(key)) {
    inflightCover.set(
      key,
      (async () => {
        const ok = await getTrackInfoCover(artist, name);
        if (ok) coverCache.set(key, ok);
        return ok; // might be null
      })().finally(() => {
        // Keep the promise around only while in flight
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
  // cancel any prior in-flight poll
  if (currentController) currentController.abort();
  currentController = new AbortController();

  try {
    const track = await getRecentNowPlaying();

    if (!track) {
      // nothing playing
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

    // Update text/link only if changed
    if (changed || lastRendered.title !== name || lastRendered.url !== url) {
      setLink(titleEl, name, url);
      lastRendered.title = name;
      lastRendered.url = url;
    }
    if (changed || lastRendered.artist !== artist) {
      setText(artistEl, artist);
      lastRendered.artist = artist;
    }

    // Cover: prefer cache, then resolve once (preload validated)
    const coverUrl = await resolveCoverForTrack(track);
    if (changed || lastRendered.cover !== (coverUrl || "")) {
      if (coverUrl) {
        setCover(coverUrl);
      } else {
        // fallback to default svg
        setCover(null);
      }
      lastRendered.cover = coverUrl || "";
    }

    showStatus(true);
    scheduleNext(nextInterval({ isPlaying: true }));
  } catch (err) {
    // Network/API issue: show previous UI if any; back off
    // Optionally, log err.message
    scheduleNext(Math.min(120000, INTERVALS.idle * 2)); // mild backoff
  }
}

/** Visibility-aware polling */
document.addEventListener("visibilitychange", () => {
  // Re-schedule immediately with the appropriate interval when visibility changes
  scheduleNext(nextInterval({ isPlaying: currentTrackKey !== null }));
});

/** Boot */
pollOnce();
