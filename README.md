<div align="center">

# pierrelouis.net

Personal portfolio built with semantic HTML, modern CSS, vanilla JavaScript, and a small Node.js toolchain.

[Live site](https://pierrelouis.net) · [Projects](https://pierrelouis.net/projects/) · [Photos](https://pierrelouis.net/photos/)

</div>

![Desktop screenshot of the pierrelouis.net homepage](./assets/readme-homepage.png)

## Technical overview

The site is a mostly static, multi-page application served directly from the repository root. It has no client-side framework: each route is an HTML document with page-specific CSS and JavaScript layered on top of shared site styles and behavior. A small Node.js toolchain generates content at build time, and narrowly scoped PHP endpoints power live Last.fm and weather displays with shared server-side caching.

| Layer | Implementation |
| --- | --- |
| Markup | Semantic HTML; Eleventy compiles Obsidian Markdown posts |
| Styling | Shared `base.css` plus page-level stylesheets |
| Client behavior | Vanilla JavaScript with progressive enhancement |
| Server integration | Minimal PHP Last.fm and weather proxies with filesystem caching |
| Build tooling | Node.js ES modules, Eleventy, Markdown-it, KaTeX, and Highlight.js |
| Image processing | ImageMagick-generated WebP variants |
| Development server | Custom Node HTTP server with Server-Sent Events live reload |

## Build system

`npm run build` runs six build stages:

1. `scripts/build-lists.mjs` validates the dedicated HTML source for every Lists card and compiles each fragment into a project-style sheet.
2. `scripts/build-projects.mjs` owns the Projects page settings, validates project metadata and source images, generates resized WebP production assets, then regenerates the marked project-listing region.
3. `scripts/build-photos.mjs` owns the Photos page settings, reads and validates the collections in `content/photos/`, generates optimized gallery assets, and writes the photo page and its searchable JSON data.
4. The post pipeline imports the latest Obsidian articles into the repository mirror, then `scripts/build-posts.mjs` validates and compiles them with build-time math and code rendering, the post index, and local asset references.
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

This imports and builds the latest Obsidian posts and lists, starts the site at `http://localhost:8000`, watches the repository plus both Obsidian source folders, and reloads connected pages through Server-Sent Events. Set `PORT` to override the default port.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build, serve, watch, and live reload |
| `npm run build` | Regenerate source outputs and assemble the production site in `dist/` |
| `npm run build:lists` | Sync Obsidian `Portfolio/Lists` and compile the Lists page |
| `npm run build:posts` | Validate and compile the local post source mirror |
| `npm run qa:posts` | Build and browser-test every generated post at desktop and mobile sizes |
| `npm run preview` | Serve the existing `dist/` build on port 4173 |

## Runtime API endpoints

The build copies `api/` into `dist/`, but copying a PHP file does not execute it. In production, the contents of `dist/` are deployed to Hostinger's `public_html`; Hostinger executes requests for `/api/*.php` with PHP. The local Node server intercepts the same URLs because it cannot execute PHP itself.

The footer requests `/api/weather.php` only when it approaches the viewport. The production endpoint contacts Open-Meteo from Hostinger, so Open-Meteo sees the server's IP address rather than the visitor's. It validates and stores only the temperature and weather code in a private temporary JSON file. Responses are fresh for 15 minutes, may fall back to cached data for up to three hours during an upstream failure, and are written atomically so concurrent readers never see a partial file. A lock is intentionally omitted: for this site's traffic, an occasional duplicate refresh is cheaper and simpler than maintaining request-coalescing logic. Browsers may reuse a successful response for five minutes.

Weather presentation stays in `footer.js`: it maps Open-Meteo codes to labels, renders the Lyon time, refreshes visible pages every 30 minutes, and retries failures after five minutes. The local `scripts/weather-proxy.mjs` is deliberately only a thin, uncached adapter to the browser contract. It does not duplicate the production filesystem cache or stale-fallback policy.

The Last.fm endpoint has a stricter reason to exist: it keeps the API key out of the browser. Production reads the key, username, and cache path from `private/lastfm.php`, outside `public_html`, then returns only validated track data. Its 15-second server cache and six-hour stale fallback limit Last.fm traffic without exposing credentials. Local development uses `LASTFM_API_KEY` and optionally `LASTFM_USER` from the environment, `.env`, or `.env.local`.

Both production endpoints require PHP with the cURL extension. The weather endpoint also needs write access to PHP's temporary directory; the Last.fm cache path is configured in its private file.

## Repository structure

```text
.
├── api/                    # Production PHP endpoints
├── assets/                 # Fonts, static media, and generated production images
├── content/lists/          # Build mirror of Obsidian Portfolio/Lists
├── content/projects/       # Project metadata and original source images
├── content/photos/         # Original photographs and collection.yml metadata
├── content/posts/          # Mirrored Markdown, templates, migration data, and guide
├── scripts/                # Build pipeline, component sync, and local server
├── projects/               # Project case studies
├── posts/                  # Writing
├── photos/                 # Generated gallery page, data, styles, and behavior
├── lists/sheets/           # Sheet layouts, Markdown slots, custom HTML/CSS/JS
├── about/, now/, ...       # Other route directories
├── base.css                # Shared visual system and layout primitives
├── script.js               # Shared navigation and interaction behavior
├── footer.js               # Dynamic footer behavior
└── index.html              # Homepage
```

## Maintenance notes

- Edit shared navigation and footer markup in `scripts/shared-components.mjs`, then run the build; direct edits to generated copies will be overwritten.
- Add project sources under `content/projects/` and edit page-level Projects settings in `scripts/build-projects.mjs`. The complete workflow is documented in [`content/projects/README.md`](./content/projects/README.md).
- Add or update photography in `content/photos/`; edit page-level Photos settings in `scripts/build-photos.mjs`. The complete workflow is documented in [`content/photos/README.md`](./content/photos/README.md).
- Write posts in the Obsidian vault. `npm run dev` imports changes as they happen, and `npm run build` imports the latest posts before assembling `dist/`. The Markdown contract, components, migration rules, and full example are documented in [`content/posts/README.md`](./content/posts/README.md).
- Edit list content in Obsidian `Portfolio/Lists/` and sheet composition in
  `lists/sheets/`. Markdown slots and custom components are documented in
  [`lists/sheets/README.md`](./lists/sheets/README.md).
- Generated project, photo, and post HTML and assets are committed alongside their sources; production serves those files plus the small PHP API endpoints.
- Clean URLs work through directory-level `index.html` files; the project does not require server-side routing.
- The Now page's live Last.fm display uses a private-key PHP proxy on Hostinger and an equivalent local development proxy. Keep the production config at `private/lastfm.php`, outside `public_html`; never add a real API key to the repository or `dist/`.
- Footer weather uses a same-origin PHP proxy with a shared 15-minute filesystem cache and a thin, uncached local development adapter. Keep weather labels and presentation logic in `footer.js` rather than duplicating them in the proxies.

## License

The source code is available under the [MIT License](./LICENSE).

The MIT License does not cover the site’s visual design, personal writing,
articles, photography, project case-study content, personal media, or third-party
assets unless explicitly stated. Those materials remain subject to their
respective copyright and license terms.
