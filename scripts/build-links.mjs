import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getImageDimensions } from "./lib/image-dimensions.mjs";
import { parseYaml } from "./lib/yaml.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LINKS_PAGE_FILE = path.join(ROOT, "links", "index.html");
const PHOTOS_DATA_FILE = path.join(ROOT, "photos", "photos-data.json");
const FEATURED_PROJECTS_DIR = path.join(ROOT, "content", "projects", "featured");
const GENERATED_START = "            <!-- links-carousel:generated:start -->";
const GENERATED_END = "            <!-- links-carousel:generated:end -->";
const IMAGE_EXTENSIONS = new Set([".gif", ".jpeg", ".jpg", ".png", ".webp"]);
// The seed keeps the gallery mixed but stable. Ordering happens at build time,
// never in the browser, so the carousel does not jump between page loads.
const CAROUSEL_ORDER_SEED = "pierrelouis-links-carousel-v1";

const isDirectRun = () =>
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const parseFrontMatter = (source, projectKey) => {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/);

  if (!match) {
    throw new Error(`content/projects/${projectKey}/index.md has no front matter`);
  }

  return parseYaml(match[1]);
};

const getProjectOutputFile = (slug, sourceFile) => {
  const extension = path.posix.extname(sourceFile);
  return `featured/${slug}/${sourceFile.slice(0, -extension.length)}.webp`;
};

const getFeaturedProjectImages = async () => {
  const entries = await readdir(FEATURED_PROJECTS_DIR, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }

    const projectKey = `featured/${entry.name}`;
    const document = await readFile(
      path.join(FEATURED_PROJECTS_DIR, entry.name, "index.md"),
      "utf8",
    );
    const frontMatter = parseFrontMatter(document, projectKey);
    const listing = frontMatter.listing;
    const rawImages = Array.isArray(listing?.images)
      ? listing.images
      : listing?.image
        ? [{ ...listing, file: listing.image }]
        : [];
    const images = [];

    for (const rawImage of rawImages) {
      const selectedFile = rawImage.wide ? rawImage.mobileFile : rawImage.file;
      const extension = path.posix.extname(String(selectedFile ?? "")).toLowerCase();

      if (!selectedFile || !IMAGE_EXTENSIONS.has(extension)) {
        continue;
      }

      const outputFile = getProjectOutputFile(entry.name, selectedFile);
      const dimensions = await getImageDimensions(
        path.join(ROOT, "assets", "projects", ...outputFile.split("/")),
      );

      images.push({
        alt: rawImage.alt,
        ...dimensions,
        href: `../projects/${entry.name}/`,
        source: "project",
        src: `/assets/projects/${outputFile}`,
      });
    }

    projects.push({
      images,
      order: Number(frontMatter.order),
    });
  }

  return projects
    .sort((a, b) => a.order - b.order)
    .flatMap((project) => project.images);
};

const getFavoritePhotos = async () => {
  const collections = JSON.parse(await readFile(PHOTOS_DATA_FILE, "utf8"));
  const favorites = collections.flatMap((collection) =>
    collection.photos.filter((photo) => photo.favorite),
  );

  return Promise.all(
    favorites.map(async (photo) => {
      const assetPath = photo.src.replace(/^\.\.\//, "");
      const dimensions = await getImageDimensions(path.join(ROOT, assetPath));

      return {
        alt: photo.alt,
        ...dimensions,
        href: `../photos/?album=${encodeURIComponent(photo.collectionId)}`,
        source: "photo",
        src: photo.src,
      };
    }),
  );
};

const getStableOrderScore = (image) => {
  const value = `${CAROUSEL_ORDER_SEED}:${image.src}`;
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const orderCarouselImages = (images) =>
  [...images].sort((left, right) => {
    return (
      getStableOrderScore(left) - getStableOrderScore(right) ||
      left.src.localeCompare(right.src)
    );
  });

const deduplicateCarouselImages = (images) => [
  ...new Map(images.map((image) => [image.src, image])).values(),
];

const renderImage = (image, index) => {
  const priority = index === 0 ? '\n                  fetchpriority="high"' : '\n                  loading="lazy"';
  const dimensions =
    image.width && image.height
      ? `\n                  width="${image.width}"\n                  height="${image.height}"`
      : "";

  return `              <a
                class="links-gallery__item"
                href="${escapeHtml(image.href)}"
                data-carousel-source="${image.source}"
                aria-label="Open ${escapeHtml(image.alt)}"
              >
                <img
                  src="${escapeHtml(image.src)}"${dimensions}
                  alt=""${priority}
                  decoding="async"
                />
              </a>`;
};

const updateLinksPage = async (images) => {
  const source = await readFile(LINKS_PAGE_FILE, "utf8");
  const startIndex = source.indexOf(GENERATED_START);
  const endIndex = source.indexOf(GENERATED_END);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(
      "links/index.html is missing its links-carousel:generated build markers",
    );
  }

  const before = source.slice(0, startIndex + GENERATED_START.length);
  const after = source.slice(endIndex);
  const markup = images.map(renderImage).join("\n");
  const output = `${before}\n${markup}\n${after}`;

  if (output !== source) {
    await writeFile(LINKS_PAGE_FILE, output);
    return true;
  }

  return false;
};

export const buildLinks = async () => {
  const projectImages = await getFeaturedProjectImages();
  const photoImages = await getFavoritePhotos();
  const images = orderCarouselImages(
    deduplicateCarouselImages([
      ...projectImages,
      ...photoImages,
    ]),
  );
  const changed = await updateLinksPage(images);

  return {
    changed,
    photos: photoImages.length,
    projects: projectImages.length,
    total: images.length,
  };
};

if (isDirectRun()) {
  try {
    const result = await buildLinks();
    console.log(
      `Built Links carousel: ${result.projects} project, ` +
        `${result.photos} favorite photo image(s) (${result.total} total)` +
        `${result.changed ? "" : " (unchanged)"}.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
