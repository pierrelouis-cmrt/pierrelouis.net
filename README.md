<div align="center">

# pierrelouis.net

Personal portfolio built with semantic HTML, modern CSS, vanilla JavaScript, and a small Node.js toolchain.

[Live site](https://pierrelouis.net) · [Projects](https://pierrelouis.net/projects/) · [Photos](https://pierrelouis.net/photos/)

</div>

![Desktop screenshot of the pierrelouis.net homepage](./assets/readme-homepage.png)

## Technical overview

The site is a static, multi-page application served directly from the repository root. It has no client-side framework or production runtime: each route is an HTML document with page-specific CSS and JavaScript layered on top of shared site styles and behavior. A small Node.js toolchain generates content at build time.

| Layer | Implementation |
| --- | --- |
| Markup | Semantic HTML; Eleventy compiles Obsidian Markdown posts |
| Styling | Shared `base.css` plus page-level stylesheets |
| Client behavior | Vanilla JavaScript with progressive enhancement |
| Build tooling | Node.js ES modules, Eleventy, Markdown-it, KaTeX, and Highlight.js |
| Image processing | ImageMagick-generated WebP variants |
| Development server | Custom Node HTTP server with Server-Sent Events live reload |

## Build system

`npm run build` runs six build stages:

1. `scripts/build-lists.mjs` validates the dedicated HTML source for every Lists card and compiles each fragment into a project-style sheet.
2. `scripts/build-projects.mjs` reads `content/projects/projects.yml`, validates project metadata and source images, generates resized WebP production assets, then regenerates the marked project-listing region.
3. `scripts/build-photos.mjs` reads the collections in `content/photos/`, validates their metadata, generates optimized gallery assets, and writes the photo page and its searchable JSON data.
4. `scripts/build-posts.mjs` validates and compiles the mirrored Obsidian articles, build-time math and code rendering, post index, and local asset references.
5. `scripts/shared-components.mjs` renders the canonical header and footer into every configured HTML page, adjusting paths and active navigation state per route.
6. The deployable site is assembled in the Git-ignored `dist/` directory.

The projects pipeline keeps original images in `content/projects/` and writes
production-only WebP files to `assets/projects/`. Regular images are capped at
approximately twice their largest responsive render size. The resize calculation
accounts for whether CSS contains or crops each image, preserves aspect ratios,
and never upscales smaller sources. Animated GIF sources become animated WebP
files.

The photo pipeline maintains two WebP variants for each source image:

- `assets/photos/` contains gallery thumbnails capped at 1040 px on their longest edge.
- `assets/photos-full/` contains higher-quality, source-sized images loaded by the lightbox.

Local build caches under `assets/projects/` and `assets/photos/` track source
signatures and processing options, so unchanged images are skipped. The cache
files are ignored by Git; stale generated images are pruned during subsequent
builds.

## Local development

Requirements:

- A recent version of [Node.js](https://nodejs.org/)
- [ImageMagick](https://imagemagick.org/) available through the `magick` command when rebuilding image assets

Install the pinned build dependencies once, then start development:

```bash
npm install
npm run dev
```

This performs an initial build, starts the site at `http://localhost:8000`, watches the repository, and reloads connected pages through Server-Sent Events. Set `PORT` to override the default port.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build, serve, watch, and live reload |
| `npm run build` | Regenerate source outputs and assemble the production site in `dist/` |
| `npm run build:lists` | Compile `lists/sheets/*.html` into the Lists page |
| `npm run build:posts` | Validate and compile the local post source mirror |
| `npm run sync:posts` | Safely mirror the Obsidian articles, build them, and run changed-page browser QA |
| `npm run qa:posts` | Build and browser-test every generated post at desktop and mobile sizes |
| `npm run preview` | Serve the existing `dist/` build on port 4173 |

## Repository structure

```text
.
├── assets/                 # Fonts, static media, and generated production images
├── content/projects/       # Project metadata and original source images
├── content/photos/         # Original photographs and collection.yml metadata
├── content/posts/          # Mirrored Markdown, templates, migration data, and guide
├── scripts/                # Build pipeline, component sync, and local server
├── projects/               # Project case studies
├── posts/                  # Writing
├── photos/                 # Generated gallery page, data, styles, and behavior
├── lists/sheets/           # Hand-authored HTML, CSS, and JS for list sheets
├── about/, now/, ...       # Other route directories
├── base.css                # Shared visual system and layout primitives
├── script.js               # Shared navigation and interaction behavior
├── footer.js               # Dynamic footer behavior
└── index.html              # Homepage
```

## Maintenance notes

- Edit shared navigation and footer markup in `scripts/shared-components.mjs`, then run the build; direct edits to generated copies will be overwritten.
- Add project sources under `content/projects/` and update `content/projects/projects.yml`. The complete workflow is documented in [`content/projects/README.md`](./content/projects/README.md).
- Add or update photography in `content/photos/`. The collection format is documented in [`content/photos/README.md`](./content/photos/README.md).
- Write posts in the Obsidian vault, then run `npm run sync:posts`. The Markdown contract, components, migration rules, and full example are documented in [`content/posts/README.md`](./content/posts/README.md).
- Edit list-sheet content in `lists/sheets/`. Each card has one HTML fragment and the complete format is documented in [`lists/sheets/README.md`](./lists/sheets/README.md).
- Generated project, photo, and post HTML and assets are committed alongside their sources so production hosting only needs to serve static files.
- Clean URLs work through directory-level `index.html` files; the project does not require server-side routing.

## License

The source code is available under the [MIT License](./LICENSE). Unless otherwise stated, the portfolio's writing, photography, and other personal content remain © Pierre-Louis Camaret.
