// scripts/cacheUsesIcons.mjs
// -----------------------------------------------------------------------------
// Download remote <img> sources in dist/uses/index.html and rewrite them to
// local files under dist/uses/icons. Keeps source HTML untouched.
// -----------------------------------------------------------------------------

import { readFile, writeFile, mkdir, access, copyFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const outArgIndex = process.argv.indexOf("--out");
const outRoot =
  outArgIndex !== -1 && process.argv[outArgIndex + 1]
    ? path.resolve(root, process.argv[outArgIndex + 1])
    : path.join(root, "dist");

const usesHtmlPath = path.join(outRoot, "uses", "index.html");
const iconsDir = path.join(outRoot, "uses", "icons");
const cacheRoot = path.join(root, "_cache", "uses-icons");
const cacheIconsDir = path.join(cacheRoot, "files");
const cacheManifestPath = path.join(cacheRoot, "manifest.json");

const MAX_CONCURRENCY = 8;
const FETCH_TIMEOUT_MS = 8_000;
const DUCKDUCKGO_FAVICON_BASE = "https://icons.duckduckgo.com/ip3/";
const CONTENT_TYPE_EXT = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/webp", ".webp"],
  ["image/svg+xml", ".svg"],
  ["image/gif", ".gif"],
  ["image/avif", ".avif"],
  ["image/x-icon", ".ico"],
  ["image/vnd.microsoft.icon", ".ico"],
]);

const isRemoteUrl = (value) => /^https?:\/\//i.test(value) || /^\/\//.test(value);

const normalizeUrl = (value) => (value.startsWith("//") ? `https:${value}` : value);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getExtensionFromUrl = (urlValue) => {
  try {
    const url = new URL(urlValue);
    const ext = path.extname(url.pathname);
    if (ext && ext.length <= 6) return ext;
  } catch (error) {
    // Ignore URL parsing failures and fall back to content-type.
  }

  return "";
};

const getExtensionFromType = (contentType) => {
  if (!contentType) return "";
  const type = contentType.split(";")[0].trim().toLowerCase();
  return CONTENT_TYPE_EXT.get(type) || "";
};

const resolveExtension = (urlValue, contentType) =>
  getExtensionFromUrl(urlValue) || getExtensionFromType(contentType) || ".png";

const isDuckDuckGoFavicon = (urlValue) => {
  try {
    const url = new URL(normalizeUrl(urlValue));
    return (
      url.hostname === "icons.duckduckgo.com" && url.pathname.startsWith("/ip3/")
    );
  } catch (error) {
    return false;
  }
};

const buildDuckDuckGoUrl = (urlValue) => {
  try {
    const url = new URL(normalizeUrl(urlValue));
    if (!url.hostname) return "";
    return `${DUCKDUCKGO_FAVICON_BASE}${url.hostname}.ico`;
  } catch (error) {
    return "";
  }
};

const buildFileName = (urlValue, ext) => {
  const url = new URL(urlValue);
  const host = url.hostname
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const rawBase = path.basename(url.pathname).replace(/\.[^.]+$/, "");
  const base = rawBase
    ? rawBase
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 40)
    : "icon";
  const hash = crypto.createHash("sha1").update(urlValue).digest("hex").slice(0, 8);

  return `${host}-${base}-${hash}${ext}`;
};

const fileExists = async (targetPath) => {
  try {
    await access(targetPath);
    return true;
  } catch (error) {
    return false;
  }
};

