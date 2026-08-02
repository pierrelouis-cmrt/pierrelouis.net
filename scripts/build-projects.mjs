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
import { marked, Renderer } from "marked";
import { getImageDimensions } from "./lib/image-dimensions.mjs";
import { parseYaml } from "./lib/yaml.mjs";
import { renderSiteFooter, renderSiteHeader } from "./shared-components.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = path.join(ROOT, "content", "projects");
const ASSETS_DIR = path.join(ROOT, "assets", "projects");
const ASSET_CACHE_FILE = path.join(ASSETS_DIR, ".build-cache.json");
const PAGE_FILE = path.join(ROOT, "projects", "index.html");
const CASE_STUDIES_DIR = path.join(ROOT, "projects");
const CASE_STUDY_MARKER = "<!-- case-study:generated -->";
const GENERATED_START = "        <!-- projects:generated:start -->";
const GENERATED_END = "        <!-- projects:generated:end -->";
const IMAGE_EXTENSIONS = new Set([".gif", ".jpeg", ".jpg", ".png", ".webp"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROJECT_COLLECTIONS = ["featured", "playground"];
const PUBLIC_PROJECT_ASSET_ROOT = "/assets/projects/";
const ASSET_CACHE_VERSION = 1;
const STILL_WEBP_QUALITY = 84;
const ANIMATED_WEBP_QUALITY = 80;
const PROJECTS_PAGE = {
  browserTitle: "Projects - Pierre-Louis",
  title: "Projects — Pierre-Louis",
  description: "Selected projects and experiments by Pierre-Louis.",
  // Hidden H1 used for the page's accessible document outline.
  heading: "Projects and experiments",
  allWorkLabel: "All Work",
  intro:
    "Featured projects & experiments, curated from 3 years of work. I mostly do web design but I also like to play around with graphic design work.",
  randomProjectLabel: "See a random experiment",
  // Hidden H2 that labels the Featured projects section.
  featuredHeading: "Featured projects",
  playgroundHeading: "Playground",
  playgroundIntro:
    "Everything below is made from small projects and experiments: the fun stuff.",
};
// These are 2x approximations of the largest CSS boxes at the 760px and
// 1100px breakpoints. Cover images may retain extra pixels on one axis so
// browser cropping stays sharp without baking a crop into the source asset.
const REGULAR_RENDER_BOXES = [{ width: 1440, height: 1800 }];
const WIDE_RENDER_BOXES = [
  { width: 2048, height: 1300 },
  { width: 1440, height: 1800 },
];
const BODY_RENDER_BOXES = [{ width: 2048, height: 2048 }];

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

const REMOTE_REFERENCE = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;
const PROJECT_MARKDOWN_RENDERER = new Renderer();
const renderDefaultMarkdownLink = PROJECT_MARKDOWN_RENDERER.link;

PROJECT_MARKDOWN_RENDERER.link = function renderProjectMarkdownLink(token) {
  const html = renderDefaultMarkdownLink.call(this, token);

  if (!html.startsWith("<a ")) {
    return html;
  }

  const external = REMOTE_REFERENCE.test(token.href);
  const attributes = external
    ? 'class="external-link" target="_blank" rel="noopener noreferrer"'
    : 'class="internal-link"';

  return html.replace("<a ", `<a ${attributes} `);
};

const tagKey = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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

const projectError = (projectKey, message) =>
  new Error(`content/projects/${projectKey}/index.md: ${message}`);

const requireProjectText = (value, projectKey, field) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw projectError(projectKey, `missing "${field}"`);
  }

  return value.trim();
};

const requireProjectTags = (value, projectKey) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw projectError(projectKey, '"tags" must be a non-empty list');
  }

  const tags = value.map((tag, index) =>
    requireProjectText(tag, projectKey, `tags[${index}]`),
  );
  const seen = new Set();

  for (const tag of tags) {
    const key = tagKey(tag);

    if (!key) {
      throw projectError(projectKey, `tag "${tag}" cannot be used as a filter`);
    }

    if (seen.has(key)) {
      throw projectError(projectKey, `duplicate tag "${tag}"`);
    }

    seen.add(key);
  }

  return tags;
};

