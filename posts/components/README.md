# Article components

Article-scale native custom elements live here. Register every public `pl-*`
element in `registry.js` with its module and optional stylesheet:

```js
export const POST_COMPONENTS = Object.freeze({
  "pl-interactive-figure": {
    app: "apps/interactive-figure.html",
    label: "Interactive figure",
    script: "interactive-figure.js",
    style: "interactive-figure.css",
  },
});
```

The Markdown source then uses:

```html
<pl-interactive-figure></pl-interactive-figure>
```

The build rejects unregistered names and includes only the assets used by each
article. Components should participate in article width, typography and page
scrolling. Keep independent viewport-owning applications in iframes instead.

The five built-in interactive article elements use `article-demos.js` as a
progressive-enhancement shell around isolated local applications:

- `pl-carousel-demo`
- `pl-full-bleed-demo`
- `pl-lissajous-lab`
- `pl-pixel-grid`

Their applications live in `apps/`, have no production network dependency, and
remain directly openable through the component toolbar. Keep fallback copy
inside each Markdown custom element so an article still explains what belongs
there if JavaScript cannot load.

The avatar, full-bleed, carousel, and pixel-grid demos were migrated from the
original [`pierrelouis.net-v1/posts/code`](https://github.com/pierrelouis-cmrt/pierrelouis.net-v1/tree/main/posts/code)
implementations. The carousel keeps the original interaction model while using
local site photography and browser-native scrolling so publishing no longer
depends on a third-party CDN.
