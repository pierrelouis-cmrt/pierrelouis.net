# Face Looker (Vanilla) 👁️

Create an interactive face that follows the cursor using plain HTML, CSS, and JavaScript. No frameworks. No build step.

## What this is

- A tiny vanilla JS widget that swaps images based on pointer position
- Designed to work with a pre-generated grid of face images (generated elsewhere)

## Quick start

1) Put your gaze images in a `faces/` folder next to `index.html` using this naming pattern (export both `.avif` and `.webp` copies for each pose — the script auto-detects support and falls back to WebP):

```
gaze_px{SANITIZED_X}_py{SANITIZED_Y}_{SIZE}.{EXT}
```

Defaults expected by the script:

- P_MIN = -15, P_MAX = 15
- STEP = 3 (values like -15, -12, ..., 0, 3, ..., 15)
- SIZE = 256 (filename suffix)

Examples:

- `gaze_px0p0_py0p0_256.avif` (center)
- `gaze_px15p0_py0p0_256.avif` (right)
- `gaze_px0p0_pym15p0_256.avif` (up)

**Sanitized values:** numbers are always formatted with one decimal place, `-` becomes `m`, and `.` becomes `p`.  
Examples: `-12` → `m12p0`, `3` → `3p0`, `0` → `0p0`.

> The `_256` suffix is just an identifier in the filename. The demo ships 160&times;160px assets for snappier downloads; feel free to keep the suffix or change it, but make sure the constant and filenames stay in sync.

2) Open `index.html` in a browser (or serve the folder with any static server).

That's it. Move your cursor over the face.

## Configuration

In `index.html`, adjust attributes on the `.face-tracker` element:

- `data-base-path` (default `/faces/`) — where images are served from
  - Any value you pass will automatically be normalized to include a trailing `/`.
- `data-debug` (`true` | `false`) — show overlay with mouse coords and filename

Multiple faces are supported — add more `.face-tracker` elements with different `data-base-path` values.

## How it works

`face-tracker.js` maps pointer position to normalized coordinates in \([-1, 1]\), snaps to the nearest grid point using your step size, then picks the corresponding filename.

If you change your generation parameters, update these constants in `face-tracker.js` to match:

```
const P_MIN = -15;
const P_MAX = 15;
const STEP = 3;
const SIZE = 256;
```

## Styling

Edit `FaceTracker.css` to change size, shape, or add effects. Wrap the `.face-tracker` in your own container to control its dimensions.

## Performance & caching

- Keep the physical asset small (≈160&times;160px) and let CSS upscale; this is more than enough for the hero avatar.  
- Serve both `.avif` (primary) and `.webp` (fallback) for each pose. The tracker feature-detects support and gracefully degrades.  
- Add `<link rel="preload" as="image">` hints for the most common gaze directions (center + cardinal points) so the browser grabs them before the user hovers.  
- Host `/faces/` behind a CDN or static host that can send `Cache-Control: public, max-age=31536000, immutable` so repeat visitors never re-download the atlas.  
- If you need to conserve bandwidth for users on `slow-2g/2g/3g`, gate the eager preloader behind `navigator.connection.effectiveType` like the main site does.

## License

MIT — use in personal and commercial projects.