const normalizeInteractiveDemo = async ({
  collection,
  frontMatter,
  projectKey,
}) => {
  const interactive = frontMatter.interactive;

  if (interactive === undefined) {
    return null;
  }

  if (collection !== "playground") {
    throw projectError(
      projectKey,
      '"interactive" is only available in Playground projects',
    );
  }

  if (!interactive || typeof interactive !== "object") {
    throw projectError(projectKey, '"interactive" must be an object');
  }

  const src = requireProjectText(
    interactive.src,
    projectKey,
    "interactive.src",
  );

  if (
    !src.startsWith("/") ||
    src.startsWith("//") ||
    !/^[/?#A-Za-z0-9._~!$&'()*+,;=:@%-]+$/.test(src)
  ) {
    throw projectError(
      projectKey,
      '"interactive.src" must be a same-site absolute path beginning with "/"',
    );
  }

  const pathname = new URL(src, "https://pierrelouis.net").pathname;
  const sourcePath = path.resolve(ROOT, `.${pathname}`);

  if (!sourcePath.startsWith(`${ROOT}${path.sep}`)) {
    throw projectError(
      projectKey,
      '"interactive.src" must stay inside the site root',
    );
  }

  try {
    const sourceStat = await stat(sourcePath);

    if (!sourceStat.isFile()) {
      throw new Error("not a file");
    }
  } catch (error) {
    if (error.code === "ENOENT" || error.message === "not a file") {
      throw projectError(
        projectKey,
        `"interactive.src" does not exist: ${pathname}`,
      );
    }

    throw error;
  }

  return {
    src,
    title: requireProjectText(
      interactive.title,
      projectKey,
      "interactive.title",
    ),
  };
};

const parseProjectDocument = (source, projectKey) => {
  const normalized = source.replaceAll("\r\n", "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);

  if (!match) {
    throw projectError(
      projectKey,
      'must start with YAML front matter between two "---" lines',
    );
  }

  let frontMatter;

  try {
    frontMatter = parseYaml(match[1]);
  } catch (error) {
    throw projectError(projectKey, `invalid front matter: ${error.message}`);
  }

  return {
    frontMatter,
    markdown: match[2].trim(),
  };
};

const normalizeProjectSourcePath = (
  value,
  projectKey,
  field,
  requiredDirectory,
) => {
  const relativePath = requireProjectText(value, projectKey, field).replaceAll(
    "\\",
    "/",
  );
  const extension = path.posix.extname(relativePath).toLowerCase();

  if (
    path.posix.isAbsolute(relativePath) ||
    relativePath.split("/").includes("..")
  ) {
    throw projectError(
      projectKey,
      `"${field}" must stay inside its project folder`,
    );
  }

  if (!IMAGE_EXTENSIONS.has(extension)) {
    throw projectError(
      projectKey,
      `"${field}" must use GIF, JPEG, PNG, or WebP (received "${relativePath}")`,
    );
  }

  if (relativePath.split("/")[0] !== requiredDirectory) {
    throw projectError(
      projectKey,
      `"${field}" must point inside "${requiredDirectory}/"`,
    );
  }

  return relativePath;
};

const loadProjectImage = async ({
  allowedDirectory,
  alt,
  field,
  file: rawFile,
  projectDirectory,
  projectKey,
  resizeMode,
  renderBoxes,
  ...options
}) => {
  const file = normalizeProjectSourcePath(
    rawFile,
    projectKey,
    `${field}.file`,
    allowedDirectory,
  );
  const sourcePath = path.join(projectDirectory, ...file.split("/"));

  try {
    const fileStat = await stat(sourcePath);

    if (!fileStat.isFile()) {
      throw new Error("not a file");
    }
  } catch (error) {
    if (error.code === "ENOENT" || error.message === "not a file") {
      throw projectError(projectKey, `"${field}.file" does not exist: ${file}`);
    }

    throw error;
  }

  return {
    alt: requireProjectText(alt, projectKey, `${field}.alt`),
    file,
    outputFile: `${projectKey}/${file.slice(0, -path.posix.extname(file).length)}.webp`,
    projectDirectory,
    resizeMode,
    renderBoxes,
    sourcePath,
    ...options,
  };
};

const standaloneMarkdownImage = (token) => {
  if (token.type !== "paragraph" || !Array.isArray(token.tokens)) {
    return null;
  }

  const [image, modifier, ...rest] = token.tokens;

  if (image?.type !== "image" || rest.length > 0) {
    return null;
  }

  if (!modifier) {
    return { image, layout: "normal" };
  }

  if (modifier.type === "text") {
    const modifierName = modifier.text.trim().match(/^\{([a-z-]+)\}$/)?.[1];

    if (
      modifierName === "wide" ||
      modifierName === "contained" ||
      modifierName === "carousel"
    ) {
      return { image, layout: modifierName };
    }

    if (modifierName) {
      return {
        error:
          `unknown image modifier "{${modifierName}}"; use {wide}, ` +
          "{contained}, {carousel}, or no modifier",
        image,
      };
    }
  }

  return null;
};

const standaloneMarkdownImages = (token) => {
  if (token.type !== "paragraph") {
    return null;
  }

  const images = [];

  for (const line of token.raw.split("\n")) {
    const lineTokens = marked.lexer(line.trim(), { gfm: true });

    if (lineTokens.length !== 1) {
      return null;
    }

    const image = standaloneMarkdownImage(lineTokens[0]);

    if (!image) {
      return null;
    }

    images.push(image);
  }

  return images.length > 0 ? images : null;
};

const tokenContainsImage = (token) => {
  if (token?.type === "image") {
    return true;
  }

  return Object.values(token ?? {}).some((value) => {
    if (Array.isArray(value)) {
      return value.some((item) => tokenContainsImage(item));
    }

    return value && typeof value === "object"
      ? tokenContainsImage(value)
      : false;
  });
};

const loadMarkdownContent = async ({
  collection,
  markdown,
  projectDirectory,
  projectKey,
}) => {
  const tokens = marked.lexer(markdown, {
    gfm: true,
    headerIds: false,
    mangle: false,
  });
  const blocks = [];
  const images = [];

  for (const token of tokens) {
    if (token.type === "space") {
      continue;
    }

    const standaloneImages = standaloneMarkdownImages(token);

    if (standaloneImages) {
      for (const standalone of standaloneImages) {
        if (standalone.error) {
          throw projectError(projectKey, standalone.error);
        }

        if (standalone.layout === "carousel" && collection !== "playground") {
          throw projectError(
            projectKey,
            '"{carousel}" is only available in Playground projects',
          );
        }

        const image = await loadProjectImage({
          allowedDirectory: "media",
          alt: standalone.image.text,
          field: `Markdown image "${standalone.image.href}"`,
          file: standalone.image.href,
          projectDirectory,
          projectKey,
          resizeMode:
            standalone.layout === "contained" ||
            standalone.layout === "carousel"
              ? "contain"
              : "cover",
          renderBoxes:
            standalone.layout === "wide"
              ? WIDE_RENDER_BOXES
              : standalone.layout === "contained" ||
                  standalone.layout === "carousel"
                ? BODY_RENDER_BOXES
                : REGULAR_RENDER_BOXES,
          contained: standalone.layout === "contained",
          wide: standalone.layout === "wide",
        });

        images.push(image);
        blocks.push({
          image,
          layout: standalone.layout,
          type: "image",
        });
      }

      continue;
    }

    if (tokenContainsImage(token)) {
      throw projectError(
        projectKey,
        "Markdown images must be alone on their line; optional modifiers are {wide}, {contained}, and {carousel}",
      );
    }

    const html = marked.parser([token], {
      gfm: true,
      headerIds: false,
      mangle: false,
      renderer: PROJECT_MARKDOWN_RENDERER,
    });
    const previousBlock = blocks.at(-1);

    if (previousBlock?.type === "text" && token.type !== "heading") {
      previousBlock.html += html;
    } else {
      blocks.push({
        html,
        titled: token.type === "heading",
        type: "text",
      });
    }
  }

  for (let index = 0; index < blocks.length; index += 1) {
    if (blocks[index].type !== "image" || blocks[index].layout !== "carousel") {
      continue;
    }

    const carouselBlocks = [];

    while (
      index < blocks.length &&
      blocks[index].type === "image" &&
      blocks[index].layout === "carousel"
    ) {
      carouselBlocks.push(blocks[index]);
      index += 1;
    }

    if (carouselBlocks.length < 2) {
      throw projectError(
        projectKey,
        "a carousel needs at least two consecutive {carousel} images",
      );
    }

    blocks.splice(index - carouselBlocks.length, carouselBlocks.length, {
      images: carouselBlocks.map((block) => block.image),
      type: "carousel",
    });
    index = index - carouselBlocks.length;
  }

  for (let index = 0; index < blocks.length; index += 1) {
    if (blocks[index].type !== "image" || blocks[index].layout !== "normal") {
      continue;
    }

    const run = [];

    while (
      index < blocks.length &&
      blocks[index].type === "image" &&
      blocks[index].layout === "normal"
    ) {
      run.push(blocks[index]);
      index += 1;
    }

    if (run.length % 2 === 1) {
      run.at(-1).isolated = true;
    }

    index -= 1;
  }

  return { blocks, images };
};

const listProjectMedia = async (directory, prefix = "") => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listProjectMedia(absolutePath, relativePath)));
      continue;
    }

    if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(relativePath);
    }
  }

  return files;
};

