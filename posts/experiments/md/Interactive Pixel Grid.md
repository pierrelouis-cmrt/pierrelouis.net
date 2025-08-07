This little coding experiment started with [Artem's Pixel Loader pen on CodePen](https://codepen.io/artzub/pen/XJJooON) as a base. I basically built on top of what he’d already done and took it in my own direction.

## What's this all about?

It’s a full-screen canvas made of tiny squares; I’ll just call them “pixels” here. They react to your mouse. Click anywhere on the screen and the pixel grid starts to grow outward from that point, like it’s blooming, before it gently settles down.

The hover effect isn’t just a static glow. Your cursor leaves behind a little _trail_, and the area it affects depends on your cursor’s direction and speed. Pixels nearby get brighter and slightly bigger. There’s even a touch of inertia, so the “blob” your cursor makes keeps moving for a moment after you stop. Think ripples on water slowly fading away.

## Making it smooth and fast

I wanted this to run nicely even on old laptops/cheap phones. The trick? The grid script always aims for around 10,000 pixels in total (or gets caped by a max gap I've set between two nearby pixels purely for looks). That’s dense enough to look fluid, but light enough for the effects to feel snappy.

The hover effect is deliberately subtle: small radius, gentle size and brightness changes. Go too strong and it turns into a messy, noisy soup... In this case, performance constraints are actually a good thing here!

As for colors, they’re not just random chaos of course. They’re generated randomly but carefully curated so they always look good, especially against the dark background.

## For the tech-curious

Here’s a quick peek at two key parts of the build: the auto grid sizing and the color curation.

### 1. Why it stays \~10k pixels on any screen

The main idea:

$\text{number of squares} \approx \frac{\text{screen area}}{(\text{gap})^2}$

We pick a “gap” size that makes this number roughly 10,000:

$\text{gap} \approx \sqrt{\frac{\text{width} \times \text{height}}{10{,}000}}$

Bigger screens → bigger gaps → fewer rows and columns. Smaller screens → smaller gaps → more rows and columns.

And here’s the little function that does exactly that:

```js
function computeAutoGap(targetCount = 10000, min = 5, max = 14) {
  const area = window.innerWidth * window.innerHeight;
  const gap = Math.round(Math.sqrt(area / targetCount));
  return Math.max(min, Math.min(max, gap)); // clamp to safe values
}

// on resize:
gap = computeAutoGap();
initPixels(); // rebuild grid with the new gap
```

### 2. How the colors always work

Here’s the quick step by step process:

1. Pick a random **base hue** (0–360° on the color wheel).
2. Pick one of 5 “relationships” at random:

   - **Analogous** (neighbors) → soft & harmonious
   - **Complementary** (opposites) → bold & punchy
   - **Split-complementary** (opposite ± a step) → balanced contrast
   - **Triadic** (even thirds) → lively & playful
   - **Monochrome** (same hue, different lightness) → clean & minimal

3. Keep saturation & lightness in sweet spots for dark backgrounds:

   - Saturation: 70–90% → colors pop but don’t scream
   - Lightness: 54–66% → bright enough on black, not neon
   - Add tiny random tweaks so it doesn’t feel “computer perfect.”

4. Convert to hex and apply them to the grid. Done.

And here’s the actual JavaScript:

```js
function randomLovelyPalette() {
  const base = Math.floor(Math.random() * 360);
  const scheme = ["analogous", "complement", "split", "triadic", "mono"][
    (Math.random() * 5) | 0
  ];

  // Choose 3 hues based on scheme
  let H = [];
  if (scheme === "analogous") {
    const s = 22 + Math.random() * 18; // 22–40°
    H = [base, base + s, base - s];
  } else if (scheme === "complement") {
    const comp = (base + 180) % 360;
    const acc = base + (Math.random() < 0.5 ? 30 : -30);
    H = [base, comp, acc];
  } else if (scheme === "split") {
    H = [base, base + 150, base + 210];
  } else if (scheme === "triadic") {
    H = [base, base + 120, base + 240];
  } else {
    // mono
    H = [base, base, base];
  }

  // S/L tuned for dark bg + tiny jitter
  const S0 = 72 + Math.random() * 20; // 72–92%
  const L0 = 54 + Math.random() * 12; // 54–66%

  return H.map((h, i) =>
    hslToHex(
      ((h % 360) + 360) % 360,
      clamp(S0 + (Math.random() * 12 - 6), 60, 95),
      clamp(
        L0 + (scheme === "mono" ? [-10, 0, 10][i] : Math.random() * 12 - 6),
        40,
        75
      )
    )
  );
}

// helpers
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12,
    a = s * Math.min(l, 1 - l);
  const f = (n) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) =>
    Math.round(255 * x)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}
```

## The demo

<iframe src="code/pixels.html" class="article-embed pixels-embed" loading="lazy"></iframe>

Or open it in full-page mode [here](code/pixels.html).
