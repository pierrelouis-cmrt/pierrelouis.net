# List sheets

Each Lists card owns one HTML fragment in this directory:

| Card slug | Source file |
| --- | --- |
| `things-i-like` | `things-i-like.html` |
| `things-i-dislike` | `things-i-dislike.html` |
| `tv-shows` | `tv-shows.html` |
| `articles-and-videos` | `articles-and-videos.html` |
| `places-ive-been` | `places-ive-been.html` |
| `tech-and-gear` | `tech-and-gear.html` |

`npm run build:lists` wraps these fragments in the shared sheet chrome and
injects them between the generated markers in `lists/index.html`. Edit the
source fragments, never the generated dialogs.

## Fragment contract

- The filename must match a card's `data-list-sheet-open` value.
- The root must use `list-sheet__content` and declare
  `data-list-sheet-title`.
- The title ID must be `list-sheet-title-<slug>`.
- A description with ID `list-sheet-description-<slug>` is optional.
- Do not include `<html>`, `<body>` or `<dialog>`; the builder owns the shell.
- Everything else is intentionally unrestricted.
- Put media in `/assets/lists/<slug>/`; the raw authoring fragments themselves
  are intentionally excluded from the production `dist/` directory.

## Listing visual and entry count

The empty element marked `data-list-sheet-cover` is filled with an exact clone
of that card's listing visual. This keeps image cards, the TV collage and the
Places checkerboard in sync without duplicating their markup.

The metadata count updates automatically. Mark each real list item with
`data-list-entry`:

```html
<article data-list-entry>
  <h3>Example entry</h3>
  <p>Entry notes.</p>
</article>
```

Adding, removing or dynamically inserting entries updates `0 entries`,
`1 entry`, and plural counts without sheet-specific JavaScript.

## Custom CSS

Put a `<style>` element directly in the fragment. Scope every selector to the
generated sheet ID so it cannot leak:

```html
<style>
  #list-sheet-things-i-like .my-custom-layout {
    display: grid;
  }
</style>
```

## Custom JavaScript

Put a regular `<script>` directly in the fragment. It is preserved in the
generated page and runs in place, so `document.currentScript.closest()` finds
its sheet:

```html
<script>
  (() => {
    const sheet = document.currentScript.closest("[data-list-sheet]");

    sheet.addEventListener("list-sheet:open", () => {
      // Set up or refresh this sheet.
    });

    sheet.addEventListener("list-sheet:close", () => {
      // Pause or clean up this sheet.
    });
  })();
</script>
```

Available lifecycle events are `list-sheet:before-open`, `list-sheet:open`,
`list-sheet:before-close` and `list-sheet:close`.