const normalizeListingImages = async ({
  collection,
  frontMatter,
  projectDirectory,
  projectKey,
}) => {
  const listing = frontMatter.listing;

  if (!listing || typeof listing !== "object") {
    throw projectError(projectKey, 'missing "listing"');
  }

  let rawImages;

  if (Array.isArray(listing.images)) {
    rawImages = listing.images;
  } else if (listing.image) {
    rawImages = [
      {
        alt: listing.alt,
        dark: listing.dark,
        file: listing.image,
        framed: listing.framed,
        main: listing.main,
        wide: listing.wide,
      },
    ];
  } else {
    throw projectError(projectKey, '"listing" needs "image" or "images"');
  }

  if (rawImages.length === 0) {
    throw projectError(projectKey, '"listing.images" needs at least one image');
  }

  const images = [];

  for (let index = 0; index < rawImages.length; index += 1) {
    const rawImage = rawImages[index];
    const wide = Boolean(rawImage?.wide);

    images.push(
      await loadProjectImage({
        allowedDirectory: "listing",
        alt: rawImage?.alt,
        dark: Boolean(rawImage?.dark),
        field: `listing.images[${index}]`,
        file: rawImage?.file,
        framed: Boolean(rawImage?.framed),
        main: Boolean(rawImage?.main),
        projectDirectory,
        projectKey,
        resizeMode: collection === "featured" ? "cover" : "contain",
        renderBoxes: wide ? WIDE_RENDER_BOXES : REGULAR_RENDER_BOXES,
        wide,
      }),
    );
  }

  const explicitMainImages = images.filter((image) => image.main);

  if (explicitMainImages.length > 1) {
    throw projectError(
      projectKey,
      '"listing.images" can mark at most one image with "main: true"',
    );
  }

  (explicitMainImages[0] ?? images[0]).main = true;
  return images;
};

