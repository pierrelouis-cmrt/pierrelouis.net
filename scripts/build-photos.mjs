import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applySharedComponents } from "./shared-components.mjs";
import { parseYaml } from "./lib/yaml.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = path.join(ROOT, "content", "photos");
const ASSETS_DIR = path.join(ROOT, "assets", "photos");
const FULL_ASSETS_DIR = path.join(ROOT, "assets", "photos-full");
const PHOTOS_DIR = path.join(ROOT, "photos");
const ASSET_CACHE_FILE = path.join(ASSETS_DIR, ".build-cache.json");
const ASSET_CACHE_VERSION = 1;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
// Gallery tiles are capped at 520 CSS pixels. 1040px keeps thumbnails sharp
// on standard high-density screens without downloading the original image.
const THUMBNAIL_MAX_EDGE = 1040;
const THUMBNAIL_WEBP_QUALITY = 82;
// The lightbox is constrained by the viewport. A 2560px edge remains sharp on
// high-density laptop displays and 4K screens without shipping camera-sized
// pixels that cannot be displayed.
export const PHOTO_FULL_MAX_EDGE = 2560;
const FULL_WEBP_QUALITY = 84;
// ImageMagick is itself multithreaded and source photos can be large, so a small
// worker pool improves cold builds without multiplying peak memory usage.
const IMAGE_BUILD_CONCURRENCY = Math.min(2, os.availableParallelism());
const ASSET_VARIANTS = {
  thumbnail: {
    directory: ASSETS_DIR,
    options: {
      maxEdge: THUMBNAIL_MAX_EDGE,
      quality: THUMBNAIL_WEBP_QUALITY,
    },
  },
  full: {
    directory: FULL_ASSETS_DIR,
    options: {
      maxEdge: PHOTO_FULL_MAX_EDGE,
      quality: FULL_WEBP_QUALITY,
    },
  },
};
const PHOTOS_PAGE = {
  title: "Photos - Pierre-Louis",
  description:
    "Some of Pierre-Louis' best shots from trips and everyday life.",
  url: "https://pierrelouis.net/photos/",
  heading: "Photos",
  intro:
    "Some of my best shots from trips or everyday life. Everything was shot on iPhone 15 Pro and (sometimes) edited on Lightroom.",
  introLabel: "Photos introduction",
  filtersLabel: "Photo filters",
  countryFiltersLabel: "Countries",
  allPhotosLabel: "All",
  searchLabel: "Search photos",
  searchPlaceholder: "Search place, color, mood...",
  noResultsMessage: "No photos found",
  albumsLabel: "Photo albums",
  lightboxLabel: "Expanded photo",
  closeLightboxLabel: "Close expanded photo",
  lightboxNavigationLabel: "Photo navigation",
  previousPhotoLabel: "Previous photo",
  nextPhotoLabel: "Next photo",
  closeLabel: "Close",
};

const CURRENT_YEAR = new Date().getFullYear();

