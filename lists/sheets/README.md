# List sheets

The Lists page is built from two deliberately separate layers:

- `content/lists/` is a build mirror of the Obsidian folder
  `Portfolio/Lists/`.
- `lists/sheets/*.html` controls each sheet's title, description, layout, and
  optional custom components.

`npm run build:lists` refreshes the mirror when the vault is available, renders
the Markdown slots, wraps every fragment in the shared dialog chrome, and
injects the result between the generated markers in `lists/index.html`.

The default vault source can be overridden with `OBSIDIAN_LISTS_DIR`. When the
default vault is unavailable (for example in CI), the committed
`content/lists/` mirror is used. An explicitly configured missing source is an
error.

## Markdown slots

Place a source marker anywhere inside a sheet fragment:

```html
<!-- list-sheet-markdown: shows.md -->
```

The builder replaces it with the rendered body of `content/lists/shows.md`.
Markdown paragraphs, headings, links, lists, and inline HTML are preserved.
Top-level bullet items receive `data-list-entry`, so the existing sheet counter
continues to work automatically.

The marker is only a slot. Custom HTML can appear before or after it, which
makes compositions such as a map followed by a country list possible:

```html
<div class="visited-places-map"><!-- custom map component --></div>
<!-- list-sheet-markdown: places.md -->
```

A sheet does not need a Markdown slot at all. `tech-and-gear.html` currently
demonstrates a fully custom fragment.

## Fragment contract

- The filename must match a card's `data-list-sheet-open` value.
- The root must use `list-sheet__content` and declare
  `data-list-sheet-title`.
- The title ID must be `list-sheet-title-<slug>`.
- A description with ID `list-sheet-description-<slug>` is optional.
- Do not include `<html>`, `<body>` or `<dialog>`; the builder owns the shell.
- Everything else is intentionally unrestricted.
- Put media in `/assets/lists/<slug>/`; raw authoring fragments are excluded
  from production `dist/`.

## Listing visual and entry count

The empty element marked `data-list-sheet-cover` is filled with an exact clone
of that card's listing visual. This keeps image cards, the TV collage and the
Places checkerboard in sync without duplicating their markup.

The metadata count updates automatically. Markdown top-level bullet items are
marked during the build. For custom markup, add `data-list-entry` yourself:

```html
<article data-list-entry>
  <h3>Example entry</h3>
  <p>Entry notes.</p>
</article>
```

## Custom CSS and JavaScript

Custom `<style>` and `<script>` elements can live directly in a fragment. Scope
CSS to the generated sheet ID. Scripts can listen for
`list-sheet:before-open`, `list-sheet:open`, `list-sheet:before-close`, and
`list-sheet:close` lifecycle events.
