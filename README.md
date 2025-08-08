# Pierre-Louis' Portfolio Website

[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Website](https://img.shields.io/badge/Website-pierrelouis.net-blue.svg)](https://pierrelouis.net)

This repository contains the source code for my personal portfolio site built with HTML, Tailwind CSS and Alpine.js.

## Getting Started
1. Install dependencies with `npm install`.
2. Run `npm run build` to generate `src/output.css` from Tailwind.
3. Open `index.html` in your browser or deploy the contents of this repository.

## License
This project is licensed under the [MIT License](LICENSE).

## Colophon
See the [Colophon page](https://pierrelouis.net/colophon) for credits and attributions.

## Image Proxy for Last.fm Covers

To reduce LCP and still serve large, high‑DPR cover art, this repo includes a tiny cached PHP image proxy at `api/img.php`.

- Endpoint: `/img?src=<URL>&w=<width>&dpr=<1|2|3>&fmt=<auto|webp|png|jpeg>&q=<40..95>`
- Allowed hosts: `lastfm.freetls.fastly.net`, `lastfm-img2.akamaized.net`
- Caching: First request generates `/_cache/img/<hash>.<ext>` then responds `301` with `Cache-Control: public, max-age=31536000, immutable` to that static file. Browsers cache the redirect; future loads hit the static file (no PHP worker).

Example usage in HTML:

```html
<img
  src="/img?src=https%3A%2F%2Flastfm.freetls.fastly.net%2Fi%2Fu%2F770x0%2Fsome.jpg&w=360&dpr=1&fmt=auto"
  srcset="
    /img?src=https%3A%2F%2Flastfm.freetls.fastly.net%2Fi%2Fu%2F770x0%2Fsome.jpg&w=360&dpr=1&fmt=auto 1x,
    /img?src=https%3A%2F%2Flastfm.freetls.fastly.net%2Fi%2Fu%2F770x0%2Fsome.jpg&w=360&dpr=2&fmt=auto 2x
  "
  sizes="(max-width: 700px) 90vw, 360px"
  width="360" height="360"
  fetchpriority="high" decoding="async" loading="eager"
  alt="Album art"
>
```

Notes:
- Prefer `fmt=auto` (WebP/AVIF when supported). Use `fmt=png` only if necessary.
- Set realistic `w`/`sizes` for your layout. The proxy avoids upscaling.
- On upstream errors, the proxy redirects to the original image with a short TTL to avoid broken LCPs.
