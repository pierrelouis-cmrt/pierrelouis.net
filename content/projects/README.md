# Projects content guide

Projects are authored as Markdown with YAML front matter. The folder containing
a project decides where it appears:

- `featured/<slug>/` creates a row on `/projects/` and a standalone case study
  at `/projects/<slug>/`.
- `playground/<slug>/` creates a card that opens a sheet on `/projects/`; its
  shareable URL is `/projects/?sheet=<slug>`.

## Structure

```text
content/projects/
├── projects.yml                 # Projects-page copy and category filters
├── featured/
│   └── my-case-study/
│       ├── index.md
│       ├── listing/             # Images used outside the project body
│       │   ├── 01.webp
│       │   └── 02.webp
│       └── media/               # Images embedded in index.md
│           └── hero.webp
└── playground/
    └── my-experiment/
        ├── index.md
        ├── listing/cover.webp
        └── media/presentation.webp
```

Use lowercase, hyphen-separated folder names such as `my-case-study`. Slugs and
titles must be unique across both collections.

`listing/` and `media/` are deliberately separate. Listing images power cards,
featured rows, related-project cards, and social previews. Body images must come
from `media/`. Copy an image into both folders if it serves both purposes.

## Page settings

`projects.yml` controls shared page content:

```yaml
page:
  categories: [Web Design, Branding, Graphic Design]
  intro: Featured projects and experiments from recent years.
  playgroundIntro: Small projects, studies and experiments.
```

All three fields are required. A project's `category` must match one of the
listed categories; spelling, case, accents, and punctuation are normalized for
matching and filters. Category order here is also filter order on the page.

## Project template

Create `<collection>/<slug>/index.md`:

```md
---
title: My Project
order: 10
description: Web Design, Art Direction
category: Web Design
year: "2026"
summary: A concise introduction used by the case study and page metadata.
note: An optional supporting sentence shown below the case-study introduction.
listing:
  images:
    - file: listing/01.webp
      alt: Homepage of the My Project website.
      main: true
    - file: listing/02.webp
      alt: Mobile detail from the My Project website.
      wide: true
---

![Project overview](media/hero.webp){wide}

Write the story in its final display order.

![First detail](media/detail-01.webp)
![Second detail](media/detail-02.webp)

## Approach

Explain the work with normal Markdown.
```

### Front matter

| Field | Required | Effect |
| --- | --- | --- |
| `title` | Yes | Display title; must be unique. |
| `order` | Yes | Numeric position within its collection; lower comes first and duplicates are rejected. Spaced values such as `10`, `20`, `30` make insertion easy. |
| `description` | Yes | Short label shown on the Projects listing/card. |
| `category` | Yes | Category filter; must exist in `projects.yml`. |
| `year` | Playground | Shown in the Playground sheet. Featured projects may omit it, in which case their case-study label falls back to `category`. |
| `summary` | No | Case-study introduction and description metadata; falls back to `description`. |
| `note` | No | Second case-study introduction paragraph; has no visible effect in Playground. |
| `interactive` | Playground | Optional same-site iframe demo appended after the Markdown body. |
| `listing` | Yes | One or more images from this project's `listing/` folder. |

Do not add `collection`: the `featured/` or `playground/` parent already defines
it. Quote years to keep them clearly textual. The local YAML parser supports
nested objects, lists, inline lists, strings, numbers, and booleans.

## Listing images

Featured projects normally use a list:

```yaml
listing:
  images:
    - file: listing/01.webp
      alt: Clear description of the first image.
      main: true
    - file: listing/02.gif
      alt: Animated website presentation.
      wide: true
      dark: true
      framed: true
```

Playground projects normally use the shorter single-image form:

```yaml
listing:
  image: listing/cover.png
  alt: Identity artwork for My Experiment.
```

| Option | Default | Effect |
| --- | --- | --- |
| `file` / `image` | — | Required path inside `listing/`; GIF, JPEG, PNG, and WebP are accepted. |
| `alt` | — | Required accessible description. Describe the image, not its filename. |
| `main` | First image | Selects the social, related-project, or Playground-card preview. At most one may be `true`. |
| `wide` | `false` | Makes a featured-listing image span both columns. |
| `dark` | `false` | Gives a featured-listing image the dark media treatment. |
| `framed` | `false` | Adds the inset framed treatment to a featured-listing image. |

`wide`, `dark`, and `framed` are presentation controls for featured listings.
A Playground card displays only its selected `main` image even if the long
`images` form is used.

## Body Markdown

Write blocks in their final visual order. Standard GitHub-flavored Markdown is
accepted for paragraphs, emphasis, links, lists, quotes, and code:

```md
## Responsibilities

The interface is **quiet by design** and follows the
[brand system](https://example.com).

- Art direction
- Interaction design

> One short project principle.
```

Plain text occupies columns two and three on desktop. A heading starts a titled
text block: the heading uses column one while the content following it starts on
the same row. Both stack in reading order on mobile. An image ends the current
text block; another heading starts a new one.

Markdown links automatically use the shared styles from `base.css`: relative,
root-relative, and hash links receive `internal-link`; protocol and `//` links
receive `external-link`.

### Image layouts

Every Markdown image must:

1. be alone on its line;
2. use non-empty alt text;
3. point to a file inside that project's `media/` folder.

| Syntax | Layout |
| --- | --- |
| `![Detail](media/detail.webp)` | Normal 4:5 crop. Consecutive normal images pair into two columns; the last image in an odd run is centered at one-column width. |
| `![Overview](media/overview.webp){wide}` | Full-width 16:9 crop. |
| `![Artwork](media/artwork.webp){contained}` | Full-width gray presentation area with the complete image centered and uncropped. |
| `![Slide](media/slide.webp){carousel}` | Uncropped slide in an edge-running Playground carousel. |

A carousel is Playground-only and needs at least two consecutive images, all
marked `{carousel}`:

```md
![First experiment](media/01.webp){carousel}
![Second experiment](media/02.webp){carousel}
![Third experiment](media/03.webp){carousel}
```

Text or a differently modified image ends the carousel group; blank lines
between carousel images do not. Carousel captions are not visible, but alt text
remains available to assistive technology. On mobile, normal pairs become a
single column; contained and isolated images remain size-limited.

### Interactive demos

Playground projects can append a same-site interactive app after their Markdown
body:

```yaml
interactive:
  src: /path/to/demo.html
  title: Accessible title for the embedded demo
  height: 600
  mobileHeight: 750
```

`src` must begin with `/` and resolve to an existing public file in the site.
Heights are pixels, must be between `240` and `1200`, and default to `600`.
Links or other supporting controls should be authored explicitly in Markdown.

## Build, validation, and generated files

```bash
npm run build:projects   # Rebuild only Projects
npm run dev              # Build, serve, watch, and live reload
npm run build            # Build the complete production site
npm run preview          # Serve the existing production build
```

The build validates required metadata, category membership, unique
slugs/titles/orders, paths, file types, file existence, alt text, image
placement, modifiers, and carousel rules. Unreferenced project images produce a
warning without failing the build.

Referenced images are optimized to WebP in `assets/projects/`; animated GIFs
remain animated. The build also regenerates `projects/index.html`, standalone
featured case studies, and their related-project links. Treat those as outputs:
make content changes here, then rebuild.