const loadProject = async (entry, collection) => {
  const slug = entry.name;
  const projectKey = `${collection}/${slug}`;

  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      `content/projects/${projectKey}: folder names must contain lowercase words separated by hyphens`,
    );
  }

  const projectDirectory = path.join(CONTENT_DIR, collection, slug);
  const documentPath = path.join(projectDirectory, "index.md");
  const { frontMatter, markdown } = parseProjectDocument(
    await readFile(documentPath, "utf8"),
    projectKey,
  );

  if (frontMatter.collection !== undefined) {
    throw projectError(
      projectKey,
      'remove "collection"; the parent folder already defines it',
    );
  }

  if (!Number.isFinite(frontMatter.order)) {
    throw projectError(projectKey, '"order" must be a number');
  }

  const images = await normalizeListingImages({
    collection,
    frontMatter,
    projectDirectory,
    projectKey,
  });
  const content = await loadMarkdownContent({
    collection,
    markdown,
    projectDirectory,
    projectKey,
  });
  const interactive = await normalizeInteractiveDemo({
    collection,
    frontMatter,
    projectKey,
  });
  const referencedMedia = new Set(
    [...images, ...content.images].map((image) => image.file),
  );
  const unusedMedia = (await listProjectMedia(projectDirectory)).filter(
    (file) => !referencedMedia.has(file),
  );

  const tags = requireProjectTags(frontMatter.tags, projectKey);

  return {
    collection,
    contentBlocks: content.blocks,
    contentImages: content.images,
    description: requireProjectText(
      frontMatter.description,
      projectKey,
      "description",
    ),
    images,
    interactive,
    note:
      typeof frontMatter.note === "string" && frontMatter.note.trim()
        ? frontMatter.note.trim()
        : null,
    order: frontMatter.order,
    projectKey,
    slug,
    summary:
      typeof frontMatter.summary === "string" && frontMatter.summary.trim()
        ? frontMatter.summary.trim()
        : requireProjectText(
            frontMatter.description,
            projectKey,
            "description",
          ),
    title: requireProjectText(frontMatter.title, projectKey, "title"),
    tags,
    tagKeys: tags.map(tagKey),
    primaryTag: tags[0],
    unusedMedia,
    year:
      typeof frontMatter.year === "string" && frontMatter.year.trim()
        ? frontMatter.year.trim()
        : Number.isFinite(frontMatter.year)
          ? String(frontMatter.year)
          : null,
  };
};

const assertUniqueOrder = (projects, collection) => {
  const orders = new Map();

  for (const project of projects) {
    if (orders.has(project.order)) {
      throw new Error(
        `Projects "${orders.get(project.order)}" and "${project.slug}" both use ` +
          `order ${project.order} in collection "${collection}"`,
      );
    }

    orders.set(project.order, project.slug);
  }
};

