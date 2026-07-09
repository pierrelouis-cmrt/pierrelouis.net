# Photos content

Add one folder per photo collection:

```txt
content/photos/
  2026-copenhagen-denmark/
    collection.yml
    01.jpg
    02.jpg
    03.jpg
```

`collection.yml` is the only file you edit for text and metadata:

```yaml
year: 2026
place: Copenhagen
country: Denmark
description: Weekend trip, architecture and street details
tags: [architecture, street, travel]
photos:
  - file: 01.jpg
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

Commands:

- `npm run build`: regenerate `photos/index.html` and copy photo assets.
- `npm run dev`: build, serve locally, watch changes, and auto-reload the browser.
- `npm run preview`: build and serve the production-like static site without watch.

Generated files live in `photos/index.html`, `photos/photos-data.json`, and
`assets/photos/<collection-folder>/`.
