---
title: "Example Post: Every Supported Article Element"
description: "A copyable Obsidian article demonstrating the complete publishing dialect."
date: 2026-07-29
slug: example-post
type: article
tags:
  - design
  - mathematics
  - code
lang: en
toc: auto

hero-image: assets/example-hero.webp
hero-alt: "A precise description of the opening image."
hero-caption: "A short opening-image caption."
---

This introductory paragraph supports **bold**, *italic*, ~~strikethrough~~,
`inline code`, ==Obsidian highlights==, [external links](https://example.com),
and [[Another Published Post|Obsidian wikilinks]]. %%This author note is hidden.%%

## Headings and text

The template supplies the H1. This is an H2 and appears in the TOC.

### H3 subsection

#### H4 subsection

##### H5 subsection

###### H6 subsection

> A standard blockquote is styled as an editorial pull quote.

> [!tip] Obsidian callout
> A callout can contain **inline formatting** and a [link](https://example.com).

> [!warning]- Foldable warning
> The minus marker makes this callout collapsed by default.

- Unordered list
- Second item
  - Nested item

1. Ordered item
2. Another item

- [x] Completed task
- [ ] Open task

| Element | Build behavior |
| --- | --- |
| Markdown | Rendered by Eleventy |
| Math | Rendered by KaTeX |
| Code | Highlighted at build time |

---

## Images

![Alternative text describing the image](assets/example-portrait.webp)

*A fully italic paragraph immediately after an image becomes its caption.[^1]*

![[assets/example-uncaptioned.webp|Obsidian image embed alt text]]

## Mathematics

Inline math uses $f_x / f_y = n_x / n_y$ inside a sentence.

$$
\begin{cases}
X = A_x \cos(2\pi f_x t + \phi_x) \\
Y = A_y \cos(2\pi f_y t + \phi_y)
\end{cases}
$$

## Code

This Python block opts into copying:

```python copy
import numpy as np

t = np.linspace(0, 1, 10_000)
x = np.cos(2 * np.pi * 5 * t)
```

This plain-text block has no syntax highlighting or copy control:

```text
Use text or plaintext for literal output.
```

## Interactive content

An independent full-viewport application may use an iframe when its files are
actually present in the synchronized folder:

```html
<iframe
  class="article-embed"
  src="apps/independent-lab/index.html"
  title="Independent interactive lab"
  loading="lazy"
></iframe>
```

For a heavy application, prefer a poster and link:

[![Poster for the full application](assets/example-app-poster.webp)](https://example.com/full-app)

[^1]: Footnotes use standard Markdown and move into article endmatter.

## Sources

- [Example primary source](https://example.com/primary)
- [Example reference](https://example.com/reference)
