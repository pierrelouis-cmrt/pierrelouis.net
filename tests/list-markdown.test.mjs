import assert from "node:assert/strict";
import test from "node:test";
import { renderListMarkdown } from "../scripts/lib/list-markdown.mjs";

test("renders mixed Obsidian content and counts only top-level bullet entries", () => {
  const html = renderListMarkdown(`---
title: Example
---

An introductory paragraph.

- First
  - Nested detail
- Second

%% hidden note %%
`);

  assert.match(html, /<p>An introductory paragraph\.<\/p>/);
  assert.match(html, /<ul class="list-sheet__entry-list">/);
  assert.equal(html.match(/data-list-entry=""/g)?.length, 2);
  assert.doesNotMatch(html, /title: Example|hidden note/);
});

test("allows a sheet source to be empty", () => {
  assert.equal(renderListMarkdown(""), "");
});

test("uses the shared external-link class for web links only", () => {
  const html = renderListMarkdown(`
- [External](https://example.com)
- [Internal](/about/)
`);

  assert.match(
    html,
    /href="https:\/\/example\.com" class="external-link" target="_blank" rel="noopener noreferrer"/,
  );
  assert.match(html, /href="\/about\/"/);
  assert.doesNotMatch(html, /href="\/about\/" class="external-link"/);
});