const isDirectRun = () => {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const readCollectionFile = async (directory) => {
  for (const filename of ["collection.yml", "collection.yaml"]) {
    const filePath = path.join(directory, filename);

    try {
      return {
        filePath,
        data: parseYaml(await readFile(filePath, "utf8")),
      };
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw new Error(`Missing collection.yml in ${path.relative(ROOT, directory)}`);
};

const discoverPhotoFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((filename) => IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};

const toArray = (value) => {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (value == null || value === "") {
    return [];
  }

  return [String(value)];
};

const normalizeOptionalNumber = (value, fieldName, directoryName) => {
  if (value == null || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(`${directoryName}/collection.yml has invalid "${fieldName}"`);
  }

  return number;
};

const normalizeYearNumber = (value, fieldName, directoryName) => {
  const year = Number(value);

  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error(`${directoryName}/collection.yml has invalid "${fieldName}"`);
  }

  return year;
};

const normalizeYearRangeBoundary = (value, fieldName, directoryName) => {
  if (String(value).toLowerCase() === "current") {
    return {
      year: CURRENT_YEAR,
      label: "current",
    };
  }

  const year = normalizeYearNumber(value, fieldName, directoryName);

  return {
    year,
    label: String(year),
  };
};

const normalizeCollectionYears = (data, directoryName) => {
  if (data.years != null && data.years !== "") {
    const years = Array.isArray(data.years)
      ? {
          start: data.years[0],
          end: data.years[1],
        }
      : data.years;

    if (!years || typeof years !== "object" || years.start == null || years.end == null) {
      throw new Error(`${directoryName}/collection.yml "years" must include "start" and "end"`);
    }

    const start = normalizeYearRangeBoundary(years.start, "years.start", directoryName);
    const end = normalizeYearRangeBoundary(years.end, "years.end", directoryName);
    const startYear = start.year;
    const endYear = end.year;

    if (startYear > endYear) {
      throw new Error(`${directoryName}/collection.yml "years.start" must be before "years.end"`);
    }

    return {
      startYear,
      endYear,
      year: endYear,
      dateLabel: startYear === endYear && end.label !== "current"
        ? String(endYear)
        : `${start.label}-${end.label}`,
    };
  }

  if (data.year == null || data.year === "") {
    throw new Error(`${directoryName}/collection.yml is missing "year" or "years"`);
  }

  const year = normalizeYearNumber(data.year, "year", directoryName);

  return {
    startYear: year,
    endYear: year,
    year,
    dateLabel: String(year),
  };
};

const normalizeCollection = async (directoryName) => {
  const sourceDir = path.join(CONTENT_DIR, directoryName);
  const { data } = await readCollectionFile(sourceDir);
  const discoveredFiles = await discoverPhotoFiles(sourceDir);
  const photos = Array.isArray(data.photos)
    ? data.photos
    : discoveredFiles.map((file) => ({ file }));

  for (const field of ["place", "country", "description"]) {
    if (!data[field]) {
      throw new Error(`${directoryName}/collection.yml is missing "${field}"`);
    }
  }

  const years = normalizeCollectionYears(data, directoryName);

  if (photos.length === 0) {
    throw new Error(`${directoryName} has no photos`);
  }

  return {
    id: data.id || directoryName,
    ...years,
    order: normalizeOptionalNumber(data.order, "order", directoryName),
    place: String(data.place),
    country: String(data.country),
    description: String(data.description),
    tags: toArray(data.tags),
    sourceDir,
    photos: photos.map((photo, index) => {
      if (!photo.file) {
        throw new Error(`${directoryName}/collection.yml photo #${index + 1} is missing "file"`);
      }

      return {
        id: photo.id || `${directoryName}-${String(index + 1).padStart(2, "0")}`,
        file: String(photo.file),
        sourceIndex: index,
        favorite: Boolean(photo.favorite),
        alt: photo.alt || `${data.place}, ${data.country} photo ${index + 1}`,
        themes: toArray(photo.themes),
        colors: toArray(photo.colors),
        vibe: toArray(photo.vibe),
      };
    }).sort((a, b) => {
      return Number(b.favorite) - Number(a.favorite) || a.sourceIndex - b.sourceIndex;
    }),
  };
};

const loadCollections = async () => {
  const entries = await readdir(CONTENT_DIR, { withFileTypes: true });
  const directoryNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  const collections = [];

  for (const directoryName of directoryNames) {
    collections.push(await normalizeCollection(directoryName));
  }

  return collections.sort((a, b) => {
    return (
      (a.order ?? Number.POSITIVE_INFINITY) -
        (b.order ?? Number.POSITIVE_INFINITY) ||
      b.endYear - a.endYear ||
      b.startYear - a.startYear ||
      a.country.localeCompare(b.country) ||
      a.place.localeCompare(b.place) ||
      a.id.localeCompare(b.id)
    );
  });
};

const runImageMagick = (args) =>
  new Promise((resolve, reject) => {
    const process = spawn("magick", args, { stdio: "inherit" });

    process.on("error", reject);
    process.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`ImageMagick failed with exit code ${code}`));
    });
  });

const getWebpFilename = (filename) => `${path.parse(filename).name}.webp`;

const toPosixPath = (value) => value.split(path.sep).join("/");

const getRelativePath = (filePath) => toPosixPath(path.relative(ROOT, filePath));

