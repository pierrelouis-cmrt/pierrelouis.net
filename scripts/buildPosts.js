// scripts/buildPosts.js
// -----------------------------------------------------------------------------
// Generate static HTML for the full timeline (posts/index.html) and for the
// “latest 3 posts” block (index.html).  Idempotent: each run fully replaces
// the previous generated content between the START/END markers.
// -----------------------------------------------------------------------------
//
// Prerequisites: Node ≥ 18 (for native ESM and fs/promises)
//
// Usage:  node scripts/buildPosts.js
// (It is already wired into `npm run build` in package.json)
//
// -----------------------------------------------------------------------------

import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

/* -------------------------------------------------------------------------- */
/*  Paths                                                                     */
/* -------------------------------------------------------------------------- */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const JSON_PATH = path.join(root, "posts", "posts.json");
const POSTS_HTML = path.join(root, "posts", "index.html");
const HOME_HTML = path.join(root, "index.html");

/* -------------------------------------------------------------------------- */
/*  SVG icons (same markup you used on the client)                            */
/* -------------------------------------------------------------------------- */
const SVG_ICONS = {
  Notes: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/>
      <path d="M15 3v4a2 2 0 0 0 2 2h4"/>
    </svg>`,
  Articles: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
      <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
      <path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>
    </svg>`,
};

/* -------------------------------------------------------------------------- */
/*  Helper functions                                                          */
/* -------------------------------------------------------------------------- */
const monthAbbr = (m) => m.slice(0, 3);

const groupBy = (arr, key) =>
  arr.reduce((map, obj) => {
    (map[obj[key]] ||= []).push(obj);
    return map;
  }, {});

/* -------------------------------------------------------------------------- */
/*  Markup factory functions (two layouts)                                    */
/* -------------------------------------------------------------------------- */
function timelineItem(p) {
  const description = p.description
    ? `<div class="post-description">${p.description}</div>`
    : "";

  const preview = p.image
    ? `<div class="post-preview">
         <figure>
           <img src="${p.image}" loading="lazy" alt="${p.title} preview">
         </figure>
       </div>`
    : "";

  return `
    <div class="post-item" data-tag="${p.tag}">
      <a href="${p.link}" target="_blank" rel="noopener noreferrer">
        <div class="post-title">
          ${SVG_ICONS[p.tag] || ""}
          <span class="link-text">${p.title}</span>
          <span class="external-icon" aria-hidden="true">↗</span>
        </div>
        ${description}
        ${preview}
      </a>
    </div>`;
}

function latestItem(p) {
  return `
    <div class="post__item">
      <a class="inline-icon post__link" href="${
        p.link
      }" target="_blank" rel="noopener noreferrer">
        <div class="post-title">
          ${SVG_ICONS[p.tag] || ""}
          <span class="link-text">${p.title}</span>
          <span class="external-icon" aria-hidden="true">↗</span>
        </div>
        <div class="post__separator"></div>
        <div class="post__date">${monthAbbr(p.month)} ${p.year}</div>
      </a>
    </div>`;
}

function buildTimeline(items) {
  const byYear = groupBy(items, "year");

  return Object.keys(byYear)
    .sort((a, b) => b - a) // newest year first
    .map((year) => {
      const yearBlock = byYear[year];
      const byMonth = groupBy(yearBlock, "month");

      const monthsHtml = Object.keys(byMonth)
        .sort((a, b) => new Date(`${b} 1 2000`) - new Date(`${a} 1 2000`))
        .map((month) => {
          const list = byMonth[month].sort((x, y) => y.day - x.day);
          return `
            <div class="timeline-month">
              <div class="month-header">
                <h3>${month}<span class="full-year"> ${year}</span></h3>
              </div>
              <div class="month-items">
                ${list.map(timelineItem).join("")}
              </div>
            </div>`;
        })
        .join("");

      return `
        <div class="timeline-header">
          <div class="timeline-year"><h2>${year}</h2></div>
          <div class="timeline-content">${monthsHtml}</div>
        </div>`;
    })
    .join("");
}

/* -------------------------------------------------------------------------- */
/*  Utility: replace an AUTO-GEN block safely                                 */
/* -------------------------------------------------------------------------- */
function replaceBlock(html, tag, content) {
  const start = `<!-- AUTO-GEN:${tag} START -->`;
  const end = `<!-- AUTO-GEN:${tag} END -->`;

  const blockReg = new RegExp(`${start}[\\s\\S]*?${end}`);
  const replacement = `${start}\n${content}\n${end}`;

  return blockReg.test(html)
    ? html.replace(blockReg, replacement)
    : html.replace(start, replacement); // first run, when END isn't present yet
}

/* -------------------------------------------------------------------------- */
/*  Main build process                                                        */
/* -------------------------------------------------------------------------- */
(async () => {
  /* 1. Load & sort JSON ----------------------------------------------------- */
  const items = JSON.parse(await readFile(JSON_PATH, "utf8"));

  // Global newest-first sort (year, month, day)
  items.sort(
    (a, b) =>
      b.year - a.year ||
      new Date(`${b.month} 1 2000`) - new Date(`${a.month} 1 2000`) ||
      b.day - a.day
  );

  /* 2. Update /posts/index.html -------------------------------------------- */
  {
    const htmlIn = await readFile(POSTS_HTML, "utf8");
    const htmlOut = replaceBlock(htmlIn, "TIMELINE", buildTimeline(items));
    await writeFile(POSTS_HTML, htmlOut);
    console.log("✔  timeline updated in posts/index.html");
  }

  /* 3. Update /index.html --------------------------------------------------- */
  {
    const latest3 = items.slice(0, 3).map(latestItem).join("");
    const htmlIn = await readFile(HOME_HTML, "utf8");
    const htmlOut = replaceBlock(htmlIn, "LATEST", latest3);
    await writeFile(HOME_HTML, htmlOut);
    console.log("✔  latest 3 posts injected into index.html");
  }
})();