const loadManifest = async () => {
  try {
    const raw = await readFile(cacheManifestPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    console.warn(`WARN: failed to read uses icon manifest: ${error.message}`);
    return {};
  }
};

const saveManifest = async (manifest) => {
  await writeFile(cacheManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
};

const restoreFromCache = async (original, manifest, mapping) => {
  const entry = manifest[original];
  if (!entry?.fileName) return false;

  const cachePath = path.join(cacheIconsDir, entry.fileName);
  if (!(await fileExists(cachePath))) return false;

  const destPath = path.join(iconsDir, entry.fileName);
  await copyFile(cachePath, destPath);
  mapping.set(original, `/uses/icons/${entry.fileName}`);
  return true;
};

const persistIcon = async (buffer, fileName) => {
  const cachePath = path.join(cacheIconsDir, fileName);
  const destPath = path.join(iconsDir, fileName);
  await Promise.all([writeFile(cachePath, buffer), writeFile(destPath, buffer)]);
};

const fetchImage = async (urlValue) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(urlValue, {
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "",
  };
};

const extractRemoteSrcs = (html) => {
  const srcs = new Set();
  const imgRegex = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match = imgRegex.exec(html);
  while (match) {
    const src = match[1];
    if (isRemoteUrl(src)) srcs.add(src);
    match = imgRegex.exec(html);
  }
  return [...srcs];
};

const run = async () => {
  let html;
  try {
    html = await readFile(usesHtmlPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.warn(
        `WARN: uses page not found at ${path.relative(root, usesHtmlPath)}`
      );
      return;
    }
    throw error;
  }

  const remoteSrcs = extractRemoteSrcs(html);
  if (remoteSrcs.length === 0) {
    console.log("OK uses icons: no remote images found");
    return;
  }

  await mkdir(iconsDir, { recursive: true });
  await mkdir(cacheIconsDir, { recursive: true });

  const manifest = await loadManifest();

  const queue = remoteSrcs.slice();
  const mapping = new Map();
  let cacheHits = 0;
  let downloaded = 0;
  let failures = 0;

  const worker = async () => {
    while (queue.length > 0) {
      const original = queue.shift();
      if (!original) return;

      if (await restoreFromCache(original, manifest, mapping)) {
        cacheHits += 1;
        continue;
      }

      const normalized = normalizeUrl(original);
      try {
        const { buffer, contentType } = await fetchImage(normalized);
        const ext = resolveExtension(normalized, contentType);
        const fileName = buildFileName(normalized, ext);
        await persistIcon(buffer, fileName);
        manifest[original] = { fileName, sourceUrl: normalized };
        mapping.set(original, `/uses/icons/${fileName}`);
        downloaded += 1;
      } catch (error) {
        if (!isDuckDuckGoFavicon(normalized)) {
          const fallbackUrl = buildDuckDuckGoUrl(normalized);
          if (fallbackUrl) {
            try {
              const { buffer, contentType } = await fetchImage(fallbackUrl);
              const ext = resolveExtension(fallbackUrl, contentType);
              const fileName = buildFileName(fallbackUrl, ext);
              await persistIcon(buffer, fileName);
              manifest[original] = { fileName, sourceUrl: fallbackUrl };
              mapping.set(original, `/uses/icons/${fileName}`);
              downloaded += 1;
              continue;
            } catch (fallbackError) {
              failures += 1;
              console.warn(
                `WARN: failed to cache ${original} via DuckDuckGo: ${fallbackError.message}`
              );
              continue;
            }
          }
        }
        failures += 1;
        console.warn(`WARN: failed to cache ${original}: ${error.message}`);
      }
    }
  };

  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, queue.length) }, () =>
    worker()
  );
  await Promise.all(workers);

  await saveManifest(manifest);

  if (mapping.size === 0) {
    console.warn("WARN: uses icons cache skipped (all downloads failed)");
    return;
  }

  let updatedHtml = html;
  for (const [remote, local] of mapping.entries()) {
    updatedHtml = updatedHtml.replace(new RegExp(escapeRegExp(remote), "g"), local);
  }

  if (updatedHtml !== html) {
    await writeFile(usesHtmlPath, updatedHtml);
  }

  const successCount = mapping.size;
  const total = remoteSrcs.length;
  const details = [];
  if (cacheHits) details.push(`${cacheHits} restored from cache`);
  if (downloaded) details.push(`${downloaded} downloaded`);
  if (failures) details.push(`${failures} failed`);
  console.log(
    `OK uses icons: cached ${successCount}/${total} remote images` +
      (details.length ? ` (${details.join(", ")})` : "")
  );
};

run();
