This little coding experiment has [Artem's Pixel Loader pen on CodePen](https://codepen.io/artzub/pen/XJJooON) as a starting point. I've sort of build on top of what he had already done.

## What is this project about?

This project is a full-screen canvas made of tiny squares that I will call "pixels" here. Those react to the mouse. Clicking on the screen will start the generation of the pixel grid, extending from the point you clicked outwards. You could say that the grid "blooms" and then gently settles.

The hover effect isn't a simple static effect. Your cursor actually leaves behind a short _trail_. The area impacted by the cursor movement is dynamic, meaning it changes depending on the cursor direction and speed. Nearby pixels get slightly bigger and brighter. A tiny bit of inertia keeps the "blob" (created by your cursor) moving for a moment after you stop. I guess the best way to imagine it is thinking of water calming down.

## Great, but where's the interesting stuff then?

My goal was to make the experience as smooth as possible, even on low-end machines like an old computer or cheap phone. To do that, the grid generation script always makes sure the number of total pixels created is always around 10k. This number felt high enough to make the grid dense to look fluid, and low enough, so the various effects felt fast.

The hover effect is deliberately subtle for smoothness. Its radius is kept reasonable and the size/brightness effect it has on pixels stays subtle. It would have looked messy otherwise so performance limitations are a good thing here!

Lastly, color choices aren’t random chaos. As detailed below, colors are randomly generated but carefully curated, ensuring a visually pleasing grid against the dark background every time.

## And for the tech-savvy people reading this

I'm going to quickly explain, code-wise, how 2 aspects of the generation work: auto grid size, and color curation.

### 1. Why it stays ~10k pixels, no matter the screen

Here is the main idea behind this: the $$\text{number of squares} \approx \text{screen area} \div (\text{gap})^2$$
We now get a way to compute the gap specific to each screen:
$$\text{gap} \approx \sqrt{\frac{\text{width} \times \text{height}}{10{,}000}}$$

The result: on bigger screens, the gap increases, resulting in fewer rows and columns, whereas on smaller screens, the gap decreases, producing more rows and columns.

Here is the piece of the JavaScript code that does exactly like what was explained above:

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

### 2. The curation of colors, so it always looks nice

The process is quickly detailed step by step below:

- <u>step 1:</u> pick a _base hue_ (0-360° on the color wheel)
- <u>step 2:</u> randomly choose between 5 types of "relationship":
  - **Analogous** (neighbors) → harmonious, soft
    - **Complementary** (opposites) → striking, punchy
    - **Split-complementary** (opposite ± a step) → balanced contrast
    - **Triadic** (three evenly spaced) → lively, playful
    - **Monochrome** (same hue, varied lightness) → minimal
- <u>step 3:</u> keep saturation & lightness in friendly ranges for dark backgrounds:
  - **Saturation:** ~70–90% (colors pop but don’t bleed)
  - **Lightness:** ~54–66% (bright enough on black, not neon)
  - Add tiny random ± tweaks so it feels **natural**, not generated
- <u>step 4:</u> convert to hex and use them in the grid, and that's it!

Here is the code that does exactly that:

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

You can view it in full page mode [here](code/pixels.html).
