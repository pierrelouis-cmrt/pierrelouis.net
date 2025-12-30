// scripts/buildPosts.mjs
// -----------------------------------------------------------------------------
// Generate static HTML for the full timeline (posts/index.html) and for the
// "latest 3 posts" block (index.html).  Idempotent: each run fully replaces
// the previous generated content between the START/END markers.
// Items dated after TODAY are ignored.
// -----------------------------------------------------------------------------

import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  copyFile,
  unlink,
} from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { buildPostPages } from "./buildMdPages.mjs";
import { loadPosts, resolveSourceDir } from "./postsData.mjs";

/* -------------------------------------------------------------------------- */
/*  Paths                                                                     */
/* -------------------------------------------------------------------------- */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const POSTS_MD_DIR = path.join(root, "posts", "md");
const POSTS_HTML = path.join(root, "posts", "index.html");
const HOME_HTML = path.join(root, "index.html");

const outArgIndex = process.argv.indexOf("--out");
const outRoot =
  outArgIndex !== -1 && process.argv[outArgIndex + 1]
    ? path.resolve(root, process.argv[outArgIndex + 1])
    : root;

const POSTS_HTML_OUT = path.join(outRoot, "posts", "index.html");
const HOME_HTML_OUT = path.join(outRoot, "index.html");

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

const groupBy = (arr, key) =>
  arr.reduce((map, obj) => {
    (map[obj[key]] ||= []).push(obj);
    return map;
  }, {});

async function syncMarkdown(sourceDir, destDir) {
  const resolvedSource = path.resolve(sourceDir);
  const resolvedDest = path.resolve(destDir);

  if (resolvedSource === resolvedDest) {
    console.log("INFO: posts source already in posts/md, skipping copy");
    return { copied: 0, total: 0, extras: [] };
  }

  await mkdir(destDir, { recursive: true });

  const entries = await readdir(sourceDir, { withFileTypes: true });
  const mdFiles = entries.filter(
    (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md")
  );

  const sourceNames = new Set(mdFiles.map((entry) => entry.name));
  let copied = 0;

  if (!mdFiles.length) {
    console.warn(`WARN: no markdown files found in "${sourceDir}"`);
  }

  for (const entry of mdFiles) {
    const src = path.join(sourceDir, entry.name);
    const dest = path.join(destDir, entry.name);
    await copyFile(src, dest);
    copied += 1;
  }

  const destEntries = await readdir(destDir, { withFileTypes: true });
  const destMd = destEntries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name);

  const extras = destMd.filter((name) => !sourceNames.has(name));

  console.log(`✔  synced ${copied}/${mdFiles.length} markdown files to posts/md`);

  if (extras.length) {
    for (const name of extras) {
      await unlink(path.join(destDir, name));
    }
    console.log(
      `✔  removed ${extras.length} stale markdown files from posts/md`
    );
  }

  return { copied, total: mdFiles.length, extras };
}

async function cleanupStaleHtml(posts, outputRoot) {
  const postsDir = path.join(outputRoot, "posts");
  let entries = [];

  try {
    entries = await readdir(postsDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const keep = new Set(posts.map((post) => `${post.slug}.html`));
  keep.add("index.html");

  const removed = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith(".html")) continue;
    if (keep.has(entry.name)) continue;

    await unlink(path.join(postsDir, entry.name));
    removed.push(entry.name);
  }

  if (removed.length) {
    console.log(`✔  removed ${removed.length} stale post HTML files`);
  }

  return removed;
}

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
  const month = monthAbbr(p.month);
  const yearShort = String(p.year).slice(-2);

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
        <div class="post-card-date"><span class="post-date-month">${month}</span><span class="post-date-year-full"> ${p.year}</span><span class="post-date-year-short"> ${yearShort}</span></div>
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
  /* 1. Sync markdown from source ------------------------------------------ */
  const sourceDir = await resolveSourceDir(root);
  await syncMarkdown(sourceDir, POSTS_MD_DIR);

  /* 2. Load markdown metadata --------------------------------------------- */
  const items = await loadPosts(root, { sourceDir });

  const sorted = [...items].sort((a, b) => b.date - a.date);
  const withLinks = sorted.map((post) => ({
    ...post,
    link: `/posts/${post.slug}.html`,
  }));

  await buildPostPages(withLinks, { root, outRoot });
  await cleanupStaleHtml(withLinks, outRoot);

  const postsJson = withLinks.map(
    ({ year, month, day, title, description, image, tag, tags }) => ({
      year,
      month,
      day,
      title,
      description,
      image: image || "",
      tag,
      tags: tags || [],
    })
  );

  await mkdir(path.join(outRoot, "posts"), { recursive: true });
  await writeFile(
    path.join(outRoot, "posts", "posts.json"),
    JSON.stringify(postsJson, null, 2)
  );
  console.log("✔  posts.json generated from markdown");

  /* 3. Filter out future-dated posts -------------------------------------- */
  const today = new Date();
  const filtered = withLinks.filter((post) => post.date <= today);

  /* 4. Render pages -------------------------------------------------------- */

  // /posts/index.html
  {
    const htmlIn = await readFile(POSTS_HTML, "utf8");
    const htmlOut = replaceBlock(htmlIn, "TIMELINE", buildTimeline(filtered));
    await mkdir(path.dirname(POSTS_HTML_OUT), { recursive: true });
    await writeFile(POSTS_HTML_OUT, htmlOut);
    console.log("✔  timeline updated in posts/index.html");
  }

  // /index.html (home)
  {
    const latest3 = filtered.slice(0, 3).map(latestItem).join("");
    const htmlIn = await readFile(HOME_HTML, "utf8");
    const htmlOut = replaceBlock(htmlIn, "LATEST", latest3);
    await mkdir(path.dirname(HOME_HTML_OUT), { recursive: true });
    await writeFile(HOME_HTML_OUT, htmlOut);
    console.log("✔  latest 3 posts injected into index.html");
  }
})();
