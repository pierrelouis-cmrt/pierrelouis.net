# Projects content

The projects page is built from [`projects.yml`](./projects.yml). You should not
edit the HTML between the `projects:generated` comments in
`projects/index.html`; `npm run build` replaces that region.

## Everyday workflow

1. Add original project images under `content/projects/featured/` or
   `content/projects/playground/`.
2. Add or edit the corresponding entry in `projects.yml`.
3. Run `npm run dev` and open `http://localhost:8000/projects/`.
4. Commit the YAML, original images, generated `assets/projects/` images, and
   generated `projects/index.html` together.

The order of entries in the YAML file is the order shown on the page. Image
width and height are read automatically. The build also checks required text,
alt text, duplicate titles and slugs, supported image formats, output-name
collisions, and missing files.

Do not edit images in `assets/projects/` manually. That directory contains only
generated production files and is cleaned during builds. All source images live
under `content/projects/`.

### What the image build does

- Every source becomes WebP, including animated GIFs.
- Outputs target approximately twice the largest responsive render box.
- The calculation accounts for `cover` cropping on featured images and
  `contain` sizing on Playground images.
- Image aspect ratios are preserved; crops remain controlled by CSS.
- Smaller sources are never enlarged.
- Metadata is stripped and WebP encoding is optimized.
- Unchanged images are skipped using a local build cache.
- Generated files no longer referenced by `projects.yml` are removed.

The target boxes are based on the current 760 px and 1100 px breakpoints. This
keeps images sharp on high-density displays without carrying unnecessarily
large originals into production. A landscape image may retain extra width when
it needs that width to stay sharp inside a portrait `cover` crop.

## Add a featured project

Every featured project has a case study. Its `slug` automatically becomes the
link `/projects/<slug>/`, so there is no separate link field to keep in sync.

```yaml
featured:
  - slug: my-new-project
    title: My New Project
    description: Web Design, Development
    images:
      - file: featured/my-new-project-01.jpg
        alt: Homepage of the My New Project website.
      - file: featured/my-new-project-02.png
        alt: Mobile screens from the My New Project website.
        wide: true
```

Create the associated case study at
`projects/my-new-project/index.html`. Slugs must use lowercase words separated
by hyphens.

Featured images support three optional presentation switches:

```yaml
        wide: true     # span two columns on desktop
        dark: true     # use a black media background
        framed: true   # use the existing tall framed-image treatment
```

Only add a switch when an image needs it. All switches default to `false`.

## Add a playground project

Playground projects are simple image cards and do not link to case studies:

```yaml
playground:
  - title: Small Experiment
    description: A one-line explanation
    image: playground/small-experiment.png
    alt: Geometric artwork made for Small Experiment.
```

## Edit page copy

The `page` section at the top of `projects.yml` controls the category line,
intro paragraph, and Playground introduction:

```yaml
page:
  categories: [Web Design, Branding, Graphic Design]
  intro: Featured projects and experiments...
  playgroundIntro: Everything below...
```

The “All Work” number is calculated from the featured and playground entries.

## Commands

- `npm run dev`: rebuild projects while YAML or project images change, serve
  the site, and reload the browser.
- `npm run build`: build projects, photos, and shared components.
- `npm run build:projects`: validate and rebuild only the projects page.

Source images can be GIF, JPEG, PNG, or WebP. Keep the best practical source in
`content/projects/`; the build decides the production format and size.
