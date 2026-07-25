import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getImageDimensions } from "./lib/image-dimensions.mjs";
import { parseYaml } from "./lib/yaml.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_FILE = path.join(ROOT, "content", "projects", "projects.yml");
const ASSETS_DIR = path.join(ROOT, "assets", "projects");
const PAGE_FILE = path.join(ROOT, "projects", "index.html");
const GENERATED_START = "        <!-- projects:generated:start -->";
const GENERATED_END = "        <!-- projects:generated:end -->";
const IMAGE_EXTENSIONS = new Set([".gif", ".jpeg", ".jpg", ".png", ".webp"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

const normalizeAssetPath = (value, field) => {
  const relativePath = requireText(value, field).replaceAll("\\", "/");
  const extension = path.extname(relativePath).toLowerCase();

  if (
    path.posix.isAbsolute(relativePath) ||
    relativePath.split("/").includes("..")
  ) {
    throw new Error(`"${field}" must stay inside assets/projects`);
  }

  if (!IMAGE_EXTENSIONS.has(extension)) {
    throw new Error(
      `"${field}" must use GIF, JPEG, PNG, or WebP (received "${relativePath}")`,
    );
  }

  return relativePath;
};

const loadImage = async (value, field) => {
  const file = normalizeAssetPath(value, field);
  const filePath = path.join(ASSETS_DIR, ...file.split("/"));

  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      throw new Error("not a file");
    }
  } catch (error) {
    if (error.code === "ENOENT" || error.message === "not a file") {
      throw new Error(`"${field}" does not exist: assets/projects/${file}`);
    }

    throw error;
  }

  return {
    file,
    src: `../assets/projects/${file}`,
    ...(await getImageDimensions(filePath)),
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
      wide: Boolean(image?.wide),
      dark: Boolean(image?.dark),
      framed: Boolean(image?.framed),
    });
  }

  return {
    slug,
    title: requireText(project.title, `${prefix}.title`),
    description: requireText(project.description, `${prefix}.description`),
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
  const changed = await updatePage(projects);

  return {
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
      `${result.playground} playground (${result.total} total).`,
  );
}
