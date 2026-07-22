# Posts page design QA

## Comparison target

- Source visual truth: `/Users/pierrelouis/.codex/attachments/ea902890-d8fa-4dbf-a57e-ac768f43e4e6/image-1.png`
- Normalized source: `output/playwright/posts-reference-1470.png`
- Browser-rendered implementation: `output/playwright/posts-1470-verified.png`
- Full-view comparison: `output/playwright/posts-comparison-final.png` (source left, implementation right)
- Focused footer comparison: `output/playwright/posts-footer-comparison.png` (source left, implementation right)
- Mobile evidence: `output/playwright/posts-mobile-390-final.png`
- Route: `http://127.0.0.1:8001/posts/`
- State: desktop, all posts visible, empty search, navigation menus closed

## Viewport and normalization

- Source pixels: 2940 × 2738 at 2× density.
- Source CSS target: 1470 × 1369.
- Implementation CSS viewport: 1470 × 1369, browser device pixel ratio 2.
- Implementation comparison pixels: 1470 × 1369 at 1× CSS-pixel density.
- The source was downsampled by exactly 50% with no crop. The browser implementation screenshot is composed at 1× from the in-app browser's top capture and scrolled footer capture; neither region was resized. The seam is the footer rule at y=1155.
- Responsive evidence viewport: 390 × 844 CSS px. Measured page width was 390 px with no horizontal overflow.

## Required fidelity surfaces

- Fonts and typography: passed. Both views use the locally hosted Sora variable family. Font sizes, regular/italic emphasis, weights, line heights, wrapping, labels, and tabular date rhythm match the source closely.
- Spacing and layout rhythm: passed. The intro, 895 px stepped ledger, 30 px row gaps, footer rule at y=1155, and watermark at y=1288 align with the normalized source. Mobile rows recompose cleanly rather than shrinking the desktop ledger. The featured-post internals intentionally follow the later user-directed mobile-menu treatment instead of the original image-first Paper treatment.
- Colors and visual tokens: passed. The page uses the existing white, ink, muted, caption, and subtle tokens from `base.css`; rule and secondary-copy contrast match the source.
- Image quality and asset fidelity: passed. The exact existing 250 × 180 Conway GIF is used inside the same 250:180 media ratio as the mobile menu. The comparison can show a different animation frame, which is expected. No image or icon placeholders were introduced.
- Copy and content: passed. All six visible source posts, descriptions, filter labels, intro copy, featured caption, and CTA labels match the export. The generated site header intentionally keeps the site's `More ↓` label, and the generated live footer intentionally keeps Lyon/current weather instead of the mock's static Saint-Etienne sample.

## Interaction and browser checks

- Post type filter: Articles showed exactly “Making things readable by design” and “Let It Sit”.
- Search: “density” showed exactly “Density vs quantity for our brain”.
- All six Read More controls are real links to temporary post routes.
- Shared desktop More menu opened, exposed its links, and closed with Escape.
- Shared mobile menu opened, marked Posts as the current page, and closed correctly.
- Photos still renders the promoted shared filter component with six options and no 390 px overflow.
- Browser console warnings/errors: none.
- Production build, JavaScript syntax checks, and `git diff --check`: passed.

## Comparison history

### Pass 1

- [P2] The desktop ledger began 5 px too far right and 5 px too high.
- [P2] The featured animation/caption block sat 24 px too low and 6 px too far right.
- [P2] The footer rule and labels sat 26 px too low while the watermark itself already aligned.
- [P2] The promoted shared search treatment extended the document to 454 px at a 390 px viewport.

Fixes applied:

- Shifted the ledger to the source x/y coordinates without changing its 895 px width.
- Repositioned the featured block independently from the ledger.
- Increased the desktop footer's internal watermark gap so the footer rule and labels moved up while the watermark remained at y=1288.
- Constrained the shared search field to 100% at compact widths, fixing Posts and Photos together.

### Pass 2

- Post-fix full-view and footer comparisons show no remaining actionable P0/P1/P2 mismatch.
- Desktop footer measured y=1155.4 with a 213.6 px height; watermark measured y=1288 with an 81 px height.
- Mobile document width measured exactly 390 px at a 390 px viewport.

### Post-handoff feature refinement

- The user requested that the Conway article match its mobile-menu presentation.
- Posts now shares the mobile-menu sequence and rules: 16 px/19.2 px title, 15 px title-to-media spacing, 250:180 contained media, 15 px media-to-CTA spacing, and “See More ↗”.
- Browser-computed typography, ratios, spacing, hover, and focus styles match between both instances. Their rendered widths remain context-responsive: 200 px on Posts and 163 px in the narrower mobile-menu grid column.

## Findings

No actionable P0, P1, or P2 findings remain.

## Open questions

None.

## Implementation checklist

- [x] Shared generated header/footer and active Posts state
- [x] Shared reusable filter styling in `base.css`
- [x] Functional post type and text filters
- [x] Real temporary article links
- [x] Exact supplied featured animation
- [x] Desktop visual fidelity and responsive layout
- [x] Browser interaction, overflow, console, and build verification

## Follow-up polish

No blocking polish remains. The animated GIF frame, live footer weather, and user-directed mobile-menu treatment for the Conway feature will naturally differ from the original static reference capture.

final result: passed
