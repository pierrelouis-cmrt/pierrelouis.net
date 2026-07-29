# Obsidian-to-HTML post publishing

This directory is the repository side of the post publishing system. Markdown
is authored in Obsidian, synchronized here, validated, rendered by Eleventy,
and written as ordinary static HTML under `posts/`.

The visual thesis is the existing post page: quiet editorial typography,
generous pacing, media that briefly breaks the reading measure, and an optional
animated atmosphere behind the hero. The content plan is hero metadata,
article body, sources/endnotes, then site footer. The interaction thesis is
limited to purposeful article behavior: TOC navigation, image lightboxes and
galleries, plus explicitly registered article-scale components.

## Everyday workflow

The default vault source is:

```text
/Users/pierrelouis/Documents/Obsidian/Main Vault/Writing/Final Versions
```

Start the development server:

```bash
npm run dev
```

The development and production builds automatically:

1. copies that folder into `content/posts/articles/`, excluding `.DS_Store`;
2. validates the candidate mirror before replacing the current mirror;
3. keeps the previous mirror as a rollback until the remaining steps pass;
4. replaces only the repository mirror, never the vault;
5. builds every post and `posts/index.html`.

During `npm run dev`, changes in the Obsidian folder are watched and imported
automatically. `npm run build` performs a fresh import before assembling
`dist/`. If the post build fails, the pipeline restores the previous mirror
and regenerates its pages before reporting the original error.

Set `OBSIDIAN_POSTS_DIR` to use another source folder. On machines where the
default vault folder is unavailable, builds use the checked-in repository
mirror. If `OBSIDIAN_POSTS_DIR` is explicitly set, that folder must exist.

Other commands:

| Command | Purpose |
| --- | --- |
| `npm run build:posts` | Build from the repository mirror only |
| `npm run build` | Build the complete site, including posts, into `dist/` |
| `npm run dev` | Build, watch and serve at `http://127.0.0.1:8000/` |
| `npm run qa:posts` | Force browser QA and regenerate all QA screenshots |
| `npm run preview` | Serve the production `dist/` build |

## Directory map

```text
content/posts/
├── articles/                 # Exact synchronized vault mirror
├── _includes/
│   ├── post.njk
│   ├── post-endmatter.njk
│   ├── post-lightbox.njk
│   └── posts-index.njk
├── EXAMPLE_POST.md           # Complete authoring example (not published)
└── index.njk

posts/
├── headers/                  # Isolated decorative header applications
├── components/               # Registered native article components
├── assets/                   # Synchronized article assets
├── post.css
├── post.js
├── posts.css
├── posts.js
├── index.html                # Generated
└── <slug>/index.html         # Generated
```

Never hand-edit a generated article or the generated posts index. Markdown and
frontmatter are the authoring source of truth; generated HTML is the visual-QA
source of truth.

## Frontmatter contract

Keep properties flat so they remain easy to edit in Obsidian:

```yaml
---
title: "Lissajous Curves: Where Mathematics Meets Music and Light"
description: "How two oscillations connect mathematics, musical harmony, design and laser scanning."
date: 2026-02-01
slug: lissajous-curves
type: article
tags:
  - mathematics
  - physics
  - interaction
lang: en
toc: auto

hero-image: assets/curves_k.webp
hero-alt: "A grid of Lissajous figures generated from frequency ratios and phase values."
hero-caption: "Frequency ratio determines structure; phase changes the figure."
---
```

Required fields:

- `title`
- `description`
- `date` in `YYYY-MM-DD`
- `slug`, permanently fixed and lowercase with hyphens
- `type`: `article`, `note`, or `experiment`

Optional fields:

- `tags`: topical labels; do not repeat the post type
- `lang`: defaults to `en`
- `toc`: `auto`, `true`, or `false`
- `header-backdrop`: a simple name resolving to `posts/headers/<name>.html`
- `header-nav`: `light` or `dark`
- `header-tag-color`: a validated CSS color
- `hero-image`, `hero-alt`, and `hero-caption`

If `hero-image` is present, `hero-alt` is required. Local references are
validated and path traversal is rejected. Remote images warn because published
media should be kept with the article.

