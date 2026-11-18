# Article components

Article-scale native custom elements live here. Register every public `pl-*`
element in `registry.js` with its module and optional stylesheet:

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

The four standalone demo elements use `article-demos.js` as a
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

## Inline Lissajous figures

These native SVG components use `lissajous-figures.js` and
`lissajous-figures.css`, loaded once on pages that use them. They create no
iframes. Write the tags directly in Markdown, without code fences:

```html
<pl-lissajous-closure class="post-media" caption="A rational curve closes; an irrational curve keeps exploring.">
  <p class="post-component-fallback">A comparison of rational and irrational frequency ratios.</p>
</pl-lissajous-closure>

<pl-lissajous-gap class="post-media" caption="The shaded central cell contains the largest gap.">
  <p class="post-component-fallback">Denser trajectories leave smaller gaps.</p>
</pl-lissajous-gap>

<pl-lissajous-intervals class="post-media" caption="Choose a note above C4 and listen.">
  <p class="post-component-fallback">An interactive piano and curve comparison.</p>
</pl-lissajous-intervals>
```

The time-lapse starts when it enters view, stops after ten seconds and offers
pause/replay. The gap component cycles through `5:3 7:5 9:7 11:9` by default;
`ratios="5:3 7:5"` and `k="2"` can customize it. Its shaded cell is traced from
the actual curve and remains visible while it changes size. The piano keeps C4
as a root and offers thirteen note choices using just ratios by default. Pressing
a key plays the selected pair; there is no separate tuning or playback toolbar.
`tuning="equal"` can opt an instance into equal temperament. Audio starts only
on a user gesture and is synthesized, not sampled.
All figures pause offscreen and respect reduced motion.

## Video and audio players

The native media players share `media-player.js` and `media-player.css`.
Use real media children with `controls` for a native fallback without JavaScript.
Put credits in an ordinary caption directly below the player:

```html
<figure class="post-media">
  <pl-video-player label="A sand pendulum records its oscillation" ratio="16 / 9">
    <video src="/posts/components/media/sand-pendulum.mp4" poster="/posts/components/media/sand-pendulum.jpg" preload="metadata" playsinline controls></video>
  </pl-video-player>
  <figcaption class="post-caption"><span>Video: Ecole Science, via <a href="https://hubbs.schule/mediathek/pendel-mit-sandspur">HubbS</a>, CC0.</span><span class="post-caption__index">Video / 01</span></figcaption>
</figure>

<figure class="post-media">
  <pl-audio-player label="C and G · a perfect fifth">
    <audio src="/posts/components/media/perfect-fifth.mp3" preload="metadata" controls></audio>
  </pl-audio-player>
  <figcaption class="post-caption"><span>Piano-like tones synthesized for this page.</span><span class="post-caption__index">Audio / 01</span></figcaption>
</figure>
```

Use absolute public paths for media sources. Caption indexes are authored
manually. Keep captions concise and include creator, source and licence where
required; local asset provenance is recorded in `media/README.md`.

Both players provide play/pause and seeking, including arrow keys, Home/End,
and Space/Enter. Starting one audible media player pauses the others. No media
autoplays by default. The host supports `src`, `label`, `preload`, `loop`,
`muted`, and `autoplay`; video also supports `poster` and `ratio`. The shorter
`<pl-audio-player src="/path/to/track.mp3" label="Track"></pl-audio-player>`
works too, but requires JavaScript to create the media element.

The host exposes `.media`, `.paused`, `.currentTime`, `.duration`, `.play()`
and `.pause()`. The development server supplies MIME types and byte ranges
for local seeking. Browser QA can use installed Chrome with
`PLAYWRIGHT_CHANNEL=chrome npm run qa:posts` if bundled Chromium is absent.
