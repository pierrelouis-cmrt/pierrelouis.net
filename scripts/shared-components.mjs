import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MOBILE_MENU_FEATURED_PROJECT = {
  title: "CapECL",
  href: "projects/capecl/",
  image: "assets/mobile-menu/capecl.webp",
};

const PAGE_CONFIGS = [
  { file: "index.html", root: "./", active: "home" },
  { file: "page-template.html", root: "./", active: null },
  { file: "projects/index.html", root: "../", active: "projects" },
  { file: "about/index.html", root: "../", active: "about" },
  { file: "posts/index.html", root: "../", active: "posts" },
  { file: "photos/index.html", root: "../", active: "photos" },
  { file: "links/index.html", root: "../", active: "links" },
  { file: "now/index.html", root: "../", active: "now" },
  { file: "lists/index.html", root: "../", active: "lists" },
  { file: "someday/index.html", root: "../", active: "someday" },
  { file: "colophon/index.html", root: "../", active: "colophon" },
  { file: "imprint/index.html", root: "../", active: "imprint" },
];

const getCaseStudyConfigs = async () => {
  const projectsDirectory = path.join(ROOT, "projects");
  const entries = await readdir(projectsDirectory, { withFileTypes: true });
  const configs = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }

    const file = path.posix.join("projects", entry.name, "index.html");

    try {
      const index = await stat(path.join(ROOT, file));

      if (!index.isFile()) {
        continue;
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        continue;
      }

      throw error;
    }

    configs.push({
      file,
      root: "../../",
      active: null,
      back: {
        href: "../../projects/",
        label: "Back",
        shortLabel: "Back",
      },
    });
  }

  return configs.sort((first, second) =>
    first.file.localeCompare(second.file),
  );
};

const currentPage = (active, page) =>
  active === page ? ' aria-current="page"' : "";

const renderHeaderBrand = ({ root, back }, className) => {
  const isMobileBrand = className === "mobile-menu__brand";

  if (isMobileBrand) {
    const classNames = back
      ? `${className} ${className}--back`
      : className;
    const href = back?.href ?? root;
    const ariaLabel = back?.label ?? "Pierre-Louis home";
    const content = back
      ? `<span class="${className}__back-full">${back.label}</span>
                <span class="${className}__back-short" aria-hidden="true">${back.shortLabel}</span>`
      : `<span class="brand-mark__text">P—L</span>
                <span class="brand-mark__copyright" aria-hidden="true">©</span>`;

    return `<a
                class="${classNames}"
                href="${href}"
                aria-label="${ariaLabel}"
              >
                ${content}
              </a>`;
  }

  if (back) {
    return `<a class="${className} ${className}--back" href="${back.href}" aria-label="${back.label}">
          <span class="${className}__back-full">${back.label}</span>
          <span class="${className}__back-short" aria-hidden="true">${back.shortLabel}</span>
        </a>`;
  }

  return `<a class="${className}" href="${root}" aria-label="Pierre-Louis home">
          <span class="brand-mark__text">P—L</span>
          <span class="brand-mark__copyright" aria-hidden="true">©</span>
        </a>`;
};

