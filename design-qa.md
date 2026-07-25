# Projects page design QA

## Comparison target

- Source visual truth: `/Users/pierrelouis/.codex/attachments/47b845e2-7197-4efb-98ea-668989a0cc04/image-1.png`
- Normalized source: `output/projects-reference-1470.jpg`
- Browser-rendered implementation: `output/projects-page-1470-stitched.jpg`
- Full-view comparison: `output/projects-comparison.jpg` (source left, implementation right)
- Tablet evidence: `output/projects-tablet-1024.jpg`
- Mobile evidence: `output/projects-mobile-390.jpg`
- Refined desktop evidence: `output/projects-desktop-refinements.jpg`
- Responsive carousel evidence: `output/projects-carousel-1024.jpg`, `output/projects-carousel-390-controls.jpg`
- Persistent footer evidence: `output/projects-carousel-footer-1024.jpg`, `output/projects-carousel-footer-600.jpg`, `output/projects-carousel-footer-390.jpg`
- Earlier focused desktop comparison: `output/projects-carousel-footer-comparison.jpg` (source left, implementation right)
- First-line alignment evidence: `output/projects-carousel-aligned-1024.jpg`, `output/projects-carousel-aligned-390.jpg`
- Latest focused desktop comparison: `output/projects-carousel-aligned-comparison.jpg` (source left, implementation right)
- Route: `http://127.0.0.1:8001/projects/`
- State: Projects route, desktop navigation closed, all featured and Playground content present

## Viewport and normalization

- Source pixels: 2940 × 7528 at 2× density.
- Source CSS target: 1470 × 3764.
- Implementation CSS viewport: 1470 × 900; rendered document height: 3644 CSS px.
- Implementation comparison pixels: 1470 × 3644 at 1× CSS-pixel density.
- The source was downsampled by exactly 50% with no crop. The implementation was assembled from five unscaled in-app-browser viewport captures at scroll positions 0, 900, 1800, 2700, and 2744. The implementation was not resized.
- Responsive evidence viewports: 1024 × 900, 600 × 900, 520 × 900, and 390 × 844 CSS px.
- The latest focused comparison uses equal 1470 × 900 crops at CSS-pixel density: normalized source rows 350–1250 and a browser capture at `scrollY = 350`.

## Required fidelity surfaces

- Fonts and typography: passed. The implementation uses the site's locally hosted Sora variable fonts, existing 12/15/16 px type scale, italic active/label treatments, and current line-height and tracking tokens. The reference hierarchy is preserved without importing Paper's hardcoded font declarations.
- Spacing and layout rhythm: passed. Desktop uses the existing 25 px gutter, 10 px gap, and four-column grid. Featured media height is derived from the homepage's 4:5 project-card height, as requested, rather than Paper's taller hardcoded media. At 1100 px and below, each three-image project remains a single, non-wrapping horizontal track with centered scroll snapping and a persistent next-slide cue. The metadata/footer uses an exact `1fr auto 1fr` layout so navigation stays centered in the viewport while the CTA remains on the right edge. Playground's first card row begins exactly 10 px below its separator/header, matching Photos.
- Colors and visual tokens: passed. White, ink, caption, subtle copy, divider, and media backgrounds use the existing `base.css` tokens. No new decorative color system, shadows, radii, or card surfaces were introduced.
- Image quality and asset fidelity: passed. All nine featured and six Playground Paper assets are stored locally and rendered at their intended subjects, proportions, and crops. Animated GIFs remain animated. No placeholder, CSS drawing, custom SVG, or generated approximation replaces a supplied asset.
- Copy and content: passed. Paper's illustrative titles, descriptions, categories, Playground copy, and count are preserved. The case-study label remains “See Case Study” where room permits and becomes “See More” only in the compact footer state. The live site intentionally keeps its generated `More ↓` navigation and Lyon/weather footer instead of Paper's stale header/footer copy.

## Full-view and focused comparison evidence

- The original-resolution side-by-side comparison confirms the same intro split, three 1/2/1-column featured compositions, title/meta placement, right-aligned case-study links, Playground separator/header, and supplied image sequence.
- The featured rows intentionally render slightly shorter than Paper because the brief explicitly requires the homepage's media-height ceiling.
- Playground intentionally uses four columns instead of Paper's three-column draft. Image heights remain natural, with the same homepage-derived maximum.
- The latest 2940 × 900 focused comparison confirms that moving metadata and the CTA out of the scroll track preserves the desktop source composition: identity remains under the left image, CTA remains under the right image, and no extra carousel chrome is visible.
- Responsive footer details are covered by dedicated browser captures because the source mockup provides only a desktop state.

## Interaction, accessibility, and browser checks

