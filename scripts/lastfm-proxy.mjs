import { readFile } from "node:fs/promises";
import path from "node:path";

const API_URL = "https://ws.audioscrobbler.com/2.0/";
const CACHE_TTL_MS = 15_000;
const STALE_TTL_MS = 6 * 60 * 60 * 1_000;
const REQUEST_TIMEOUT_MS = 8_000;
const PLACEHOLDER_IMAGE_HASH = "2a96cbd8b46e442fc41c2b86b821562f";
const DEFAULT_USERNAME = "pierrelouis-c";

const parseEnv = (source) => {
  const values = {};

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);

    if (!match) {
      continue;
    }

    let value = match[2];

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }

    values[match[1]] = value;
  }

  return values;
};

const loadLocalConfig = async (root) => {
  const fileValues = {};

  for (const filename of [".env", ".env.local"]) {
    try {
      Object.assign(fileValues, parseEnv(await readFile(path.join(root, filename), "utf8")));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return {
    apiKey: process.env.LASTFM_API_KEY || fileValues.LASTFM_API_KEY || "",
    username:
      process.env.LASTFM_USER || fileValues.LASTFM_USER || DEFAULT_USERNAME,
  };
};

const isAllowedUrl = (value, allowedHost) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === allowedHost || url.hostname.endsWith(`.${allowedHost}`))
    );
  } catch {
    return false;
  }
};

const getArtwork = (images) => {
  if (!Array.isArray(images)) {
    return "";
  }

  for (let index = images.length - 1; index >= 0; index -= 1) {
    const candidate = images[index]?.["#text"]?.trim() || "";

    if (
      candidate &&
      !candidate.includes(PLACEHOLDER_IMAGE_HASH) &&
      (isAllowedUrl(candidate, "lastfm.freetls.fastly.net") ||
        isAllowedUrl(candidate, "lastfm-img.freetls.fastly.net") ||
        isAllowedUrl(candidate, "lastfm-img2.akamaized.net"))
    ) {
      return candidate;
    }
  }

  return "";
};

const getArtworkFromHtml = (html) => {
  if (typeof html !== "string") {
    return "";
  }

  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = {};

    for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gis)) {
      attributes[match[1].toLowerCase()] = match[3];
    }

    const key = (attributes.property || attributes.name || "").toLowerCase();
    const candidate = (attributes.content || "")
      .replaceAll("&amp;", "&")
      .trim();

    if (
      ["og:image", "twitter:image"].includes(key) &&
      (isAllowedUrl(candidate, "lastfm.freetls.fastly.net") ||
        isAllowedUrl(candidate, "lastfm-img.freetls.fastly.net") ||
        isAllowedUrl(candidate, "lastfm-img2.akamaized.net"))
    ) {
      return candidate;
    }
  }

  return "";
};

export const normalizeLastfmResponse = (data, fetchedAt = Date.now()) => {
  const tracks = data?.recenttracks?.track;
  const track = Array.isArray(tracks) ? tracks[0] : null;

  if (!track) {
    return {
      track: null,
      stale: false,
      updatedAt: new Date(fetchedAt).toISOString(),
    };
  }

  const name = typeof track.name === "string" ? track.name.trim() : "";
  const artist =
    typeof track.artist?.["#text"] === "string"
      ? track.artist["#text"].trim()
      : "";

  if (!name || !artist) {
    throw new Error("Last.fm response did not contain a valid track");
  }

  const rawTrackUrl = typeof track.url === "string" ? track.url.trim() : "";
  const rawPlayedAt = Number(track.date?.uts);
  const playedAt = Number.isFinite(rawPlayedAt) && rawPlayedAt > 0
    ? new Date(rawPlayedAt * 1_000).toISOString()
    : null;

  return {
    track: {
      name,
      artist,
      album:
        typeof track.album?.["#text"] === "string"
          ? track.album["#text"].trim()
          : "",
      url: isAllowedUrl(rawTrackUrl, "last.fm") ? rawTrackUrl : "",
      image: getArtwork(track.image),
      nowPlaying: track["@attr"]?.nowplaying === "true",
      playedAt,
    },
    stale: false,
    updatedAt: new Date(fetchedAt).toISOString(),
  };
};

const stalePayload = (payload) => ({
  ...payload,
  stale: true,
  track: payload.track
    ? {
        ...payload.track,
        nowPlaying: false,
      }
    : null,
});

const writeJson = (response, status, payload) => {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
  });
  response.end(JSON.stringify(payload));
};

export const createLastfmProxy = ({
  root,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
} = {}) => {
  let cache = null;
  let configPromise = null;
  let inFlight = null;

  const fetchLatest = async () => {
    const config = await (configPromise ??= loadLocalConfig(root));

    if (!config.apiKey) {
      const error = new Error("LASTFM_API_KEY is missing");
      error.code = "LASTFM_CONFIG_MISSING";
      throw error;
    }

    const url = new URL(API_URL);
    url.search = new URLSearchParams({
      method: "user.getrecenttracks",
      user: config.username,
      api_key: config.apiKey,
      format: "json",
      limit: "1",
    }).toString();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const upstream = await fetchImpl(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "pierrelouis.net-local-dev/1.0",
        },
        signal: controller.signal,
      });

      if (!upstream.ok) {
        throw new Error(`Last.fm returned ${upstream.status}`);
      }

      const data = await upstream.json();

      if (data?.error) {
        throw new Error(`Last.fm API error ${data.error}`);
      }

      const fetchedAt = now();
      const payload = normalizeLastfmResponse(data, fetchedAt);

      if (payload.track && !payload.track.image) {
        const previousTrack = cache?.payload?.track;
        const canReuseArtwork =
          previousTrack?.name === payload.track.name &&
          previousTrack?.artist === payload.track.artist &&
          previousTrack?.image;

        if (canReuseArtwork) {
          payload.track.image = previousTrack.image;
        } else if (payload.track.url) {
          try {
            const artworkPage = await fetchImpl(payload.track.url, {
              headers: {
                Accept: "text/html",
                "User-Agent": "pierrelouis.net-local-dev/1.0",
              },
              signal: controller.signal,
            });

            if (artworkPage.ok) {
              payload.track.image = getArtworkFromHtml(await artworkPage.text());
            }
          } catch {
            // Artwork is optional; keep the scrobble available if its page fails.
          }
        }
      }

      cache = { fetchedAt, payload };
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  };

  return async (request, response) => {
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      writeJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    const cacheAge = cache ? now() - cache.fetchedAt : Number.POSITIVE_INFINITY;

    if (cache && cacheAge < CACHE_TTL_MS) {
      writeJson(response, 200, cache.payload);
      return;
    }

    try {
      inFlight ??= fetchLatest().finally(() => {
        inFlight = null;
      });
      writeJson(response, 200, await inFlight);
    } catch (error) {
      if (cache && cacheAge < STALE_TTL_MS) {
        writeJson(response, 200, stalePayload(cache.payload));
        return;
      }

      writeJson(
        response,
        error.code === "LASTFM_CONFIG_MISSING" ? 503 : 502,
        {
          error:
            error.code === "LASTFM_CONFIG_MISSING"
              ? "local_config_missing"
              : "temporarily_unavailable",
        },
      );
    }
  };
};
