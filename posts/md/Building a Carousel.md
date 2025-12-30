---
title: Building a Carousel
description: Tips & tricks behind my custom carousel
tags:
  - experiment
date: 2025-12-29
---
Swiper (the js library) does most of the heavy lifting for carousels. Loop it, center it, add some breakpoints, and bam, it's done!. But the default pagination always felt static to me. A row of dots that just... sits there.

So I built one that moves.

## The Sliding Window

Instead of showing all dots at once, there's a 120px viewport that only reveals a handful. When you've got many images in a carousel, showing all dots can be pretty overwhelming. While swiping, the entire dot container translates to keep the active one centered:

```js
const offset = viewportCenter - activeIndex * dotSpacing - 4;
dotsContainer.style.transform = `translateX(${offset}px)`;
```

That `-4` nudges things to account for the dot's own width. Simple math, but it feels more interactive.

## Edge Fade

Dots near the viewport edges get a `.edge` class—they shrink and fade out. It's a small thing, but it sells the illusion that the dots extend infinitely in both directions.

```js
if (dotPosition < fadeZone || dotPosition > viewportWidth - fadeZone) {
  dot.classList.add("edge");
}
```

## The Full-Bleed Trick

My carousel lived inside a centered 600px column, but I wanted it to bleed: go full-width and touch both edges of the screen. Setting a width of 100vw (100% of the viewport's width) gives it the right size, but it still starts where the column starts, so it overflows on the right side instead of expanding evenly.

The carousel breaks out of its container using the negative margin hack:
<iframe src="code/bleed-trick.html" class="article-embed bleed-embed" loading="lazy"></iframe>
Old school? Yes, definitely. But it still works, and is still very useful.

## Demo of the carousel

<iframe src="code/now-carousel.html" class="article-embed carousel-embed" loading="lazy"></iframe>

[Open fullscreen](code/now-carousel.html)

---

The whole thing is like 80 lines of JS. Sometimes the fun parts are the small details you add on top of a library, not the library itself. That's what makes your creating more personnal and original.