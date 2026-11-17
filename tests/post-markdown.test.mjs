import assert from "node:assert/strict";
import test from "node:test";
import { createPostMarkdown } from "../scripts/lib/post-markdown.mjs";

const render = (source) => createPostMarkdown({
  manifest: { byWikiName: new Map() },
}).render(source);

test("Obsidian heading links resolve to the generated HTML heading IDs", () => {
  const html = render(`[here](#Applications) and [[#Applications|here too]].

[Details](#Caf%C3%A9%20and%20design) and [already slugged](#cafe-and-design).

## Applications

## Café and design
`);
  assert.match(html, /<h2 id="applications">Applications<\/h2>/);
  assert.match(html, /href="#applications" class="internal-link">here<\/a>/);
  assert.match(html, /href="#applications" class="internal-link">here too<\/a>/);
  assert.match(html, /<h2 id="cafe-and-design">/);
  assert.equal((html.match(/href="#cafe-and-design"/g) || []).length, 2);
});

test("preserves custom fragments, duplicate heading IDs, and footnote links", () => {
  const html = render(`[Custom](#CustomAnchor) [Second](#applications-2) [Footnote](#footnote-1).

<span id="CustomAnchor"></span>

## Applications

## Applications

Text.[^1]

[^1]: Reference.
`);
  assert.match(html, /href="#CustomAnchor"/);
  assert.match(html, /href="#applications-2"/);
  assert.match(html, /<h2 id="applications-2">/);
  assert.match(html, /href="#footnote-1"/);
  assert.match(html, /id="footnote-1"/);
});

for (const lineBreak of ["\n", "  \n", "\\\n"]) {
  test(`detects adjacent plain captions with ${JSON.stringify(lineBreak)}`, () => {
    const html = render(`![Alternative text](image.webp)${lineBreak}A **bold** caption.\n\nBody text.`);
    assert.match(html, /<figure class="post-media">/);
    assert.match(html, /<figcaption class="post-caption"><span>A <strong>bold<\/strong> caption\.<\/span>/);
    assert.match(html, /alt="Alternative text"/);
    assert.match(html, /<p>Body text\.<\/p>/);
  });
}

test("preserves Lissajous-style captions, math, links, and footnotes", () => {
  const html = render(`![Curves](curves.webp)
*Figure 1. Ratio $1:2$. [Source](https://example.com)[^1]*

*An italic body paragraph.*

[^1]: Reference.
`);
  assert.match(html, /<figcaption class="post-caption"><span><em>Figure 1\./);
  assert.match(html, /class="katex"/);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /href="#footnote-1"/);
  assert.match(html, /<p><em>An italic body paragraph\.<\/em><\/p>/);
});

test("a blank line keeps italic prose separate from an uncaptioned image", () => {
  const html = render("![Image](image.webp)\n\n*Article prose.*");
  assert.doesNotMatch(html, /<figcaption/);
  assert.match(html, /<p><em>Article prose\.<\/em><\/p>/);
});

test("does not treat another adjacent image as a caption", () => {
  const html = render("![First](first.webp)\n![Second](second.webp)");
  assert.doesNotMatch(html, /<figcaption/);
  assert.equal((html.match(/<img /g) || []).length, 2);
});

test("supports Obsidian embeds and numbers figures independently", () => {
  const html = render("![[first.webp|First]]\nFirst caption.\n\n![Second](second.webp)\nSecond caption.");
  assert.equal((html.match(/<figcaption /g) || []).length, 2);
  assert.match(html, /Figure \/ 01/);
  assert.match(html, /Figure \/ 02/);
});