const readAssetCache = async () => {
  try {
    const cache = JSON.parse(await readFile(ASSET_CACHE_FILE, "utf8"));

    if (cache.version !== ASSET_CACHE_VERSION || !cache.entries) {
      return {};
    }

    return cache.entries;
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
};

const writeAssetCache = async (entries) => {
  await mkdir(ASSETS_DIR, { recursive: true });
  await writeFile(
    ASSET_CACHE_FILE,
    `${JSON.stringify(
      {
        version: ASSET_CACHE_VERSION,
        entries,
      },
      null,
      2,
    )}\n`,
  );
};

const getSourceSignature = async (source) => {
  const sourceStat = await stat(source);

  return {
    path: getRelativePath(source),
    size: sourceStat.size,
    mtimeMs: sourceStat.mtimeMs,
  };
};

const getAssetCacheKey = (variantName, collectionId, filename) =>
  `${variantName}:${collectionId}/${filename}`;

const signaturesMatch = (entry, sourceSignature, variantOptions) => {
  return (
    entry?.source?.path === sourceSignature.path &&
    entry.source.size === sourceSignature.size &&
    entry.source.mtimeMs === sourceSignature.mtimeMs &&
    JSON.stringify(entry.options) === JSON.stringify(variantOptions)
  );
};

const isGeneratedAssetCurrent = async (target, entry, sourceSignature, variantOptions) => {
  try {
    const targetStat = await stat(target);

    if (targetStat.size === 0) {
      return false;
    }

    if (entry) {
      return signaturesMatch(entry, sourceSignature, variantOptions);
    }

    return targetStat.mtimeMs >= sourceSignature.mtimeMs;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
};

const generateThumbnail = (source, target) =>
  runImageMagick([
    source,
    "-auto-orient",
    "-resize",
    `${THUMBNAIL_MAX_EDGE}x${THUMBNAIL_MAX_EDGE}>`,
    "-strip",
    "-quality",
    String(THUMBNAIL_WEBP_QUALITY),
    target,
  ]);

const generateFullImage = (source, target) =>
  runImageMagick([
    source,
    "-auto-orient",
    "-resize",
    `${PHOTO_FULL_MAX_EDGE}x${PHOTO_FULL_MAX_EDGE}>`,
    "-strip",
    "-quality",
    String(FULL_WEBP_QUALITY),
    target,
  ]);

const generateAssetVariant = async ({
  cache,
  collection,
  filename,
  source,
  sourceSignature,
  stats,
  target,
  variantName,
}) => {
  const variant = ASSET_VARIANTS[variantName];
  const cacheKey = getAssetCacheKey(variantName, collection.id, filename);
  const cacheEntry = cache[cacheKey];

  if (await isGeneratedAssetCurrent(target, cacheEntry, sourceSignature, variant.options)) {
    cache[cacheKey] = {
      source: sourceSignature,
      output: getRelativePath(target),
      options: variant.options,
    };
    stats.skipped += 1;
    return;
  }

  if (variantName === "thumbnail") {
    await generateThumbnail(source, target);
  } else {
    await generateFullImage(source, target);
  }

  cache[cacheKey] = {
    source: sourceSignature,
    output: getRelativePath(target),
    options: variant.options,
  };
  stats.generated += 1;
};

const removeStaleGeneratedAssets = async (rootDir, expectedFilesByCollection) => {
  let removed = 0;

  try {
    await mkdir(rootDir, { recursive: true });
    const collectionEntries = await readdir(rootDir, { withFileTypes: true });

    for (const collectionEntry of collectionEntries) {
      if (collectionEntry.name === path.basename(ASSET_CACHE_FILE)) {
        continue;
      }

      const collectionPath = path.join(rootDir, collectionEntry.name);

      if (!collectionEntry.isDirectory()) {
        await rm(collectionPath, { force: true, recursive: true });
        removed += 1;
        continue;
      }

      const expectedFiles = expectedFilesByCollection.get(collectionEntry.name);

      if (!expectedFiles) {
        await rm(collectionPath, { force: true, recursive: true });
        removed += 1;
        continue;
      }

      const fileEntries = await readdir(collectionPath, { withFileTypes: true });

      for (const fileEntry of fileEntries) {
        if (expectedFiles.has(fileEntry.name)) {
          continue;
        }

        await rm(path.join(collectionPath, fileEntry.name), { force: true, recursive: true });
        removed += 1;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  return removed;
};

const pruneAssetCache = (cache, expectedCacheKeys) => {
  let removed = 0;

  for (const cacheKey of Object.keys(cache)) {
    if (!expectedCacheKeys.has(cacheKey)) {
      delete cache[cacheKey];
      removed += 1;
    }
  }

  return removed;
};

const runWithConcurrency = async (items, limit, worker) => {
  let failure = null;
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (!failure && nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;

        try {
          await worker(item);
        } catch (error) {
          failure ||= error;
        }
      }
    }),
  );

  if (failure) {
    throw failure;
  }
};

const generateCollectionAssets = async (collections) => {
  const cache = await readAssetCache();
  const expectedFilesByCollection = new Map();
  const expectedCacheKeys = new Set();
  const jobs = [];
  const stats = {
    generated: 0,
    skipped: 0,
    removed: 0,
  };

  for (const collection of collections) {
    const thumbnailDir = path.join(ASSETS_DIR, collection.id);
    const fullDir = path.join(FULL_ASSETS_DIR, collection.id);
    await Promise.all([
      mkdir(thumbnailDir, { recursive: true }),
      mkdir(fullDir, { recursive: true }),
    ]);
    expectedFilesByCollection.set(collection.id, new Set());

    for (const photo of collection.photos) {
      const source = path.join(collection.sourceDir, photo.file);
      const filename = getWebpFilename(photo.file);
      const thumbnail = path.join(thumbnailDir, filename);
      const full = path.join(fullDir, filename);

      expectedFilesByCollection.get(collection.id).add(filename);

      for (const variantName of Object.keys(ASSET_VARIANTS)) {
        expectedCacheKeys.add(getAssetCacheKey(variantName, collection.id, filename));
      }

      jobs.push({ collection, filename, full, source, thumbnail });

      photo.src = `../assets/photos/${collection.id}/${filename}`;
      photo.fullSrc = `../assets/photos-full/${collection.id}/${filename}`;
    }
  }

  await runWithConcurrency(jobs, IMAGE_BUILD_CONCURRENCY, async (job) => {
    const sourceSignature = await getSourceSignature(job.source);

    await generateAssetVariant({
      cache,
      collection: job.collection,
      filename: job.filename,
      source: job.source,
      sourceSignature,
      stats,
      target: job.thumbnail,
      variantName: "thumbnail",
    });
    await generateAssetVariant({
      cache,
      collection: job.collection,
      filename: job.filename,
      source: job.source,
      sourceSignature,
      stats,
      target: job.full,
      variantName: "full",
    });
  });

  stats.removed += await removeStaleGeneratedAssets(ASSETS_DIR, expectedFilesByCollection);
  stats.removed += await removeStaleGeneratedAssets(FULL_ASSETS_DIR, expectedFilesByCollection);
  stats.removed += pruneAssetCache(cache, expectedCacheKeys);

  await writeAssetCache(cache);

  return stats;
};

const getCountries = (collections) => {
  return [...new Set(collections.map((collection) => collection.country))]
    .sort((a, b) => a.localeCompare(b));
};

const getPhotoCount = (collections) => {
  return collections.reduce((total, collection) => total + collection.photos.length, 0);
};

const getCountryPhotoCounts = (collections) => {
  return collections.reduce((counts, collection) => {
    counts.set(
      collection.country,
      (counts.get(collection.country) || 0) + collection.photos.length,
    );

    return counts;
  }, new Map());
};

const getOgImage = (collections) => {
  return collections[0]?.photos[0]?.src.replace(/^\.\.\//, "https://pierrelouis.net/") ??
    "https://pierrelouis.net/assets/image_featured_1.webp";
};

const renderDataAttribute = (items) => escapeHtml(items.join(", "));

const getYearSearchTerms = (collection) => {
  if (collection.startYear === collection.endYear) {
    return [collection.year];
  }

  if (collection.endYear - collection.startYear > 50) {
    return [collection.startYear, collection.endYear, collection.dateLabel];
  }

  return [
    collection.dateLabel,
    ...Array.from(
      { length: collection.endYear - collection.startYear + 1 },
      (_, index) => collection.startYear + index,
    ),
  ];
};

const normalizeSearchValue = (items) => {
  return items
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

const renderPhotoFigure = (photo, index, collection) => {
  const searchText = normalizeSearchValue([
    getYearSearchTerms(collection),
    collection.place,
    collection.country,
    collection.description,
    collection.tags,
    photo.alt,
    photo.themes,
    photo.colors,
    photo.vibe,
  ]);

  const favoriteMarker = photo.favorite
    ? `
                <span class="photo-card__favorite" aria-label="Favorite photo">★</span>`
    : "";
  const noScriptFallback = `
                  <noscript>
                    <img
                      class="photo-card__image"
                      src="${escapeHtml(photo.src)}"
                      alt=""
                    />
                  </noscript>`;

  return `              <figure
                class="photo-card"
                data-country="${escapeHtml(collection.country)}"
                data-favorite="${photo.favorite ? "true" : "false"}"
                data-themes="${renderDataAttribute(photo.themes)}"
                data-colors="${renderDataAttribute(photo.colors)}"
                data-vibe="${renderDataAttribute(photo.vibe)}"
                data-search="${escapeHtml(searchText)}"
              >
                <button
                  class="photo-card__trigger"
                  type="button"
                  data-photo-zoom
                  data-full-src="${escapeHtml(photo.fullSrc)}"
                  data-alt="${escapeHtml(photo.alt)}"
                  aria-label="Open ${escapeHtml(photo.alt)} in full size"
                >
                  <img
                    class="photo-card__image"
                    data-deferred-src="${escapeHtml(photo.src)}"
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />${noScriptFallback}
                </button>${favoriteMarker}
                <figcaption class="photo-card__index">${String(index + 1).padStart(2, "0")}</figcaption>
              </figure>`;
};

const renderCollection = (collection) => {
  const collectionSearchText = normalizeSearchValue([
    getYearSearchTerms(collection),
    collection.place,
    collection.country,
    collection.description,
    collection.tags,
  ]);
  const photos = collection.photos
    .map((photo, index) => renderPhotoFigure(photo, index, collection))
    .join("\n");

  return `          <article
            class="photo-album"
            data-album-id="${escapeHtml(collection.id)}"
            data-place="${escapeHtml(collection.place)}"
            data-country="${escapeHtml(collection.country)}"
            data-tags="${renderDataAttribute(collection.tags)}"
            data-search="${escapeHtml(collectionSearchText)}"
          >
            <header class="photo-album__header">
              <div class="photo-album__identity">
                <span class="photo-album__year">${escapeHtml(collection.dateLabel)}</span>
                <h2 class="photo-album__title">${escapeHtml(collection.place)}, ${escapeHtml(collection.country)}</h2>
              </div>
              <p class="photo-album__description">
                ${escapeHtml(collection.description)}
              </p>
            </header>

            <div class="photo-grid">
${photos}
            </div>
          </article>`;
};

const renderCountryFilters = (collections) => {
  const countries = getCountries(collections);
  const countryCounts = getCountryPhotoCounts(collections);
  const totalCount = getPhotoCount(collections);
  const allButton = `<button
                  class="content-filter__button is-active"
                  type="button"
                  data-country-filter="all"
                  aria-pressed="true"
                >
                  <span>${escapeHtml(PHOTOS_PAGE.allPhotosLabel)}</span>
                  <span class="content-filter__count" data-filter-count>${totalCount}</span>
                </button>`;
  const countryButtons = countries
    .map((country) => {
      return `<button
                  class="content-filter__button"
                  type="button"
                  data-country-filter="${escapeHtml(country)}"
                  aria-pressed="false"
                >
                  <span>${escapeHtml(country)}</span>
                  <span class="content-filter__count" data-filter-count hidden>${countryCounts.get(country) || 0}</span>
                </button>`;
    })
    .join("\n");

  return `${allButton}\n${countryButtons}`;
};

const renderPage = (collections) => {
  const albums = collections.map(renderCollection).join("\n\n");

  const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover"
    />
    <title>${escapeHtml(PHOTOS_PAGE.title)}</title>
    <meta
      name="description"
      content="${escapeHtml(PHOTOS_PAGE.description)}"
    />
    <meta property="og:title" content="${escapeHtml(PHOTOS_PAGE.title)}" />
    <meta
      property="og:description"
      content="${escapeHtml(PHOTOS_PAGE.description)}"
    />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(PHOTOS_PAGE.url)}" />
    <meta
      property="og:image"
      content="${escapeHtml(getOgImage(collections))}"
    />
    <link
      rel="icon"
      type="image/png"
      href="/favicon/favicon-96x96.png"
      sizes="96x96"
    />
    <link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg" />
    <link rel="shortcut icon" href="/favicon/favicon.ico" />
    <link
      rel="apple-touch-icon"
      sizes="180x180"
      href="/favicon/apple-touch-icon.png"
    />
    <meta name="apple-mobile-web-app-title" content="Pierre-Louis" />
    <link rel="manifest" href="/favicon/site.webmanifest" />
    <link rel="stylesheet" href="../base.css" />
    <link rel="stylesheet" href="./photos.css" />
    <script src="../script.js" defer></script>
    <script src="./photos.js" defer></script>
    <script src="../footer.js" defer></script>
  </head>
  <body>
    <div class="site-shell photos-page">
      <header class="site-header" aria-label="Primary navigation">
        <a class="brand-mark" href="../" aria-label="Pierre-Louis home">
          <span class="brand-mark__text">P—L</span>
          <span class="brand-mark__copyright" aria-hidden="true">©</span>
        </a>

        <nav class="primary-nav" aria-label="Main pages">
          <a class="primary-nav__link" href="../projects/">Projects</a>
          <a class="primary-nav__link" href="../posts/">Posts</a>
          <a
            class="primary-nav__link"
            href="../photos/"
            aria-current="page"
            >Photos</a
          >
        </nav>

        <div class="more-menu" data-more-menu>
          <button
            class="more-menu__toggle"
            type="button"
            aria-expanded="false"
            aria-controls="more-menu-panel"
            data-more-menu-toggle
          >
            More <span aria-hidden="true">↓</span>
          </button>

          <nav
            class="more-menu__panel"
            id="more-menu-panel"
            aria-label="More pages"
            data-more-menu-panel
            hidden
          >
            <a class="more-menu__link" href="../about/">About</a>
            <a class="more-menu__link" href="../now/">Now</a>
            <a class="more-menu__link" href="../someday/">Someday</a>
            <a class="more-menu__link" href="../lists/">Lists</a>
          </nav>
        </div>

        <div class="mobile-menu" data-mobile-menu>
          <button
            class="mobile-menu__toggle"
            type="button"
            aria-label="Open menu"
            aria-expanded="false"
            aria-controls="mobile-menu-panel"
            data-mobile-menu-toggle
          >
            <span class="mobile-menu__toggle-line"></span>
            <span class="mobile-menu__toggle-line"></span>
          </button>

          <div
            class="mobile-menu__panel"
            id="mobile-menu-panel"
            data-mobile-menu-panel
            hidden
          >
            <div class="mobile-menu__bar">
              <a
                class="mobile-menu__brand"
                href="../"
                aria-label="Pierre-Louis home"
              >
                <span class="brand-mark__text">P—L</span>
                <span class="brand-mark__copyright" aria-hidden="true">©</span>
              </a>
            </div>

            <div class="mobile-menu__layout">
              <section
                class="mobile-menu__section mobile-menu__section--main"
                aria-labelledby="mobile-menu-main"
              >
                <h2 class="mobile-menu__eyebrow" id="mobile-menu-main">
                  Main Pages
                </h2>
                <nav class="mobile-menu__links" aria-label="Main pages">
                  <a class="mobile-menu__link" href="../projects/">Projects</a>
                  <a class="mobile-menu__link" href="../posts/">Posts</a>
                  <a
                    class="mobile-menu__link"
                    href="../photos/"
                    aria-current="page"
                    >Photos</a
                  >
                </nav>
              </section>

              <section
                class="mobile-menu__section mobile-menu__section--latest"
                aria-labelledby="mobile-menu-latest"
              >
                <h2 class="mobile-menu__eyebrow" id="mobile-menu-latest">
                  Latest
                </h2>
                <a
                  class="mobile-menu__latest-link"
                  href="../projects/sweetgreen-nicolandria/"
                >
                  <span class="mobile-menu__latest-title"
                    >Sweetgreen: Nicolandria</span
                  >
                  <span class="mobile-menu__latest-media" aria-hidden="true">
                    <img
                      class="mobile-menu__latest-image"
                      src="../assets/projects/featured/sweetgreen-nicolandria/listing/03.webp"
                      alt=""
                    />
                  </span>
                  <span class="mobile-menu__see-more">See More <span aria-hidden="true">↗</span></span>
                </a>
              </section>

              <section
                class="mobile-menu__section mobile-menu__section--about"
                aria-labelledby="mobile-menu-about"
              >
                <h2 class="mobile-menu__eyebrow" id="mobile-menu-about">
                  More About Me
                </h2>
                <nav class="mobile-menu__links" aria-label="More about me">
                  <a class="mobile-menu__link" href="../about/">Who I am</a>
                  <a class="mobile-menu__link" href="../now/"
                    >What I'm doing</a
                  >
                  <a class="mobile-menu__link" href="../someday/"
                    >Where I'm going</a
                  >
                </nav>
              </section>

              <section
                class="mobile-menu__section mobile-menu__section--links"
                aria-labelledby="mobile-menu-links"
              >
                <h2 class="mobile-menu__eyebrow" id="mobile-menu-links">
                  More Links
                </h2>
                <nav class="mobile-menu__links" aria-label="More links">
                  <a class="mobile-menu__link" href="../lists/">Catalogs</a>
                  <a class="mobile-menu__link" href="../links/"
                    >Links &amp; Socials</a
                  >
                </nav>
              </section>
            </div>

            <img
              class="mobile-menu__watermark"
              src="../assets/image_mobile_watermark.png"
              alt=""
              aria-hidden="true"
            />
          </div>
        </div>
      </header>

      <main>
        <h1 class="sr-only">${escapeHtml(PHOTOS_PAGE.heading)}</h1>

        <section class="photos-intro page-intro" aria-label="${escapeHtml(PHOTOS_PAGE.introLabel)}">
          <div class="content-filter" aria-label="${escapeHtml(PHOTOS_PAGE.filtersLabel)}" data-photo-filters>
            <span
              class="content-filter__symbol content-filter__symbol--photos"
              aria-hidden="true"
            ></span>
            <div class="content-filter__content">
              <div class="content-filter__options" aria-label="${escapeHtml(PHOTOS_PAGE.countryFiltersLabel)}">
${renderCountryFilters(collections)}
              </div>
              <label class="content-filter__search">
                <span class="sr-only">${escapeHtml(PHOTOS_PAGE.searchLabel)}</span>
                <input
                  class="content-filter__input"
                  type="search"
                  placeholder="${escapeHtml(PHOTOS_PAGE.searchPlaceholder)}"
                  autocomplete="off"
                  spellcheck="false"
                  data-photo-search
                />
              </label>
              <p class="content-filter__empty" data-photo-empty hidden>
                ${escapeHtml(PHOTOS_PAGE.noResultsMessage)}
              </p>
            </div>
          </div>

          <p class="photos-intro__copy intro-copy">
            ${escapeHtml(PHOTOS_PAGE.intro)}
          </p>
        </section>

        <section class="photo-albums" aria-label="${escapeHtml(PHOTOS_PAGE.albumsLabel)}">
${albums}
        </section>
      </main>

      <div class="photo-lightbox" data-photo-lightbox hidden>
        <div class="photo-lightbox__dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(PHOTOS_PAGE.lightboxLabel)}">
          <button class="photo-lightbox__backdrop" type="button" data-photo-lightbox-close aria-label="${escapeHtml(PHOTOS_PAGE.closeLightboxLabel)}"></button>
          <figure class="photo-lightbox__figure">
            <img class="photo-lightbox__image" data-photo-lightbox-image alt="" />
            <figcaption class="photo-lightbox__nav" data-photo-lightbox-nav aria-label="${escapeHtml(PHOTOS_PAGE.lightboxNavigationLabel)}">
              <button class="photo-lightbox__nav-button" type="button" data-photo-lightbox-prev aria-label="${escapeHtml(PHOTOS_PAGE.previousPhotoLabel)}"><span aria-hidden="true">←</span></button>
              <span class="photo-lightbox__counter" data-photo-lightbox-counter aria-live="polite"></span>
              <button class="photo-lightbox__nav-button" type="button" data-photo-lightbox-next aria-label="${escapeHtml(PHOTOS_PAGE.nextPhotoLabel)}"><span aria-hidden="true">→</span></button>
            </figcaption>
          </figure>
          <button class="photo-lightbox__close" type="button" data-photo-lightbox-close aria-label="${escapeHtml(PHOTOS_PAGE.closeLightboxLabel)}">${escapeHtml(PHOTOS_PAGE.closeLabel)}</button>
        </div>
      </div>

      <footer class="site-footer">
        <div class="site-footer__content">
          <div class="site-footer__location" aria-label="Location and weather">
            <span>Lyon, France</span>
            <span data-footer-weather>Weather loading...</span>
          </div>

          <nav
            class="site-footer__group site-footer__group--contact"
            aria-label="Contact links"
          >
            <a
              class="site-footer__link"
              href="mailto:contact@pierrelouis.net"
              data-copy-email
              data-email="contact@pierrelouis.net"
              >Copy Email</a
            >
            <a class="site-footer__link" href="../links/">Links &amp; Socials</a>
          </nav>

          <nav
            class="site-footer__group site-footer__group--info"
            aria-label="Site information"
          >
            <a class="site-footer__link" href="../colophon/">Colophon</a>
            <a class="site-footer__link" href="../imprint/">Imprint</a>
            <span class="site-footer__copyright-slot">
              <span class="site-footer__copyright"
                >©<span data-footer-year>2026</span></span
              >
            </span>
          </nav>
        </div>

        <div class="watermark" aria-hidden="true">
          <span class="watermark__name watermark__name--first"></span>
          <span class="watermark__dash"></span>
          <span class="watermark__name watermark__name--last"></span>
        </div>
      </footer>
    </div>
  </body>
</html>
`;

  return applySharedComponents(
    page,
    { root: "../", active: "photos" },
    "generated photos/index.html",
  );
};

const renderData = (collections) => {
  return collections.map((collection) => ({
    id: collection.id,
    year: collection.year,
    startYear: collection.startYear,
    endYear: collection.endYear,
    dateLabel: collection.dateLabel,
    order: collection.order,
    place: collection.place,
    country: collection.country,
    description: collection.description,
    tags: collection.tags,
    photos: collection.photos.map((photo, index) => ({
      id: photo.id,
      index: index + 1,
      collectionId: collection.id,
      place: collection.place,
      country: collection.country,
      file: photo.file,
      sourceIndex: photo.sourceIndex + 1,
      favorite: photo.favorite,
      src: photo.src,
      fullSrc: photo.fullSrc,
      alt: photo.alt,
      themes: photo.themes,
      colors: photo.colors,
      vibe: photo.vibe,
    })),
  }));
};

export const buildPhotos = async () => {
  const collections = await loadCollections();

  await Promise.all([
    mkdir(ASSETS_DIR, { recursive: true }),
    mkdir(FULL_ASSETS_DIR, { recursive: true }),
  ]);
  await mkdir(PHOTOS_DIR, { recursive: true });
  const assets = await generateCollectionAssets(collections);
  await writeFile(path.join(PHOTOS_DIR, "index.html"), renderPage(collections));
  await writeFile(
    path.join(PHOTOS_DIR, "photos-data.json"),
    `${JSON.stringify(renderData(collections), null, 2)}\n`,
  );

  return {
    collections: collections.length,
    photos: getPhotoCount(collections),
    assets,
  };
};

if (isDirectRun()) {
  try {
    const result = await buildPhotos();
    console.log(
      `Built photos page: ${result.collections} collection(s), ${result.photos} photo(s), ` +
        `${result.assets.generated} generated asset(s), ` +
        `${result.assets.skipped} cached asset(s), ` +
        `${result.assets.removed} stale item(s) removed.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