- Shared desktop and mobile navigation render the Projects active state.
- The mobile menu opens, changes the toggle to “Close menu,” locks body scroll, exposes all navigation groups, and keeps Projects marked as the current page.
- Three visible case-study controls are semantic internal links. Their default computed text decoration is `none`, they use the Posts-style right arrow, and the subtle underline appears only on hover/focus.
- At 1470 px, all three images in every featured project have an identical top coordinate and remain fully visible; carousel controls are hidden.
- At 1024 px, every footer keeps identity at the 25 px page gutter, previous/status/next controls exactly centered at x=512, and the full CTA 25 px from the right edge. “Swipe / scroll” is absent.
- The Hotel Wren track begins with 38 px of the next image visible. Its centered snap targets are 0, 690, and 936 px.
- At the 936 px end stop, both final one-column images are fully visible and the counter correctly reads `3 / 3`; the next button is disabled. Previous returns to the distinct 690 px stop and `2 / 3`.
- At 600 px, the CTA becomes “See More →”, carousel controls are hidden, and 38 px of the next slide remains visible.
- In the latest one-column state, the entire arrow/status group is hidden. The mobile rail gap remains 10 px instead of the global 24 px one-column grid gap.
- Image-to-title spacing is exactly 12 px at 1470, 1024, and 390 px, matching the measured 12 px Playground caption gap.
- At 1024 px, title, previous arrow, status, next arrow, and CTA all begin at the same y-coordinate. At 390 px, the title and CTA share the same first-line y-coordinate.
- Playground card title and meta computed styles exactly match Home: 16/16 px and `rgb(71, 71, 71)` for titles; 15/15 px, 6 px top gap, and `rgb(127, 127, 127)` for metadata. The cards reuse Home's `.media-card` hover rules (`scale(1.025)` image and caption opacity token).
- All images have dimensions and alternative text; below-the-fold Playground assets use lazy loading and async decoding.
- No horizontal overflow at 1470, 1024, or 390 px.
- Browser console warnings/errors: none.
- Production build and `git diff --check`: passed.

## Comparison history

### Pass 1

- [P2] Hotel Wren's animated website was scaled with `object-fit: contain`, leaving substantially wider black side margins and a smaller focal image than the Paper reference.

Fix applied:

- Reframed the animation inside the existing media slot at 88% width and 169% height with vertical cropping, matching Paper's inset black frame while preserving the homepage-derived outer height.

### Pass 2

- The post-fix side-by-side comparison shows the Hotel Wren frame, crop, and scale aligned with the source intent.
- No actionable P0, P1, or P2 findings remain.

### Pass 3

- Removed the default case-study underline and replaced the diagonal arrow with the same right arrow used by Posts.
- Reworked the 1100 px-and-below featured layout into a single-row, touch-friendly horizontal carousel while keeping desktop fixed and fully visible.
- Added an explicit swipe/scroll affordance, live slide count, keyboard support, and accessible previous/next buttons.
- Matched Playground's separator-to-cards gap to Photos and its card typography, caption spacing, and hover behavior to Home.
- Browser checks at 1470 × 900, 1024 × 900, and 390 × 844 confirm the intended layout and interaction with no new findings.

### Pass 4

- Removed the textual swipe hint and consolidated project identity, carousel navigation, and the case-study CTA into one persistent footer outside the horizontal track.
- Added two progressive compact states: “See More” at 640 px and below, then hidden navigation/numbering at 540 px and below.
- Changed item snap alignment and active-index calculation to clamped, centered stop positions. This produces three distinct logical states even when the final two one-column images fit together.
- The focused desktop comparison confirms no desktop composition regression. Browser evidence at 1024, 600, 520, and 390 px confirms persistent right-edge CTA placement, centered navigation where visible, next-image cues, accurate end counting, and no overflow.
- No actionable P0, P1, or P2 findings remain.

### Pass 5

- [P2] The carousel rail's 10 px bottom padding plus vertically centered footer content made the featured image-to-title gap visibly larger than Playground and placed the CTA/status below the title line.
- [P2] The site's one-column `--grid-gap` expansion increased the mobile carousel gap from 10 px to 24 px, and the narrowest breakpoint hid the entire navigation rather than only the number.

Fix applied:

- Removed the rail bottom padding, aligned footer cells and their visible glyphs to the first title line, and let the footer height follow the same title/meta stack used by Playground.
- Scoped the one-column carousel gap to 10 px, restored both arrows at all carousel widths, and hides only `.featured-project__carousel-status` in the one-column layout.

Post-fix evidence:

- Browser measurements confirm a 12 px featured image-to-title gap and a 12 px Playground image-to-title gap at both 1024 and 390 px.
- All first-line controls share the title's top coordinate; mobile shows functional previous/next arrows with no visible number.
- The updated 2940 × 900 side-by-side desktop comparison shows the tighter caption placement without composition drift. Tablet and mobile captures confirm the responsive states.
- No actionable P0, P1, or P2 findings remain.

### Pass 6

- Follow-up direction hides the complete carousel navigation group at the one-column breakpoint while preserving swipe, scroll snapping, the next-slide cue, and the 10 px slide gap.
- Production build and diff validation pass.

## Findings

No actionable P0, P1, or P2 findings remain.

## Open questions

None. The case-study destinations are intentionally provisional internal routes because the supplied project content is illustrative.

## Implementation checklist

- [x] Shared generated header/footer and active Projects state
- [x] Existing four/two/one-column site grid
- [x] Three featured projects with three supplied assets each
- [x] Homepage-derived featured media height
- [x] Three semantic internal case-study links
- [x] Desktop-fixed and responsive touch carousel behavior
- [x] Persistent identity/navigation/CTA footer outside the scroll track
- [x] Progressive full and short CTA states
- [x] Next-image visual cue, accessible controls, accurate live count, and keyboard support
- [x] First-line title/control/CTA alignment at every layout width
- [x] Playground-matched 12 px image-to-caption spacing
- [x] Hidden mobile carousel controls and 10 px mobile carousel gap
- [x] Photo-catalog-style Playground divider/header
- [x] Home-matched Playground typography and hover behavior
- [x] Six natural-height Playground cards in four columns
- [x] Desktop, tablet, mobile, interaction, overflow, console, and build verification

## Follow-up polish

The static comparison may show a different frame for the two supplied GIFs. Live footer weather and the site-owned `More ↓` label intentionally differ from the Paper export.

final result: passed
