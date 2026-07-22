<div align="center">

# pierrelouis.net

Personal portfolio built with semantic HTML, modern CSS, vanilla JavaScript, and a small Node.js toolchain.

[Live site](https://pierrelouis.net) · [Projects](https://pierrelouis.net/projects/) · [Photos](https://pierrelouis.net/photos/)

</div>

![Desktop screenshot of the pierrelouis.net homepage](./assets/readme-homepage.png)

## Technical overview

The site is a static, multi-page application served directly from the repository root. It intentionally has no front-end framework, bundler, or runtime dependencies: each route is an HTML document with page-specific CSS and JavaScript layered on top of shared site styles and behavior.

| Layer | Implementation |
| --- | --- |
| Markup | Semantic, route-based HTML documents |
| Styling | Shared `base.css` plus page-level stylesheets |
| Client behavior | Vanilla JavaScript with progressive enhancement |
| Build tooling | Node.js ES modules using built-in APIs |
| Image processing | ImageMagick-generated WebP variants |
| Development server | Custom Node HTTP server with Server-Sent Events live reload |

## Build system

`npm run build` runs two build stages:

1. `scripts/build-photos.mjs` reads the collections in `content/photos/`, validates their metadata, generates optimized gallery assets, and writes the photo page and its searchable JSON data.
2. `scripts/shared-components.mjs` renders the canonical header and footer into every configured HTML page, adjusting paths and active navigation state per route.

The photo pipeline maintains two WebP variants for each source image:

- `assets/photos/` contains gallery thumbnails capped at 1040 px on their longest edge.
- `assets/photos-full/` contains higher-quality, source-sized images loaded by the lightbox.

A build cache at `assets/photos/.build-cache.json` tracks source signatures and processing options, so unchanged images are skipped. Stale generated files are pruned during subsequent builds.

## Local development

Requirements:

- A recent version of [Node.js](https://nodejs.org/)
- [ImageMagick](https://imagemagick.org/) available through the `magick` command when rebuilding image assets

No package installation is currently required because the project has no npm dependencies.

```bash
npm run dev
```

This performs an initial build, starts the site at `http://localhost:8000`, watches the repository, and reloads connected pages through Server-Sent Events. Set `PORT` to override the default port.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build, serve, watch, and live reload |
| `npm run build` | Regenerate photo outputs and synchronize shared components |
| `npm run preview` | Build and serve without file watching on port 4173 |

## Repository structure

```text
.
├── assets/                 # Fonts, static media, and generated photo variants
├── content/photos/         # Original photographs and collection.yml metadata
├── scripts/                # Build pipeline, component sync, and local server
├── projects/               # Project case studies
├── posts/                  # Writing
├── photos/                 # Generated gallery page, data, styles, and behavior
├── about/, now/, ...       # Other route directories
├── base.css                # Shared visual system and layout primitives
├── script.js               # Shared navigation and interaction behavior
├── footer.js               # Dynamic footer behavior
└── index.html              # Homepage
```

## Maintenance notes

- Edit shared navigation and footer markup in `scripts/shared-components.mjs`, then run the build; direct edits to generated copies will be overwritten.
- Add or update photography in `content/photos/`. The collection format is documented in [`content/photos/README.md`](./content/photos/README.md).
- Generated photo HTML, JSON, and WebP assets are committed alongside their sources so production hosting only needs to serve static files.
- Clean URLs work through directory-level `index.html` files; the project does not require server-side routing.

## License

The source code is available under the [MIT License](./LICENSE). Unless otherwise stated, the portfolio's writing, photography, and other personal content remain © Pierre-Louis Camaret.
