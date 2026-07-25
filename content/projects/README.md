# Projects content

The projects page is built from [`projects.yml`](./projects.yml). You should not
edit the HTML between the `projects:generated` comments in
`projects/index.html`; `npm run build` replaces that region.

## Everyday workflow

1. Add project images under `assets/projects/featured/` or
   `assets/projects/playground/`.
2. Add or edit the corresponding entry in `projects.yml`.
3. Run `npm run dev` and open `http://localhost:8000/projects/`.
4. Commit the YAML, images, and generated `projects/index.html` together.

The order of entries in the YAML file is the order shown on the page. Image
width and height are read from the files automatically. The build also checks
required text, alt text, duplicate titles and slugs, supported image formats,
and missing files.

## Add a featured project

Every featured project has a case study. Its `slug` automatically becomes the
link `/projects/<slug>/`, so there is no separate link field to keep in sync.

```yaml
featured:
  - slug: my-new-project
    title: My New Project
    description: Web Design, Development
    images:
      - file: featured/my-new-project-01.webp
        alt: Homepage of the My New Project website.
      - file: featured/my-new-project-02.webp
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
    image: playground/small-experiment.webp
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

Project images can be GIF, JPEG, PNG, or WebP. WebP is recommended for still
images because it generally keeps downloads smaller.
