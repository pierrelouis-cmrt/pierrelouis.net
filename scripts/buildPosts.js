// scripts/buildPosts.js
// -----------------------------------------------------------------------------
// Generate static HTML for the full timeline (posts/index.html) and for the
// "latest 3 posts" block (index.html).  Idempotent: each run fully replaces
// the previous generated content between the START/END markers.
// Items dated after TODAY are ignored.
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
  Experiments: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2" 
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/>
      <path d="M6.453 15h11.094"/>
      <path d="M8.5 2h7"/>
    </svg>`,
};

const EXTERNAL_LINK_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg"
       viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-right">
    <path d="M7 7h10v10"></path>
    <path d="M7 17 17 7"></path>
  </svg>`;

/* -------------------------------------------------------------------------- */
/*  Helper functions                                                          */
/* -------------------------------------------------------------------------- */
const monthAbbr = (m) => m.slice(0, 3);
const monthIndex = (m) => new Date(`${m} 1 2000`).getMonth();
const slugify = (t) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

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
    ? `<div class="timeline-item-description">${p.description}</div>`
    : "";

  const preview = p.image
    ? `<div class="timeline-item-preview">
         <figure>
           <img src="${p.image}" loading="lazy" alt="${p.title} preview">
         </figure>
       </div>`
    : "";

  return `
    <div class="timeline-item animate-on-scroll" data-tag="${p.tag}">
      <a href="${p.link}" rel="noopener noreferrer">
        <div class="timeline-item-title">
          ${SVG_ICONS[p.tag] || ""}
          <span class="link-text">${p.title}</span>
          <span class="external-link-icon" aria-hidden="true">${EXTERNAL_LINK_SVG}</span>
        </div>
        ${description}
        ${preview}
      </a>
    </div>`;
}

/* Homepage "latest 3" uses homepage post card classes */
function latestItem(p) {
  return `
    <div class="post-card">
      <a class="link-with-icon post-card-link" href="${
        p.link
      }" rel="noopener noreferrer">
        <div class="post-card-title">
          ${SVG_ICONS[p.tag] || ""}
          <span class="link-text">${p.title}</span>
        </div>
        <div class="post-card-separator"></div>
        <div class="post-card-date">${monthAbbr(p.month)} ${p.year}</div>
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
            <div class="content-timeline-month">
              <div class="content-timeline-month-header">
                <h3>${month}<span class="full-year"> ${year}</span></h3>
              </div>
              <div class="content-timeline-month-items">
                ${list.map(timelineItem).join("")}
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
  /* 1. Load JSON ----------------------------------------------------------- */
  const raw = await readFile(JSON_PATH, "utf8");
  const items = JSON.parse(raw);

  // Route links by tag → directory
  const DIR_BY_TAG = {
    Notes: "notes",
    Articles: "articles",
    Experiments: "experiments",
  };

  for (const p of items) {
    const dir = DIR_BY_TAG[p.tag] || "articles";
    p.link = `/posts/${dir}/${slugify(p.title)}.html`;
  }

  /* 2. Filter out future-dated posts -------------------------------------- */
  const today = new Date();
  const isPastOrToday = (p) => {
    const date = new Date(`${p.month} ${p.day} ${p.year}`);
    return !Number.isNaN(date) && date <= today;
  };

  const filtered = items.filter(isPastOrToday);

  /* 3. Sort newest first (year, month, day) ------------------------------- */
  filtered.sort(
    (a, b) =>
      b.year - a.year ||
      monthIndex(b.month) - monthIndex(a.month) ||
      b.day - a.day
  );

  /* 4. Render pages -------------------------------------------------------- */

  // /posts/index.html
  {
    const htmlIn = await readFile(POSTS_HTML, "utf8");
    const htmlOut = replaceBlock(htmlIn, "TIMELINE", buildTimeline(filtered));
    await writeFile(POSTS_HTML, htmlOut);
    console.log("✔  timeline updated in posts/index.html");
  }

  // /index.html (home)
  {
    const latest3 = filtered.slice(0, 3).map(latestItem).join("");
    const htmlIn = await readFile(HOME_HTML, "utf8");
    const htmlOut = replaceBlock(htmlIn, "LATEST", latest3);
    await writeFile(HOME_HTML, htmlOut);
    console.log("✔  latest 3 posts injected into index.html");
  }
})();
