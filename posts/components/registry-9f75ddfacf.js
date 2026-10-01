/**
 * Article-scale custom elements are registered here. The post build scans each
 * article and only loads the styles and modules used by that page.
 */
export const POST_COMPONENTS = Object.freeze({
  "pl-carousel-demo": {
    app: "apps/carousel.html",
    label: "Sliding-window carousel",
    script: "article-demos.js",
    style: "article-demos.css",
  },
  "pl-full-bleed-demo": {
    app: "apps/bleed-trick.html",
    label: "Full-bleed layout comparison",
    script: "article-demos.js",
    style: "article-demos.css",
  },
  "pl-lissajous-lab": {
    app: "apps/lissajous.html",
    label: "Interactive Lissajous curve generator",
    script: "article-demos.js",
    style: "article-demos.css",
  },
  "pl-pixel-grid": {
    app: "apps/pixels.html",
    label: "Interactive pixel grid",
    script: "article-demos.js",
    style: "article-demos.css",
  },
});
