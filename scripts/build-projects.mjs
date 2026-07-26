import { spawn } from "node:child_process";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  rmdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getImageDimensions } from "./lib/image-dimensions.mjs";
import { parseYaml } from "./lib/yaml.mjs";
import {
  renderSiteFooter,
  renderSiteHeader,
} from "./shared-components.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = path.join(ROOT, "content", "projects");
const CONTENT_FILE = path.join(CONTENT_DIR, "projects.yml");
const ASSETS_DIR = path.join(ROOT, "assets", "projects");
const ASSET_CACHE_FILE = path.join(ASSETS_DIR, ".build-cache.json");
const PAGE_FILE = path.join(ROOT, "projects", "index.html");
const CASE_STUDIES_DIR = path.join(ROOT, "projects");
const CASE_STUDY_MARKER = "<!-- case-study:generated -->";
const GENERATED_START = "        <!-- projects:generated:start -->";
const GENERATED_END = "        <!-- projects:generated:end -->";
const IMAGE_EXTENSIONS = new Set([".gif", ".jpeg", ".jpg", ".png", ".webp"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ASSET_CACHE_VERSION = 1;
const STILL_WEBP_QUALITY = 84;
const ANIMATED_WEBP_QUALITY = 80;
// These are 2x approximations of the largest CSS boxes at the 760px and
// 1100px breakpoints. Cover images may retain extra pixels on one axis so
// browser cropping stays sharp without baking a crop into the source asset.
const REGULAR_RENDER_BOXES = [{ width: 1440, height: 1800 }];
const WIDE_RENDER_BOXES = [
  { width: 2048, height: 1300 },
  { width: 1440, height: 1800 },
];

const isDirectRun = () => {
  return (
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const requireText = (value, field) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`content/projects/projects.yml is missing "${field}"`);
  }

  return value.trim();
};

const normalizeSourcePath = (value, field) => {
  const relativePath = requireText(value, field).replaceAll("\\", "/");
  const extension = path.extname(relativePath).toLowerCase();

  if (
    path.posix.isAbsolute(relativePath) ||
    relativePath.split("/").includes("..")
  ) {
    throw new Error(`"${field}" must stay inside content/projects`);
  }

  if (!IMAGE_EXTENSIONS.has(extension)) {
    throw new Error(
      `"${field}" must use GIF, JPEG, PNG, or WebP (received "${relativePath}")`,
    );
  }

  return relativePath;
};

const loadImage = async (value, field) => {
  const file = normalizeSourcePath(value, field);
  const sourcePath = path.join(CONTENT_DIR, ...file.split("/"));

  try {
    const fileStat = await stat(sourcePath);

    if (!fileStat.isFile()) {
      throw new Error("not a file");
    }
  } catch (error) {
    if (error.code === "ENOENT" || error.message === "not a file") {
      throw new Error(`"${field}" does not exist: content/projects/${file}`);
    }

    throw error;
  }

  return {
    file,
    sourcePath,
    outputFile: `${file.slice(0, -path.extname(file).length)}.webp`,
  };
};

const normalizeFeaturedProject = async (project, index) => {
  const prefix = `featured[${index}]`;
  const slug = requireText(project?.slug, `${prefix}.slug`);

  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      `"${prefix}.slug" must contain lowercase words separated by hyphens`,
    );
  }

  if (!Array.isArray(project.images) || project.images.length === 0) {
    throw new Error(`"${prefix}.images" must contain at least one image`);
  }

  const images = [];

  for (let imageIndex = 0; imageIndex < project.images.length; imageIndex += 1) {
    const image = project.images[imageIndex];
    const imagePrefix = `${prefix}.images[${imageIndex}]`;

    images.push({
      ...(await loadImage(image?.file, `${imagePrefix}.file`)),
      alt: requireText(image?.alt, `${imagePrefix}.alt`),
      main: Boolean(image?.main),
      wide: Boolean(image?.wide),
      dark: Boolean(image?.dark),
      framed: Boolean(image?.framed),
      resizeMode: "cover",
      renderBoxes: image?.wide
        ? WIDE_RENDER_BOXES
        : REGULAR_RENDER_BOXES,
    });
  }

  const mainImages = images.filter((image) => image.main);

  if (mainImages.length !== 1) {
    throw new Error(
      `"${prefix}.images" must mark exactly one image with "main: true"`,
    );
  }

  return {
    slug,
    title: requireText(project.title, `${prefix}.title`),
    description: requireText(project.description, `${prefix}.description`),
    caseStudy: {
      year: requireText(project.caseStudy?.year, `${prefix}.caseStudy.year`),
      description: requireText(
        project.caseStudy?.description,
        `${prefix}.caseStudy.description`,
      ),
      note: requireText(project.caseStudy?.note, `${prefix}.caseStudy.note`),
    },
    images,
  };
};