const loadProjects = async () => {
  const projects = [];

  for (const collection of PROJECT_COLLECTIONS) {
    const collectionDirectory = path.join(CONTENT_DIR, collection);
    let entries;

    try {
      entries = await readdir(collectionDirectory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(
          `content/projects: missing "${collection}/" collection folder`,
        );
      }

      throw error;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) {
        continue;
      }

      try {
        const indexStat = await stat(
          path.join(collectionDirectory, entry.name, "index.md"),
        );

        if (indexStat.isFile()) {
          projects.push(await loadProject(entry, collection));
        }
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
    }
  }

  if (projects.length === 0) {
    throw new Error(
      "content/projects: add at least one featured/<slug>/index.md project",
    );
  }

  assertUnique(projects, "slug", "project slug");
  assertUnique(projects, "title", "project title");

  const byOrder = (a, b) => a.order - b.order || a.slug.localeCompare(b.slug);
  const featured = projects
    .filter((project) => project.collection === "featured")
    .sort(byOrder);
  const playground = projects
    .filter((project) => project.collection === "playground")
    .sort(byOrder);

  if (featured.length === 0) {
    throw new Error(
      'content/projects: at least one project needs collection "featured"',
    );
  }

  assertUniqueOrder(featured, "featured");
  assertUniqueOrder(playground, "playground");

  const filterLabels = new Map();

  for (const project of [...featured, ...playground]) {
    for (const tag of project.tags) {
      const key = tagKey(tag);

      if (!filterLabels.has(key)) {
        filterLabels.set(key, tag);
      }
    }
  }

  const filters = [...filterLabels]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  playground.forEach((project, index) => {
    if (!project.year) {
      throw projectError(project.projectKey, 'missing "year"');
    }

    project.sequence = String(index + 1).padStart(2, "0");
  });

  const warnings = projects.flatMap((project) =>
    project.unusedMedia.map(
      (file) =>
        `Unused project media: content/projects/${project.projectKey}/${file}`,
    ),
  );

  return {
    featured,
    filters,
    playground,
    warnings,
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
    ...job.references.map((image) => getRequiredScale(image, sourceDimensions)),
  );

  return Math.ceil(sourceDimensions.width * Math.min(requiredScale, 1));
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
  ...[...projects.featured, ...projects.playground].flatMap((project) => [
    ...project.images,
    ...project.contentImages,
  ]),
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

    const relativePath = path
      .relative(ASSETS_DIR, entryPath)
      .split(path.sep)
      .join("/");

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
    for (const reference of job.references) {
      Object.assign(reference, dimensions);
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

const renderFeaturedImage = (image, { priority = false } = {}) => {
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
  const imageSource = priority
    ? `src="${escapeHtml(PUBLIC_PROJECT_ASSET_ROOT + image.outputFile)}"`
    : `data-deferred-src="${escapeHtml(PUBLIC_PROJECT_ASSET_ROOT + image.outputFile)}"`;
  const loading = priority ? ' fetchpriority="high"' : ' loading="lazy"';
  const noScriptFallback = priority
    ? ""
    : `
                    <noscript>
                      <img
                        class="${imageClasses}"
                        src="${escapeHtml(PUBLIC_PROJECT_ASSET_ROOT + image.outputFile)}"
                        width="${image.width}"
                        height="${image.height}"
                        alt=""
                      />
                    </noscript>`;

  return `                <figure class="${itemClasses}">
                  <span class="${mediaClasses}">
                    <img
                      class="${imageClasses}"
                      ${imageSource}
                      width="${image.width}"
                      height="${image.height}"
                      alt="${escapeHtml(image.alt)}"${loading}
                      decoding="async"
                    />${noScriptFallback}
                  </span>
                </figure>`;
};

const renderFeaturedProject = (project, projectIndex) => {
  const footerId = `${project.slug}-carousel-footer`;
  const projectLabel = project.title.replace(/:\s.*$/, "");

  return `            <li
              class="featured-project"
              data-project-carousel
              data-project-tags="${escapeHtml(project.tagKeys.join(" "))}"
            >
              <div
                class="featured-project__track"
                role="region"
                aria-label="${escapeHtml(projectLabel)} project gallery"
                aria-describedby="${escapeHtml(footerId)}"
                data-project-carousel-track
                tabindex="-1"
              >
${project.images
  .map((image, imageIndex) =>
    renderFeaturedImage(image, {
      priority: projectIndex === 0 && imageIndex === 0,
    }),
  )
  .join("\n\n")}
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
                    <span aria-hidden="true">←</span>
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
                    <span aria-hidden="true">→</span>
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
  const preview =
    project.images.find((image) => image.main) ?? project.images[0];

  return `            <li
              class="playground-card media-card"
              data-project-tags="${escapeHtml(project.tagKeys.join(" "))}"
            >
              <button
                class="playground-card__button"
                type="button"
                aria-haspopup="dialog"
                aria-controls="playground-sheet-${escapeHtml(project.slug)}"
                aria-label="${escapeHtml(project.title)}: ${escapeHtml(project.description)}"
                data-playground-sheet-open="${escapeHtml(project.slug)}"
              >
                <span class="playground-card__media">
                  <img
                    class="playground-card__image media-card__image"
                    src="${escapeHtml(PUBLIC_PROJECT_ASSET_ROOT + preview.outputFile)}"
                    width="${preview.width}"
                    height="${preview.height}"
                    alt="${escapeHtml(preview.alt)}"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span
                  class="playground-card__caption media-card__caption"
                >
                  <span class="playground-card__title">${escapeHtml(project.title)}</span>
                  <span class="playground-card__description">${escapeHtml(project.description)}</span>
                </span>
              </button>
            </li>`;
};

const renderProjectContent = (project, { priorityFirstImage = false } = {}) => {
  let imageIndex = 0;

  return project.contentBlocks
    .map((block) => {
      if (block.type === "text") {
        const textClasses = [
          "project-content__text",
          block.titled && "project-content__text--titled",
        ]
          .filter(Boolean)
          .join(" ");

        return `                <div class="${textClasses}">
${block.html.trim()}
                </div>`;
      }

      if (block.type === "carousel") {
        return `                <section
                  class="project-carousel"
                  aria-label="${escapeHtml(project.title)} image gallery"
                  data-project-gallery
                >
                  <div
                    class="project-carousel__viewport"
                    role="region"
                    aria-label="${escapeHtml(project.title)} image gallery"
                    tabindex="0"
                    data-project-gallery-viewport
                  >
                    <ol class="project-carousel__track">
${block.images
  .map((image) => {
    return `                      <li class="project-carousel__item">
                        <figure class="project-carousel__slide">
                          <span
                            class="project-carousel__image-wrap"
                            style="--project-carousel-ratio: ${image.width} / ${image.height}"
                          >
                            <img
                              class="project-carousel__image"
                              src="${escapeHtml(PUBLIC_PROJECT_ASSET_ROOT + image.outputFile)}"
                              width="${image.width}"
                              height="${image.height}"
                              loading="lazy"
                              decoding="async"
                              alt="${escapeHtml(image.alt)}"
                            />
                          </span>
                        </figure>
                      </li>`;
  })
  .join("\n")}
                    </ol>
                  </div>
                </section>`;
      }

      const priority = priorityFirstImage && imageIndex === 0;
      imageIndex += 1;
      const classes = [
        "project-content__media",
        block.image.wide && "project-content__media--wide",
        block.image.contained && "project-content__media--contained",
        block.isolated && "project-content__media--isolated",
      ]
        .filter(Boolean)
        .join(" ");
      const loading = priority
        ? ' fetchpriority="high"'
        : ' loading="lazy" decoding="async"';

      return `                <figure class="${classes}">
                  <img
                    class="project-content__image"
                    src="${escapeHtml(PUBLIC_PROJECT_ASSET_ROOT + block.image.outputFile)}"
                    width="${block.image.width}"
                    height="${block.image.height}"
                    alt="${escapeHtml(block.image.alt)}"${loading}
                  />
                </figure>`;
    })
    .join("\n\n");
};

const renderProjectInteractive = (project) => {
  if (!project.interactive) {
    return "";
  }

  const { src, title } = project.interactive;

  return `

                <figure
                  class="project-interactive"
                >
                  <iframe
                    class="project-interactive__frame"
                    src="${escapeHtml(src)}"
                    title="${escapeHtml(title)}"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    sandbox="allow-scripts allow-same-origin allow-downloads"
                    allow="fullscreen"
                    scrolling="no"
                  ></iframe>
                </figure>`;
};

const renderPlaygroundSheet = (project) => {
  const titleId = `playground-sheet-title-${project.slug}`;
  const descriptionId = `playground-sheet-description-${project.slug}`;

  return `        <dialog
          class="playground-sheet"
          id="playground-sheet-${escapeHtml(project.slug)}"
          aria-labelledby="${escapeHtml(titleId)}"
          aria-describedby="${escapeHtml(descriptionId)}"
          tabindex="-1"
          data-playground-sheet="${escapeHtml(project.slug)}"
        >
          <div class="playground-sheet__surface">
            <button
              class="playground-sheet__handle"
              type="button"
              aria-label="Close ${escapeHtml(project.title)}"
              data-playground-sheet-handle
            >
              <span class="playground-sheet__handle-bar"></span>
            </button>

            <button
              class="playground-sheet__close"
              type="button"
              aria-label="Close ${escapeHtml(project.title)}"
              data-playground-sheet-close
            >
              <span aria-hidden="true"></span>
            </button>

            <div class="playground-sheet__content">
              <header class="playground-sheet__intro">
                <h2 class="playground-sheet__title" id="${escapeHtml(titleId)}">${escapeHtml(project.title)}</h2>
                <p class="playground-sheet__description" id="${escapeHtml(descriptionId)}">${escapeHtml(project.description)}</p>
                <div class="playground-sheet__meta" aria-label="Project details">
                  <span class="playground-sheet__category">${escapeHtml(project.primaryTag)}</span>
                  <time datetime="${escapeHtml(project.year)}">${escapeHtml(project.year)}</time>
                </div>
              </header>

              <div
                class="project-content playground-sheet__body"
                aria-label="${escapeHtml(project.title)} project content"
              >
${renderProjectContent(project, {})}${renderProjectInteractive(project)}
              </div>
            </div>
          </div>
        </dialog>`;
};

const renderProjectsContent = ({ featured, filters, playground }) => {
  const projects = [...featured, ...playground];
  const projectCount = featured.length + playground.length;
  const filterCounts = new Map(
    filters.map(({ key }) => [
      key,
      projects.filter((project) => project.tagKeys.includes(key)).length,
    ]),
  );
  const tagFilters = filters
    .map(({ key, label }) => {
      return `                <button
                  class="content-filter__button"
                  type="button"
                  data-project-filter="${escapeHtml(key)}"
                  aria-pressed="false"
                >
                  <span>${escapeHtml(label)}</span>
                  <span class="content-filter__count" data-filter-count hidden>${filterCounts.get(key) || 0}</span>
                </button>`;
    })
    .join("\n");
  const randomAction =
    playground.length > 0
      ? `              <button
                class="content-filter__button projects-intro__random"
                type="button"
                data-playground-sheet-random
              >
                ${escapeHtml(PROJECTS_PAGE.randomProjectLabel)}
              </button>`
      : "";
  const playgroundContent =
    playground.length > 0
      ? `        <section
          class="playground"
          aria-labelledby="playground-title"
          data-project-section
        >
          <header class="playground__header">
            <h2 class="playground__title" id="playground-title">${escapeHtml(PROJECTS_PAGE.playgroundHeading)}</h2>
            <p class="playground__description">
              ${escapeHtml(PROJECTS_PAGE.playgroundIntro)}
            </p>
          </header>

          <ul class="playground-grid">
${playground.map(renderPlaygroundProject).join("\n\n")}
          </ul>
        </section>

${playground.map(renderPlaygroundSheet).join("\n\n")}`
      : "";

  return `        <h1 class="sr-only">${escapeHtml(PROJECTS_PAGE.heading)}</h1>

        <section
          class="projects-intro page-intro"
          aria-label="Projects overview"
        >
          <div
            class="content-filter"
            aria-label="Project filters"
            data-project-filters
          >
            <span
              class="content-filter__symbol content-filter__symbol--projects"
              aria-hidden="true"
            ></span>
            <div class="content-filter__content">
              <div class="content-filter__options" aria-label="Project types">
                <button
                  class="content-filter__button is-active"
                  type="button"
                  data-project-filter="all"
                  aria-pressed="true"
                >
                  <span>${escapeHtml(PROJECTS_PAGE.allWorkLabel)}</span>
                  <span class="content-filter__count" data-filter-count>${projectCount}</span>
                </button>
${tagFilters}
              </div>
${randomAction}
            </div>
          </div>

          <p class="intro-copy">
            ${escapeHtml(PROJECTS_PAGE.intro)}
          </p>
        </section>

        <section
          class="featured-projects"
          aria-labelledby="featured-projects-title"
          data-project-section
        >
          <h2 class="sr-only" id="featured-projects-title">
            ${escapeHtml(PROJECTS_PAGE.featuredHeading)}
          </h2>

          <ol class="featured-projects__list">
${featured.map(renderFeaturedProject).join("\n\n")}
          </ol>
        </section>

${playgroundContent}`;
};

const renderRelatedProject = (project) => {
  const preview = project.images.find((image) => image.main);

  return `            <li class="case-study-related__item">
              <a
                class="case-study-related__link media-card"
                href="../${escapeHtml(project.slug)}/"
                aria-label="View ${escapeHtml(project.title)} project"
              >
                <figure class="case-study-related__figure">
                  <span class="case-study-related__media">
                    <img
                      class="case-study-related__image media-card__image"
                      src="${escapeHtml(PUBLIC_PROJECT_ASSET_ROOT + preview.outputFile)}"
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

const renderCaseStudyPage = (project, peers) => {
  const preview =
    project.images.find((image) => image.main) ?? project.images[0];
  const relatedProjects = getRelatedProjects(peers, project.slug);
  const pageUrl = `https://pierrelouis.net/projects/${project.slug}/`;
  const imageUrl = `https://pierrelouis.net/assets/projects/${preview.outputFile}`;
  const header = renderSiteHeader({
    root: "../../",
    active: null,
    back: {
      href: "../../projects/",
      label: "Back",
      shortLabel: "Back",
    },
  });
  const footer = renderSiteFooter({
    root: "../../",
    active: "projects",
  });
  const note = project.note
    ? `              <p class="case-study-header__note">
                ${escapeHtml(project.note)}
              </p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover"
    />
    <title>${escapeHtml(project.title)}</title>
    <meta
      name="description"
      content="${escapeHtml(project.summary)}"
    />
    <meta property="og:title" content="${escapeHtml(project.title)} - Pierre-Louis" />
    <meta
      property="og:description"
      content="${escapeHtml(project.summary)}"
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
        <h1 class="sr-only">${escapeHtml(project.title)} project</h1>

        <section
          class="case-study-intro"
          aria-labelledby="case-study-title"
        >
          <header class="case-study-header">
            <div class="case-study-header__identity">
              <span class="case-study-header__year">${escapeHtml(project.year ?? project.primaryTag)}</span>
              <h2 class="case-study-header__title" id="case-study-title">
                ${escapeHtml(project.title)}
              </h2>
            </div>

            <div class="case-study-header__copy">
              <p class="case-study-header__description">
                ${escapeHtml(project.summary)}
              </p>
${note}
            </div>
          </header>
        </section>

        <section
          class="project-content case-study-content"
          aria-label="${escapeHtml(project.title)} project content"
        >
${renderProjectContent(project, {
  priorityFirstImage: true,
})}
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

const updateProjectPages = async (projects) => {
  const stats = {
    changed: 0,
    removed: 0,
    total: projects.length,
  };
  const expectedSlugs = new Set(projects.map((project) => project.slug));

  for (const project of projects) {
    const directory = path.join(CASE_STUDIES_DIR, project.slug);
    const pagePath = path.join(directory, "index.html");
    const peers = projects.filter(
      (candidate) => candidate.collection === project.collection,
    );
    const output = renderCaseStudyPage(project, peers);
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

const updatePageMetadata = (source) => {
  const browserTitle = escapeHtml(PROJECTS_PAGE.browserTitle);
  const title = escapeHtml(PROJECTS_PAGE.title);
  const description = escapeHtml(PROJECTS_PAGE.description);

  return source
    .replace(/<title>[^<]*<\/title>/, `<title>${browserTitle}</title>`)
    .replace(
      /(<meta\s+name="description"\s+content=")[^"]*("\s*\/>)/,
      `$1${description}$2`,
    )
    .replace(
      /(<meta\s+property="og:title"\s+content=")[^"]*("\s*\/>)/,
      `$1${title}$2`,
    )
    .replace(
      /(<meta\s+property="og:description"\s+content=")[^"]*("\s*\/>)/,
      `$1${description}$2`,
    );
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
  const preview =
    projects.featured[0].images.find((image) => image.main) ??
    projects.featured[0].images[0];
  const ogImageTag = `<meta
      property="og:image"
      content="https://pierrelouis.net/assets/projects/${escapeHtml(preview.outputFile)}"
    />`;
  const output = updatePageMetadata(
    `${before}\n${renderProjectsContent(projects)}\n${after}`.replace(
      /<meta\s+property="og:image"\s+content="[^"]+"\s*\/>/,
      ogImageTag,
    ),
  );

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
  const projectPages = await updateProjectPages(projects.featured);

  for (const warning of projects.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  return {
    assets,
    caseStudies: projectPages,
    changed,
    featured: projects.featured.length,
    playground: projects.playground.length,
    total: projects.featured.length + projects.playground.length,
    warnings: projects.warnings,
  };
};

if (isDirectRun()) {
  const result = await buildProjects();
  console.log(
    `Built projects page: ${result.featured} featured, ` +
      `${result.playground} playground (${result.total} total), ` +
      `${result.assets.generated} generated, ${result.assets.skipped} cached, ` +
      `${result.assets.removed} stale asset(s) removed, ` +
      `${result.caseStudies.total} project page(s).`,
  );
}
