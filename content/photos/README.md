# Photos content

Add one folder per photo collection:

```txt
content/photos/
  2025-copenhagen-denmark/
    collection.yml
    01.jpg
    02.jpg
    03.jpg
```

`collection.yml` is the only file you edit for text and metadata:

```yaml
year: 2026
order: 1
place: Copenhagen
country: Denmark
description: Weekend trip, architecture and street details
tags: [architecture, street, travel]
photos:
  - file: 01.jpg
    favorite: true
    alt: Glass facade in Copenhagen
    themes: [architecture, city]
    colors: [blue, grey, white]
    vibe: [clean, bright]
  - file: 02.jpg
    alt: Street corner in Copenhagen
    themes: [street, everyday life]
    colors: [green, brick, black]
    vibe: [quiet, soft]
```

For a category that spans multiple years, use `years` instead of `year`:

```yaml
years:
  start: 2024
  end: current
place: Stockholm
country: Sweden
description: Everyday photos from where I live
tags: [architecture, city, everyday life]
photos:
  - file: 01.jpg
    alt: Building facade in Stockholm
```

Use `order` to choose the order of the photo groups on the page. Lower numbers
appear first. Use simple values like `1`, `2`, `3`.

For an ongoing category, use `current` as the end year. It will render as
`2023-current` and use the current calendar year for search and sorting.

Use `favorite: true` on any photo that should appear first inside its group.
Favorite photos keep their original filenames; only the display order and
visible numbers change. They also display a subtle `★` marker in the top-left
corner. If several photos are favorites, their relative order is the same as
their order in `collection.yml`.

Commands:

- `npm run build`: regenerate `photos/index.html` and copy photo assets.
- `npm run dev`: build, serve locally, watch changes, and auto-reload the browser.
- `npm run preview`: build and serve the production-like static site without watch.

Generated files live in `photos/index.html`, `photos/photos-data.json`, and
`assets/photos/<collection-folder>/`.