export const renderSiteHeader = (config) => {
  const { root, active } = config;
  const featuredProject = MOBILE_MENU_FEATURED_PROJECT;

  return `      <header class="site-header" aria-label="Primary navigation">
        ${renderHeaderBrand(config, "brand-mark")}

        <nav class="primary-nav" aria-label="Main pages">
          <a class="primary-nav__link" href="${root}projects/"${currentPage(active, "projects")}>Projects</a>
          <a class="primary-nav__link" href="${root}posts/"${currentPage(active, "posts")}>Posts</a>
          <a class="primary-nav__link" href="${root}photos/"${currentPage(active, "photos")}>Photos</a>
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
            <a class="more-menu__link" href="${root}about/"${currentPage(active, "about")}>About</a>
            <a class="more-menu__link" href="${root}now/"${currentPage(active, "now")}>Now</a>
            <a class="more-menu__link" href="${root}someday/"${currentPage(active, "someday")}>Someday</a>
            <a class="more-menu__link" href="${root}lists/"${currentPage(active, "lists")}>Lists</a>
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
              ${renderHeaderBrand(config, "mobile-menu__brand")}
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
                  <a class="mobile-menu__link" href="${root}projects/"${currentPage(active, "projects")}>Projects</a>
                  <a class="mobile-menu__link" href="${root}posts/"${currentPage(active, "posts")}>Posts</a>
                  <a class="mobile-menu__link" href="${root}photos/"${currentPage(active, "photos")}>Photos</a>
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
                  href="${root}${featuredProject.href}"
                >
                  <span class="mobile-menu__latest-title"
                    >${featuredProject.title}</span
                  >
                  <span class="mobile-menu__latest-media" aria-hidden="true">
                    <img
                      class="mobile-menu__latest-image"
                      data-deferred-src="${root}${featuredProject.image}"
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <noscript>
                      <img
                        class="mobile-menu__latest-image"
                        src="${root}${featuredProject.image}"
                        alt=""
                      />
                    </noscript>
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
                  <a class="mobile-menu__link" href="${root}about/"${currentPage(active, "about")}>Who I am</a>
                  <a class="mobile-menu__link" href="${root}now/"${currentPage(active, "now")}>What I'm doing</a>
                  <a class="mobile-menu__link" href="${root}someday/"${currentPage(active, "someday")}>Where I'm going</a>
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
                  <a class="mobile-menu__link" href="${root}lists/"${currentPage(active, "lists")}>Catalogs</a>
                  <a class="mobile-menu__link" href="${root}links/"${currentPage(active, "links")}>Links &amp; Socials</a>
                </nav>
              </section>
            </div>

            <img
              class="mobile-menu__watermark"
              data-deferred-src="${root}assets/image_mobile_watermark.png"
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
            />
            <noscript>
              <img
                class="mobile-menu__watermark"
                src="${root}assets/image_mobile_watermark.png"
                alt=""
                aria-hidden="true"
              />
            </noscript>
          </div>
        </div>
      </header>`;
};

export const renderSiteFooter = ({ root, active }) => `      <footer class="site-footer">
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
            <a class="site-footer__link" href="${root}links/"${currentPage(active, "links")}>Links &amp; Socials</a>
          </nav>

          <nav
            class="site-footer__group site-footer__group--info"
            aria-label="Site information"
          >
            <a class="site-footer__link" href="${root}colophon/"${currentPage(active, "colophon")}>Colophon</a>
            <a class="site-footer__link" href="${root}imprint/"${currentPage(active, "imprint")}>Imprint</a>
            <span class="site-footer__copyright-slot">
              <span class="site-footer__copyright"
                >©<span data-footer-year>${new Date().getFullYear()}</span></span
              >
            </span>
          </nav>
        </div>

        <div class="watermark" aria-hidden="true">
          <span class="watermark__name watermark__name--first"></span>
          <span class="watermark__dash"></span>
          <span class="watermark__name watermark__name--last"></span>
        </div>
      </footer>`;

const replaceComponent = (html, pattern, component, file) => {
  if (!pattern.test(html)) {
    throw new Error(`Shared component not found in ${file}`);
  }

  return html.replace(pattern, component);
};

export const applySharedComponents = (source, config, file = "HTML source") => {
  let output = replaceComponent(
    source,
    /      <header class="site-header"[\s\S]*?      <\/header>/,
    renderSiteHeader(config),
    file,
  );
  output = replaceComponent(
    output,
    /      <footer class="site-footer">[\s\S]*?      <\/footer>/,
    renderSiteFooter(config),
    file,
  );

  return output;
};

export const syncSharedComponents = async () => {
  const changed = [];
  const configs = [...PAGE_CONFIGS, ...(await getCaseStudyConfigs())];

  for (const config of configs) {
    const filePath = path.join(ROOT, config.file);
    const source = await readFile(filePath, "utf8");
    const output = applySharedComponents(source, config, config.file);

    if (output !== source) {
      await writeFile(filePath, output);
      changed.push(config.file);
    }
  }

  return changed;
};

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const changed = await syncSharedComponents();
  console.log(`Synced shared components: ${changed.length} file(s) updated.`);
}
