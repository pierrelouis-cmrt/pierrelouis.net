# Article components

Article-scale native custom elements live here. Register every public `pl-*`
element in `registry.mjs` with its module and optional stylesheet:

```js
export const POST_COMPONENTS = Object.freeze({
  "pl-interactive-figure": {
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