const normalizePlaygroundProject = async (project, index) => {
  const prefix = `playground[${index}]`;

  return {
    title: requireText(project?.title, `${prefix}.title`),
    description: requireText(project?.description, `${prefix}.description`),
    alt: requireText(project?.alt, `${prefix}.alt`),
    ...(await loadImage(project?.image, `${prefix}.image`)),
    resizeMode: "contain",
    renderBoxes: REGULAR_RENDER_BOXES,
  };
};

const assertUnique = (items, field, label) => {
  const seen = new Set();

  for (const item of items) {
    const value = item[field].toLowerCase();

    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: "${item[field]}"`);
    }

    seen.add(value);
  }
};

const loadProjects = async () => {
  const data = parseYaml(await readFile(CONTENT_FILE, "utf8"));

  if (!Array.isArray(data.featured) || data.featured.length === 0) {
    throw new Error('"featured" must contain at least one project');
  }

  if (!Array.isArray(data.playground)) {
    throw new Error('"playground" must be an array');
  }

  if (!Array.isArray(data.page?.categories) || data.page.categories.length === 0) {
    throw new Error('"page.categories" must contain at least one category');
  }

  const featured = [];
  const playground = [];

  for (let index = 0; index < data.featured.length; index += 1) {
    featured.push(await normalizeFeaturedProject(data.featured[index], index));
  }

  for (let index = 0; index < data.playground.length; index += 1) {
    playground.push(await normalizePlaygroundProject(data.playground[index], index));
  }

  assertUnique(featured, "slug", "featured project slug");
  assertUnique([...featured, ...playground], "title", "project title");

  return {
    page: {
      categories: data.page.categories.map((category, index) =>
        requireText(category, `page.categories[${index}]`),
      ),
      intro: requireText(data.page.intro, "page.intro"),
      playgroundIntro: requireText(
        data.page.playgroundIntro,
        "page.playgroundIntro",
      ),
    },
    featured,
    playground,
  };
};

const runImageMagick = (args) =>
  new Promise((resolve, reject) => {
    const process = spawn("magick", args, { stdio: "inherit" });

    process.on("error", (error) => {
      if (error.code === "ENOENT") {
        reject(
          new Error(
            "ImageMagick is required to build project images. Install the `magick` command and try again.",
          ),
        );
        return;
      }

      reject(error);
    });
    process.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`ImageMagick failed with exit code ${code}`));
    });
  });

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

const getSourceSignature = async (sourcePath) => {
  const sourceStat = await stat(sourcePath);

  return {
    path: path.relative(ROOT, sourcePath).split(path.sep).join("/"),
    size: sourceStat.size,
    mtimeMs: sourceStat.mtimeMs,
  };
};

const getRequiredScale = (image, sourceDimensions) => {
  const scales = image.renderBoxes.map((box) => {
    const widthScale = box.width / sourceDimensions.width;
    const heightScale = box.height / sourceDimensions.height;

    return image.resizeMode === "cover"
      ? Math.max(widthScale, heightScale)
      : Math.min(widthScale, heightScale);
  });

  return Math.max(...scales);
};

const getResizeWidth = (job, sourceDimensions) => {
  const requiredScale = Math.max(
    ...job.references.map((image) =>
      getRequiredScale(image, sourceDimensions),
    ),
  );

  return Math.ceil(
    sourceDimensions.width * Math.min(requiredScale, 1),
  );
};

const getAssetOptions = (job, sourceDimensions) => {
  const animated = path.extname(job.sourcePath).toLowerCase() === ".gif";

  return {
    animated,
    quality: animated ? ANIMATED_WEBP_QUALITY : STILL_WEBP_QUALITY,
    resizeWidth: getResizeWidth(job, sourceDimensions),
  };
};

const cacheMatches = (entry, source, options) => {
  return (
    entry?.source?.path === source.path &&
    entry.source.size === source.size &&
    entry.source.mtimeMs === source.mtimeMs &&
    JSON.stringify(entry.options) === JSON.stringify(options)
  );
};

const outputIsCurrent = async (outputPath, entry, source, options) => {
  try {
    const outputStat = await stat(outputPath);
    return outputStat.size > 0 && cacheMatches(entry, source, options);
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
};

const generateProjectImage = async (job, outputPath, options) => {
  await mkdir(path.dirname(outputPath), { recursive: true });

  const sharedArgs = [
    "-resize",
    `${options.resizeWidth}x>`,
    "-strip",
    "-quality",
    String(options.quality),
    "-define",
    "webp:method=6",
    "-define",
    "webp:thread-level=1",
  ];

  if (options.animated) {
    await runImageMagick([
      job.sourcePath,
      "-coalesce",
      ...sharedArgs,
      "-loop",
      "0",
      "-layers",
      "Optimize",
      outputPath,
    ]);
    return;
  }

  await runImageMagick([
    job.sourcePath,
    "-auto-orient",
    ...sharedArgs,
    outputPath,
  ]);
};

const getImageReferences = (projects) => [
  ...projects.featured.flatMap((project) => project.images),
  ...projects.playground,
];

const collectAssetJobs = (projects) => {
  const jobs = new Map();

  for (const image of getImageReferences(projects)) {
    const existing = jobs.get(image.outputFile);

    if (existing && existing.sourcePath !== image.sourcePath) {
      throw new Error(
        `Project images "${existing.file}" and "${image.file}" both generate ` +
          `assets/projects/${image.outputFile}. Rename one of the source files.`,
      );
    }

    if (existing) {
      existing.references.push(image);
      continue;
    }

    jobs.set(image.outputFile, {
      file: image.file,
      sourcePath: image.sourcePath,
      outputFile: image.outputFile,
      references: [image],
    });
  }

  return jobs;
};

const removeStaleAssets = async (directory, expectedFiles) => {
  let removed = 0;
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entryPath === ASSET_CACHE_FILE) {
      continue;
    }

    if (entry.isDirectory()) {
      removed += await removeStaleAssets(entryPath, expectedFiles);

      try {
        await rmdir(entryPath);
      } catch (error) {
        if (error.code !== "ENOTEMPTY" && error.code !== "EEXIST") {
          throw error;
        }
      }

      continue;
    }

    const relativePath = path.relative(ASSETS_DIR, entryPath).split(path.sep).join("/");

    if (!expectedFiles.has(relativePath)) {
      await rm(entryPath);
      removed += 1;
    }
  }

  return removed;
};

const generateProjectAssets = async (projects) => {
  const jobs = collectAssetJobs(projects);
  const cache = await readAssetCache();
  const expectedFiles = new Set(jobs.keys());
  const stats = {
    generated: 0,
    skipped: 0,
    removed: 0,
  };

  await mkdir(ASSETS_DIR, { recursive: true });

  for (const [cacheKey, job] of jobs) {
    const outputPath = path.join(ASSETS_DIR, ...job.outputFile.split("/"));
    const source = await getSourceSignature(job.sourcePath);
    const sourceDimensions = await getImageDimensions(job.sourcePath);
    const options = getAssetOptions(job, sourceDimensions);

    if (await outputIsCurrent(outputPath, cache[cacheKey], source, options)) {
      stats.skipped += 1;
    } else {
      const temporaryOutput = path.join(
        path.dirname(outputPath),
        `.${path.basename(outputPath, ".webp")}.tmp-${process.pid}.webp`,
      );

      try {
        await generateProjectImage(job, temporaryOutput, options);
        await rename(temporaryOutput, outputPath);
      } finally {
        await rm(temporaryOutput, { force: true });
      }

      stats.generated += 1;
    }

    const dimensions = await getImageDimensions(outputPath);
    const src = `../assets/projects/${job.outputFile}`;

    for (const reference of job.references) {
      Object.assign(reference, dimensions, { src });
    }

    cache[cacheKey] = {
      source,
      options,
      output: `assets/projects/${job.outputFile}`,
    };
  }

  stats.removed = await removeStaleAssets(ASSETS_DIR, expectedFiles);

  for (const cacheKey of Object.keys(cache)) {
    if (!expectedFiles.has(cacheKey)) {
      delete cache[cacheKey];
    }
  }

  await writeAssetCache(cache);
  return stats;
};

const renderFeaturedImage = (image) => {
  const itemClasses = [
    "featured-project__item",
    image.wide && "featured-project__item--wide",
  ]
    .filter(Boolean)
    .join(" ");
  const mediaClasses = [
    "featured-project__media",
    image.dark && "featured-project__media--dark",
  ]
    .filter(Boolean)
    .join(" ");
  const imageClasses = [
    "featured-project__image",
    image.framed && "featured-project__image--framed",
  ]
    .filter(Boolean)
    .join(" ");

  return `                <figure class="${itemClasses}">
                  <span class="${mediaClasses}">
                    <img
                      class="${imageClasses}"
                      src="${escapeHtml(image.src)}"
                      width="${image.width}"
                      height="${image.height}"
                      alt="${escapeHtml(image.alt)}"
                    />
                  </span>
                </figure>`;
};

const renderFeaturedProject = (project) => {
  const footerId = `${project.slug}-carousel-footer`;
  const projectLabel = project.title.replace(/:\s.*$/, "");

  return `            <li class="featured-project" data-project-carousel>
              <div
                class="featured-project__track"
                role="region"
                aria-label="${escapeHtml(projectLabel)} project gallery"
                aria-describedby="${escapeHtml(footerId)}"
                data-project-carousel-track
                tabindex="-1"
              >
${project.images.map(renderFeaturedImage).join("\n\n")}
              </div>
              <footer
                class="featured-project__footer"
                id="${escapeHtml(footerId)}"
              >
                <div class="featured-project__identity">
                  <span class="featured-project__title">${escapeHtml(project.title)}</span>
                  <span class="featured-project__meta">${escapeHtml(project.description)}</span>
                </div>
                <div
                  class="featured-project__carousel-navigation"
                  aria-label="${escapeHtml(projectLabel)} gallery navigation"
                >
                  <button
                    class="featured-project__carousel-button"
                    type="button"
                    aria-label="Show previous ${escapeHtml(projectLabel)} image"
                    data-project-carousel-prev
                    disabled
                  >
                    ←
                  </button>
                  <span
                    class="featured-project__carousel-status"
                    aria-live="polite"
                    data-project-carousel-status
                    >1 / ${project.images.length}</span
                  >
                  <button
                    class="featured-project__carousel-button"
                    type="button"
                    aria-label="Show next ${escapeHtml(projectLabel)} image"
                    data-project-carousel-next
                  >
                    →
                  </button>
                </div>
                <a
                  class="internal-link featured-project__case-link"
                  href="./${escapeHtml(project.slug)}/"
                  ><span class="featured-project__case-label--full"
                    >See Case Study</span
                  ><span class="featured-project__case-label--short"
                    >See More</span
                  >
                  <span aria-hidden="true">→</span></a
                >
              </footer>
            </li>`;
};

const renderPlaygroundProject = (project) => {
  return `            <li class="playground-card media-card">
              <figure class="playground-card__figure">
                <span class="playground-card__media">
                  <img
                    class="playground-card__image media-card__image"
                    src="${escapeHtml(project.src)}"
                    width="${project.width}"
                    height="${project.height}"
                    alt="${escapeHtml(project.alt)}"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <figcaption
                  class="playground-card__caption media-card__caption"
                >
                  <span class="playground-card__title">${escapeHtml(project.title)}</span>
                  <span class="playground-card__description">${escapeHtml(project.description)}</span>
                </figcaption>
              </figure>
            </li>`;
};

const renderProjectsContent = ({ page, featured, playground }) => {
  const projectCount = featured.length + playground.length;

  return `        <h1 class="sr-only">Projects and experiments</h1>

        <section
          class="projects-intro page-intro"
          aria-label="Projects overview"
        >
          <div class="content-filter" aria-label="Work categories">
            <span class="content-filter__symbol" aria-hidden="true">✦</span>
            <div class="content-filter__content">
              <span class="projects-intro__label">All Work (${projectCount})</span>
              <span>${escapeHtml(page.categories.join(", "))}</span>
            </div>
          </div>

          <p class="intro-copy">
            ${escapeHtml(page.intro)}
          </p>
        </section>

        <section
          class="featured-projects"
          aria-labelledby="featured-projects-title"
        >
          <h2 class="sr-only" id="featured-projects-title">
            Featured projects
          </h2>

          <ol class="featured-projects__list">
${featured.map(renderFeaturedProject).join("\n\n")}
          </ol>
        </section>

        <section class="playground" aria-labelledby="playground-title">
          <header class="playground__header">
            <h2 class="playground__title" id="playground-title">Playground</h2>
            <p class="playground__description">
              ${escapeHtml(page.playgroundIntro)}
            </p>
          </header>

          <ul class="playground-grid">
${playground.map(renderPlaygroundProject).join("\n\n")}
          </ul>
        </section>`;
};

const getCaseStudyHero = (project) =>
  project.images.find((image) => image.wide) ?? project.images[0];

const groupSupportingImages = (project, hero) => {
  const supporting = project.images.filter((image) => image !== hero);
  const rows = [];

  for (let index = 0; index < supporting.length; index += 2) {
    rows.push(supporting.slice(index, index + 2));
  }

  return rows;
};

const renderCaseStudyMedia = (image, { priority = false } = {}) => {
  const mediaClasses = [
    "case-study-media",
    image.dark && "case-study-media--dark",
    image.framed && "case-study-media--framed",
  ]
    .filter(Boolean)
    .join(" ");
  const imageClasses = [
    "case-study-media__image",
    image.framed && "case-study-media__image--framed",
  ]
    .filter(Boolean)
    .join(" ");
  const loadingAttributes = priority
    ? '\n                fetchpriority="high"'
    : '\n                loading="lazy"\n                decoding="async"';

  return `            <figure class="${mediaClasses}">
              <img
                class="${imageClasses}"
                src="../../assets/projects/${escapeHtml(image.outputFile)}"
                width="${image.width}"
                height="${image.height}"
                alt="${escapeHtml(image.alt)}"${loadingAttributes}
              />
            </figure>`;
};

const renderRelatedProject = (project) => {
  const preview = project.images.find((image) => image.main);
  const contentWidth = Math.min(
    100,
    (preview.width / preview.height) * 125,
  ).toFixed(4);

  return `            <li class="case-study-related__item">
              <a
                class="case-study-related__link media-card"
                href="../${escapeHtml(project.slug)}/"
                aria-label="View ${escapeHtml(project.title)} case study"
              >
                <figure
                  class="case-study-related__figure"
                  style="--case-study-related-content-width: ${contentWidth}%"
                >
                  <span class="case-study-related__media">
                    <img
                      class="case-study-related__image media-card__image"
                      src="../../assets/projects/${escapeHtml(preview.outputFile)}"
                      width="${preview.width}"
                      height="${preview.height}"
                      alt="${escapeHtml(preview.alt)}"
                      loading="lazy"
                      decoding="async"
                    />
                  </span>
                  <figcaption
                    class="case-study-related__caption media-card__caption"
                  >
                    <span class="case-study-related__title">${escapeHtml(project.title)}</span>
                    <span class="case-study-related__description">${escapeHtml(project.description)}</span>
                  </figcaption>
                </figure>
              </a>
            </li>`;
};

const getRelatedProjects = (featured, currentSlug, limit = 2) => {
  const currentIndex = featured.findIndex(
    (project) => project.slug === currentSlug,
  );
  const relatedCount = Math.min(limit, Math.max(featured.length - 1, 0));

  return Array.from({ length: relatedCount }, (_, index) => {
    return featured[(currentIndex + index + 1) % featured.length];
  });
};

const renderCaseStudyPage = (project, featured) => {
  const hero = getCaseStudyHero(project);
  const supportingRows = groupSupportingImages(project, hero);
  const relatedProjects = getRelatedProjects(featured, project.slug);
  const pageUrl = `https://pierrelouis.net/projects/${project.slug}/`;
  const imageUrl =
    `https://pierrelouis.net/assets/projects/${hero.outputFile}`;
  const header = renderSiteHeader({
    root: "../../",
    active: "projects",
    back: {
      href: "../../projects/",
      label: "Back to projects",
      shortLabel: "Back",
    },
  });
  const footer = renderSiteFooter({
    root: "../../",
    active: "projects",
  });
  const supportingMarkup = supportingRows
    .map((row) => {
      const rowClasses = [
        "case-study-gallery__row",
        row.length === 1 && "case-study-gallery__row--full",
      ]
        .filter(Boolean)
        .join(" ");

      return `          <div class="${rowClasses}">
${row.map((image) => renderCaseStudyMedia(image)).join("\n")}
          </div>`;
    })
    .join("\n\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover"
    />
    <title>${escapeHtml(project.title)} - Pierre-Louis</title>
    <meta
      name="description"
      content="${escapeHtml(project.caseStudy.description)}"
    />
    <meta property="og:title" content="${escapeHtml(project.title)} - Pierre-Louis" />
    <meta
      property="og:description"
      content="${escapeHtml(project.caseStudy.description)}"
    />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
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
    <link rel="stylesheet" href="../../base.css" />
    <link rel="stylesheet" href="../case-study.css" />
    <script src="../../script.js" defer></script>
    <script src="../case-study.js" defer></script>
    <script src="../../footer.js" defer></script>
  </head>
  <body>
    ${CASE_STUDY_MARKER}
    <div class="site-shell case-study-page">
${header}

      <main>
        <h1 class="sr-only">${escapeHtml(project.title)} case study</h1>

        <section
          class="case-study-intro"
          aria-labelledby="case-study-title"
        >
          <header class="case-study-header">
            <div class="case-study-header__identity">
              <span class="case-study-header__year">${escapeHtml(project.caseStudy.year)}</span>
              <h2 class="case-study-header__title" id="case-study-title">
                ${escapeHtml(project.title)}
              </h2>
            </div>

            <div class="case-study-header__copy">
              <p class="case-study-header__description">
                ${escapeHtml(project.caseStudy.description)}
              </p>
              <p class="case-study-header__note">
                ${escapeHtml(project.caseStudy.note)}
              </p>
            </div>
          </header>
        </section>

        <section
          class="case-study-gallery"
          aria-label="${escapeHtml(project.title)} project gallery"
        >
          <div class="case-study-gallery__row case-study-gallery__row--full">
${renderCaseStudyMedia(hero, { priority: true })}
          </div>

${supportingMarkup}
        </section>

        <nav
          class="case-study-related"
          aria-label="More Projects"
        >
          <h2
            class="case-study-related__heading"
            id="case-study-related-title"
          >
            More Projects
          </h2>

          <ul class="case-study-related__list">
${relatedProjects.map(renderRelatedProject).join("\n\n")}
          </ul>

          <a
            class="internal-link case-study-related__all"
            href="../../projects/"
          >
            All projects <span aria-hidden="true">→</span>
          </a>
        </nav>
      </main>

${footer}
    </div>
  </body>
</html>
`;
};

const removeStaleCaseStudyPages = async (expectedSlugs) => {
  const entries = await readdir(CASE_STUDIES_DIR, { withFileTypes: true });
  let removed = 0;

  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      entry.name.startsWith(".") ||
      expectedSlugs.has(entry.name)
    ) {
      continue;
    }

    const directory = path.join(CASE_STUDIES_DIR, entry.name);
    const indexPath = path.join(directory, "index.html");

    try {
      const source = await readFile(indexPath, "utf8");

      if (!source.includes(CASE_STUDY_MARKER)) {
        continue;
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        continue;
      }

      throw error;
    }

    await rm(directory, { recursive: true });
    removed += 1;
  }

  return removed;
};

const updateCaseStudyPages = async (featured) => {
  const stats = {
    changed: 0,
    removed: 0,
    total: featured.length,
  };
  const expectedSlugs = new Set(featured.map((project) => project.slug));

  for (const project of featured) {
    const directory = path.join(CASE_STUDIES_DIR, project.slug);
    const pagePath = path.join(directory, "index.html");
    const output = renderCaseStudyPage(project, featured);
    let source = "";

    try {
      source = await readFile(pagePath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    if (source === output) {
      continue;
    }

    await mkdir(directory, { recursive: true });
    await writeFile(pagePath, output);
    stats.changed += 1;
  }

  stats.removed = await removeStaleCaseStudyPages(expectedSlugs);
  return stats;
};

const updatePage = async (projects) => {
  const source = await readFile(PAGE_FILE, "utf8");
  const startIndex = source.indexOf(GENERATED_START);
  const endIndex = source.indexOf(GENERATED_END);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(
      "projects/index.html is missing its projects:generated build markers",
    );
  }

  const before = source.slice(0, startIndex + GENERATED_START.length);
  const after = source.slice(endIndex);
  const output = `${before}\n${renderProjectsContent(projects)}\n${after}`;

  if (output !== source) {
    await writeFile(PAGE_FILE, output);
    return true;
  }

  return false;
};

export const buildProjects = async () => {
  const projects = await loadProjects();
  const assets = await generateProjectAssets(projects);
  const changed = await updatePage(projects);
  const caseStudies = await updateCaseStudyPages(projects.featured);

  return {
    assets,
    caseStudies,
    changed,
    featured: projects.featured.length,
    playground: projects.playground.length,
    total: projects.featured.length + projects.playground.length,
  };
};

if (isDirectRun()) {
  const result = await buildProjects();
  console.log(
    `Built projects page: ${result.featured} featured, ` +
      `${result.playground} playground (${result.total} total), ` +
      `${result.assets.generated} generated, ${result.assets.skipped} cached, ` +
      `${result.assets.removed} stale asset(s) removed, ` +
      `${result.caseStudies.total} case study page(s).`,
  );
}
