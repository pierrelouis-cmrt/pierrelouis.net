// scripts/buildBookmarks.mjs
// -----------------------------------------------------------------------------
// Generate static HTML for /bookmarks/index.html from /bookmarks/bookmarks.json,
// skipping any bookmark dated in a FUTURE month (or year) relative to today.
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
const monthIndex = (m) => new Date(`${m} 1 2000`).getMonth();
const groupBy = (arr, key) =>
  arr.reduce((map, obj) => {
    (map[obj[key]] ||= []).push(obj);
    return map;
  }, {});
const videoExtensions = new Set([
  ".mp4",
  ".webm",
  ".ogg",
  ".ogv",
  ".mov",
  ".m4v",
]);
const isVideoPath = (src) => {
  if (!src) return false;
  const clean = src.split(/[?#]/)[0];
  const ext = path.extname(clean).toLowerCase();
  return videoExtensions.has(ext);
};

/* -------------------------------------------------------------------------- */
/*  Create markup for one bookmark item                                       */
/* -------------------------------------------------------------------------- */
function bookmarkItem(b) {
  const meta = b.meta
    ? `<div class="timeline-item-meta">
         <img src="${b.meta.icon}" width="16" height="16" alt="">
         <span>${b.meta.text}</span>
       </div>`
    : "";

  const description = b.description
    ? `<div class="timeline-item-description">${b.description}</div>`
    : "";

  const previewSrc = (b.image || "").trim();
  const previewMedia = previewSrc
    ? isVideoPath(previewSrc)
      ? `<video src="${previewSrc}" preload="metadata" playsinline controls aria-label="${b.title} preview"></video>`
      : `<img src="${previewSrc}" loading="lazy" alt="${b.title} preview">`
    : "";
  const preview = previewMedia
    ? `<div class="timeline-item-preview">
         <figure>
           ${previewMedia}
         </figure>
       </div>`
    : "";

  return `
    <div class="timeline-item animate-on-scroll" data-tag="${b.tag}">
      <a href="${b.link}" target="_blank" rel="noopener noreferrer">
        <div class="timeline-item-title">
          <span class="link-text">${b.title}</span>
          <span class="external-link-icon" aria-hidden="true">↗</span>
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
          const list = byMonth[month]; // no "day" in bookmarks
          return `
            <div class="content-timeline-month">
              <div class="content-timeline-month-header">
                <h3>${month}<span class="full-year"> ${year}</span></h3>
              </div>
              <div class="content-timeline-month-items">
                ${list.map(bookmarkItem).join("")}
              </div>
            </div>`;
        })
        .join("");

      return `
        <div class="content-timeline-header">
          <div class="content-timeline-year"><h2>${year}</h2></div>
          <div class="content-timeline-content">${monthsHtml}</div>
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
  const raw = await readFile(JSON_PATH, "utf8");
  const items = JSON.parse(raw);

  /* Filter out future months ---------------------------------------------- */
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-based

  const filtered = items.filter((b) => {
    if (b.year > currentYear) return false; // future year
    if (b.year < currentYear) return true; // past year
    return monthIndex(b.month) <= currentMonth; // same year, past or current month
  });

  /* Sort newest first: year, then month ----------------------------------- */
  filtered.sort(
    (a, b) => b.year - a.year || monthIndex(b.month) - monthIndex(a.month)
  );

  /* Render ---------------------------------------------------------------- */
  const htmlIn = await readFile(BOOKMARKS_HTML, "utf8");
  const htmlOut = replaceBlock(htmlIn, "BOOKMARKS", buildTimeline(filtered));
  await writeFile(BOOKMARKS_HTML, htmlOut);
  console.log("✔  bookmarks timeline updated");
})();
