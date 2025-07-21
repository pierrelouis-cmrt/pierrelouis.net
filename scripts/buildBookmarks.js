// scripts/buildBookmarks.js
// -----------------------------------------------------------------------------
// Generate static HTML for /bookmarks/index.html from /bookmarks/bookmarks.json
// Idempotent: every run fully replaces the previous AUTO-GEN block.
// -----------------------------------------------------------------------------

import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

/* -------------------------------------------------------------------------- */
/*  Locate repo folders                                                       */
/* -------------------------------------------------------------------------- */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const JSON_PATH = path.join(root, "bookmarks", "bookmarks.json");
const BOOKMARKS_HTML = path.join(root, "bookmarks", "index.html");

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */
const monthAbbr = (m) => m.slice(0, 3);

const groupBy = (arr, key) =>
  arr.reduce((map, obj) => {
    (map[obj[key]] ||= []).push(obj);
    return map;
  }, {});

/* -------------------------------------------------------------------------- */
/*  Create markup for one bookmark item                                       */
/* -------------------------------------------------------------------------- */
function bookmarkItem(b) {
  const meta = b.meta
    ? `<div class="post-meta">
         <img src="${b.meta.icon}" width="16" height="16" alt="">
         <span>${b.meta.text}</span>
       </div>`
    : "";

  const description = b.description
    ? `<div class="post-description">${b.description}</div>`
    : "";

  const preview = b.image
    ? `<div class="post-preview">
         <figure>
           <img src="${b.image}" loading="lazy" alt="${b.title} preview">
         </figure>
       </div>`
    : "";

  return `
    <div class="post-item" data-tag="${b.tag}">
      <a href="${b.link}" target="_blank" rel="noopener noreferrer">
        <div class="post-title">
          <span class="link-text">${b.title}</span>
          <span class="external-icon" aria-hidden="true">↗</span>
        </div>
        ${meta}
        ${description}
        ${preview}
      </a>
    </div>`;
}

/* -------------------------------------------------------------------------- */
/*  Build the full timeline (year → month)                                    */
/* -------------------------------------------------------------------------- */
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
          const list = byMonth[month]; // no day field in original script
          return `
            <div class="timeline-month">
              <div class="month-header">
                <h3>${month}<span class="full-year"> ${year}</span></h3>
              </div>
              <div class="month-items">
                ${list.map(bookmarkItem).join("")}
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
/*  Utility: replace AUTO-GEN block                                           */
/* -------------------------------------------------------------------------- */
function replaceBlock(html, tag, content) {
  const start = `<!-- AUTO-GEN:${tag} START -->`;
  const end = `<!-- AUTO-GEN:${tag} END -->`;
  const block = new RegExp(`${start}[\\s\\S]*?${end}`);
  const replacement = `${start}\n${content}\n${end}`;

  return block.test(html)
    ? html.replace(block, replacement)
    : html.replace(start, replacement); // first run when END marker absent
}

/* -------------------------------------------------------------------------- */
/*  Main                                                                      */
/* -------------------------------------------------------------------------- */
(async () => {
  const items = JSON.parse(await readFile(JSON_PATH, "utf8"));

  // Sort newest first: year, then month (no day field in original code)
  items.sort(
    (a, b) =>
      b.year - a.year ||
      new Date(`${b.month} 1 2000`) - new Date(`${a.month} 1 2000`)
  );

  /* Update bookmarks/index.html ------------------------------------------- */
  const htmlIn = await readFile(BOOKMARKS_HTML, "utf8");
  const htmlOut = replaceBlock(htmlIn, "BOOKMARKS", buildTimeline(items));
  await writeFile(BOOKMARKS_HTML, htmlOut);
  console.log("✔  bookmarks timeline updated");
})();
