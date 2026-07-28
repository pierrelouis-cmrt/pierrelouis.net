# Editing projects

Projects are split into two explicit collections:

```text
content/projects/
├── projects.yml
├── featured/
│   └── my-case-study/
│       ├── index.md
│       ├── listing/
│       │   ├── 01.webp
│       │   └── 02.webp
│       └── media/
│           ├── hero.webp
│           └── detail.webp
└── playground/
    └── my-experiment/
        ├── index.md
        ├── listing/
        │   └── cover.webp
        └── media/
            └── presentation.webp
```

The parent folder defines the collection, so project front matter does not need
a `collection` field. `projects.yml` only contains copy shared by the Projects
page.

## `listing/` versus `media/`

The separation is strict and intentional:

- `listing/` contains only images used by the Projects index: featured rows,
  Playground cards, social previews and related-project previews.
- `media/` contains only images used in the Markdown body of a case study or
  Playground sheet.

The build rejects a listing reference outside `listing/` and a Markdown image
outside `media/`. An image can be copied into both folders when it genuinely
serves both roles. This avoids coupling the index composition to the detailed
project content.

## Add a featured project

Create `content/projects/featured/<slug>/index.md`:

```md
---
title: My Project
order: 10
description: Web Design
category: Web Design
year: "2026"
summary: A short description used in metadata and the page introduction.
note: An optional second note for the introduction.
listing:
  images:
    - file: listing/01.webp
      alt: Homepage of the My Project website.
      main: true
    - file: listing/02.webp
      alt: Detail view of the My Project website.
      wide: true
---

![Project overview](media/hero.webp){wide}

Write the case study in ordinary Markdown, in its final order.

![First detail](media/detail-01.webp)
![Second detail](media/detail-02.webp)

## A section heading

The heading sits in column one while this copy begins at the same vertical
position across columns two and three.
```

Featured orders can stay spaced (`10`, `20`, `30`) so inserting `15` later is
easy.

## Add a Playground project

Create `content/projects/playground/<slug>/index.md`:

```md
---
title: Small Experiment
order: 1
description: A short listing caption
category: Branding
year: "2026"
summary: Optional longer metadata description.
listing:
  image: listing/cover.webp
  alt: Small Experiment identity artwork.
---

![Identity presentation](media/presentation.webp){contained}

A short note about the experiment.
```

Playground uses simple sequential orders (`1`, `2`, `3`, …).

## Listing images

Featured projects normally use an image list:

```yaml
listing:
  images:
    - file: listing/01.webp
      alt: A meaningful description.
      main: true
    - file: listing/02.gif
      alt: An animated website presentation.
      wide: true
      dark: true
      framed: true
```

`main` selects the social and related-project preview. If omitted, the first
listing image is used. Only one image can be `main`.

Playground projects can use the concise single-image form:

```yaml
listing:
  image: listing/cover.png
  alt: Willow identity artwork.
```

## Markdown image layouts

Markdown images must be alone on their line and point inside `media/`.

### Normal

```md
![First study](media/01.webp)
![Second study](media/02.webp)
```

Normal images use a 4:5 slot and fill it with a centered crop. Two consecutive
normal images sit side by side. If a normal image is left alone by surrounding
text, `{wide}` or `{contained}` images, the build centers it automatically at
one-column width instead of stretching it across the screen.

### Wide

```md
![Final result](media/final.webp){wide}
```

`{wide}` spans both columns, uses a 16:9 slot and fills it with a centered crop.

### Contained

```md
![Packaging presentation](media/packaging.webp){contained}
```

`{contained}` spans both columns but keeps the full image visible, centered at
a restrained size inside a tall gray presentation area. This is the intended
layout for artwork and mockups in Playground sheets.

On mobile, normal pairs collapse to one column. Contained images keep their
presentation area, while automatically isolated normal images remain centered
and size-limited.

## Text layout

Plain text occupies columns two and three on desktop. A Markdown heading starts
a titled text block: the heading occupies column one and the following copy
starts on the same row in columns two and three. On mobile, both stack in
reading order.

The Markdown body is rendered inside a Playground sheet on the Projects page.
Playground projects do not generate standalone `/projects/<slug>/` pages;
those URLs are reserved for featured case studies. Open sheets use shareable
query URLs such as `/projects/?sheet=my-experiment`.

## Validation and assets

The build stops when:

- required metadata is missing;
- a slug, order or category is invalid;
- two projects in one collection share an order;
- a redundant `collection` field is present;
- an image has no alt text or does not exist;
- a listing image leaves `listing/`;
- a Markdown image leaves `media/`;
- an image is embedded inline instead of being placed on its own line;
- an unknown image modifier is used.

Unused image files produce warnings but do not block the build. Only referenced
GIF, JPEG, PNG and WebP files are optimized into `assets/projects/`.

## Commands

```bash
npm run build:projects
npm run dev
npm run build
npm run preview
```

`npm run dev` watches `content/projects/` and rebuilds automatically.
