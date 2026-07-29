# Photos content guide

Photos use YAML rather than Markdown. Each subfolder is one album containing a
`collection.yml` file and its original images:

```text
content/photos/
└── 2026-copenhagen-denmark/
    ├── collection.yml
    ├── 01.jpg
    ├── 02.jpg
    └── 03.jpg
```

The folder name becomes the album's stable internal ID by default. Use a
descriptive lowercase, hyphen-separated name; renaming it changes generated
asset paths and album URLs.

## Page settings

The `PHOTOS_PAGE` object near the top of `scripts/build-photos.mjs` controls the
page title and description, social metadata, hidden heading, intro, filter and
search copy, gallery label, and lightbox labels. Album-specific titles,
descriptions, tags, and photo metadata remain in each album's `collection.yml`.

## Complete example

```yaml
year: 2026
order: 1
place: "Copenhagen"
country: "Denmark"
description: "Architecture, street details, and botanical interiors."
tags: [travel, city, architecture]
photos:
  - file: 01.jpg
    favorite: true
    alt: "Glass facade reflecting a pale Copenhagen sky"
    themes: [architecture, city, reflection]
    colors: [blue, grey, white]
    vibe: [clean, bright, calm]
  - file: 02.jpg
    alt: "Quiet street corner beside a green cafe"
    themes: [street, everyday life]
    colors: [green, brick, black]
    vibe: [quiet, soft]
```

The order of entries under `photos` is the normal display order. Favorites are
moved to the front while preserving the relative order within the favorite and
non-favorite groups.

## Album fields

| Field | Required | Effect |
| --- | --- | --- |
| `year` | One date form | Four-digit album year. Use either `year` or `years`. |
| `years` | One date form | Range with `start` and `end`; each is a four-digit year, and `end` may be `current`. |
| `order` | No | Numeric page position; lower values appear first. Albums without it follow ordered albums. |
| `place` | Yes | Album title, country/place filtering, search, and generated data. |
| `country` | Yes | Album title, country filters, search, and generated data. |
| `description` | Yes | Visible album description and searchable text. |
| `tags` | No | Album-wide search terms; accepts an inline list, block list, or one value. |
| `id` | No | Overrides the folder-based internal ID used by generated data and `?album=` links. Usually leave this unset. |
| `photos` | No | Explicit photos and metadata. If omitted, every supported image in the folder is included in natural filename order with generated fallback alt text. |

For an album spanning several years:

```yaml
years:
  start: 2023
  end: current
place: "Tours"
country: "France"
description: "Everyday photographs from an ongoing collection."
```

`current` is displayed literally—for example, `2023-current`—but resolves to
the current calendar year for sorting and year searches. The start year must not
be after the end year. A fixed range such as `2023`–`2026` is searchable by
every year inside that range.

When `order` is absent, albums sort by newest end year, newest start year,
country, place, then ID. `order` takes priority over all of those rules.

## Photo fields

| Field | Required | Effect |
| --- | --- | --- |
| `file` | Yes | Source filename. GIF, JPEG, PNG, and WebP are accepted. |
| `alt` | Recommended | Accessible lightbox description and searchable text. If omitted, a generic place/country label is generated. |
| `favorite` | No | `true` moves the photo to the front of its album and adds a subtle `★`; the source filename is unchanged. |
| `themes` | No | Searchable subjects such as `architecture`, `wildlife`, or `street scene`. |
| `colors` | No | Searchable visual colors such as `deep blue`, `cream`, or `charcoal`. |
| `vibe` | No | Searchable mood words such as `quiet`, `warm`, or `cinematic`. |
| `id` | No | Overrides the generated photo ID in `photos-data.json`. Usually leave this unset. |

`themes`, `colors`, `vibe`, and album `tags` may be a single value or a list.
Prefer a short list of concrete, reusable terms; these fields are metadata and
are not visibly printed on each photo. Quote prose and alt text, especially when
it contains `#`, `:`, or YAML-like values.

If `photos` is present, only listed files are published—even when other images
exist in the folder. Visible numbers are assigned after favorites are moved, so
they may differ from filenames.

## What search uses

Album search combines:

- year or every year in a range;
- place, country, description, and tags;
- each photo's alt text, themes, colors, and vibe.

Search is case- and accent-insensitive, ignores common words, requires every
entered term to match, supports partial words of at least three characters, and
knows a small set of useful equivalents such as `architecture`/`building`,
`sea`/`ocean`, and `grey`/`gray`. Country filters can be combined with search.

Albums can also be opened through query URLs such as `?album=<id>`,
`?place=Copenhagen`, `?country=Denmark`, or the short `?denmark` form.

## Build and generated files

```bash
npm run dev       # Build, serve, watch, and live reload
npm run build     # Regenerate Photos and the complete production site
npm run preview   # Serve the existing production build
```

The build requires a date, place, country, description, and at least one photo.
It rejects invalid years, ranges, orders, and missing `file` entries. Image
processing will fail if a listed source file does not exist or is unreadable.

Each source becomes:

- a gallery thumbnail in `assets/photos/<album>/`, capped at 1040 px;
- a higher-quality, source-sized lightbox image in
  `assets/photos-full/<album>/`.

Both variants are WebP. The build also regenerates `photos/index.html` and
`photos/photos-data.json`, removes stale generated images, and reuses cached
outputs when sources have not changed. Edit `content/photos/`, then rebuild;
do not hand-edit generated HTML, JSON, or image assets.