The compiler does not infer identity from filenames or tags. Every post owns
its permanent `slug` and explicit `type`, so renaming an Obsidian file cannot
silently change its public URL or classification. Unknown frontmatter
properties and type names repeated in `tags` fail validation.

## Markdown dialect

The template supplies the only H1. Start article sections with H2.

```markdown
## Main section

### Subsection
```

`toc: auto` shows the TOC for at least two H2 sections. `toc: true` shows it
for one or more; `false` disables it. Heading IDs are stable, accent-insensitive
slugs with duplicate suffixes.

Standard Markdown is supported for emphasis, links, lists, task lists, tables,
horizontal rules, inline HTML and blockquotes. These Obsidian forms are also
supported:

```markdown
[[Published Post]]
[[Published Post#Section|Custom label]]
![[assets/image.webp|Descriptive alt text]]
==highlighted text==
Visible text %%hidden author note%%

> [!tip] Obsidian callout
> Callouts can contain **inline Markdown**.

> [!warning]- Foldable callout
> This one starts collapsed.
```

Wikilinks must resolve to another published post. Note, PDF and audio embeds
must be replaced by a link or a registered component.

### Images and captions

```markdown
![Descriptive alternative text](assets/historical-experiment_photo.webp)

*Figure 1 — Light figures produced by two perpendicular tuning forks.[^1]*
```

A standalone image followed immediately by a fully italic paragraph becomes a
lightbox figure and caption. An image without that paragraph becomes an
uncaptioned figure.

### Math

Use Obsidian-compatible KaTeX notation:

```markdown
Inline math: $f_x / f_y = n_x / n_y$

$$
X = A_x \cos(2\pi f_x t + \phi_x)
$$
```

Math renders at build time. Invalid expressions fail with the source filename
and line number. Readers download KaTeX CSS/fonts, not the renderer.

### Code

The first fence-info token is the language. Add `copy` to opt into the copy
button:

````markdown
```python copy
import numpy as np
```

```text
This block is intentionally not highlighted.
```
````

Language aliases such as `js`, `py`, `sh`, `ts`, `yml`, and `c++` are
normalized. Unknown languages or flags fail with a filename and line number.
Highlighting happens at build time; `post.js` only adds line numbers and copy
behavior.

### Footnotes and sources

```markdown
This claim has a source.[^1]

[^1]: [Source title](https://example.com)

## Sources

- [Primary source](https://example.com/primary)
```

The final `## Sources` section and Markdown footnotes are moved into the
article endmatter and omitted from the TOC.

## Interactive content

Use a registered `pl-*` custom element for an interaction that belongs inside
the article layout:

```html
<pl-interactive-figure></pl-interactive-figure>
```

Register its module and optional stylesheet in
`posts/components/registry.js`. The build rejects unknown `pl-*` names and
loads only the files used by each article.

Use an iframe only for an independent application that owns its viewport,
installs document-level input behavior, or needs strong isolation. Missing
local iframe applications produce a build warning and a visible fallback,
never a broken blank frame. Heavy applications should use a local poster and a
normal link instead.

## Header Lab

While `npm run dev` is running, open:

```text
/posts/<slug>/?header-lab=1
```

The dev-only shell previews the real generated article at 1440 px or 390 px
and controls navbar tone, tag color, OKLCH lightness, alpha, pause, deterministic
timeline progress, and CSS/WebGL rendering. “Copy YAML configuration” returns
frontmatter-ready values. The Header Lab is generated by the development server
and never enters `dist/`.

Header iframes use `posts/headers/header-protocol.js` and report their supported
pause/scrub/renderer capabilities with `postMessage`.

## Validation and QA

Every build checks metadata, duplicate slugs, header names/files, CSS colors,
component registration, local assets, path traversal, H1 misuse, code fence
languages/flags and math parsing. Generated output is checked for one H1,
expected pages/index links, and absence of runtime math/highlight renderers.

Browser QA loads every changed post at desktop and mobile sizes, records console
and request failures, checks TOC/lightbox behavior, and writes screenshots under
`output/playwright/posts-qa/`. Its cache hash includes the article, header,
layout, CSS, client behavior and component registry. `npm run qa:posts` bypasses
that cache.
