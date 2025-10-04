// scripts/buildMdPages.js
// ---------------------------------------------------------------------------
// Converts *.md inside:
//   posts/articles/md/     →  posts/articles/{slug}.html
//   posts/notes/md/        →  posts/notes/{slug}.html
//   posts/experiments/md/  →  posts/experiments/{slug}.html
//
// Plug-ins & tweaks added (class names updated to article-*):
//   • ==highlight==                     → <mark>
//   • task lists                        → <ul class="article-task-list"> etc.
//   • footnotes                         → article-footnotes*, custom backrefs
//   • abbreviations                     → markdown-it-abbr
//   • definition list “= definition”    → markdown-it-deflist (pre-tweak)
//   • callout “> [!info] … ”            → <div class="article-callout"><div class="article-callout-inner">
//   • MathJax handled client-side
//   • images: lazy + lightbox           → loading=lazy + onclick
//   • “image” ending in .mp4/.webm      → <video>
// ---------------------------------------------------------------------------

import { readFile, writeFile, readdir, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import MarkdownIt from "markdown-it";
import mark from "markdown-it-mark";
import footnote from "markdown-it-footnote";
import abbr from "markdown-it-abbr";
import taskLists from "markdown-it-task-lists";
import deflist from "markdown-it-deflist";
import container from "markdown-it-container";
import mathjax from "markdown-it-mathjax"; // → leaves TeX for runtime MathJax

/* ---------- repo paths --------------------------------------------------- */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const JSON_PATH = path.join(root, "posts", "posts.json");
const ARTICLES_MD_DIR = path.join(root, "posts", "articles", "md");
const NOTES_MD_DIR = path.join(root, "posts", "notes", "md");
const EXPERIMENTS_MD_DIR = path.join(root, "posts", "experiments", "md");

const ARTICLES_OUT_DIR = path.join(root, "posts", "articles");
const NOTES_OUT_DIR = path.join(root, "posts", "notes");
const EXPERIMENTS_OUT_DIR = path.join(root, "posts", "experiments");

/* ---------- helpers ------------------------------------------------------ */
const slugify = (t) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

const monthName = (abbr) =>
  ({
    Jan: "January",
    Feb: "February",
    Mar: "March",
    Apr: "April",
    May: "May",
    Jun: "June",
    Jul: "July",
    Aug: "August",
    Sep: "September",
    Oct: "October",
    Nov: "November",
    Dec: "December",
  }[abbr] || abbr);

/* ---------- Load JSON metadata ------------------------------------------ */
const postsMeta = {};
for (const p of JSON.parse(await readFile(JSON_PATH, "utf8"))) {
  postsMeta[p.title] = p;
}

/* ---------- SVG icon for the ‘info’ call-out ---------------------------- */
const INFO_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;
const FOOTNOTE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>`;

/* ---------- Markdown-it set-up ------------------------------------------ */
const md = new MarkdownIt({ html: true, breaks: true, linkify: true })
  .use(mark)
  .use(footnote)
  .use(abbr)
  // real <input type="checkbox">; no <label> wrapper
  .use(taskLists, { label: false })
  .use(deflist)
  .use(mathjax())
  .use(container, "info", {
    render(tokens, idx) {
      return tokens[idx].nesting === 1
        ? `<div class="article-callout" role="note"><div class="article-callout-inner"><div class="icon" aria-hidden="true">${INFO_ICON}</div><div class="content">\n`
        : "</div></div></div>\n";
    },
  });

/* -- custom footnote reference & back-reference renderers ---------------- */
md.renderer.rules.footnote_ref = (tokens, idx) => {
  const id = String(tokens[idx].meta.id + 1);
  const sub = tokens[idx].meta.subId;
  const ref = sub > 0 ? `${id}:${sub}` : id;
  return `<sup class="article-footnote-ref"><a href="#fn${ref}">${id}</a></sup>`;
};

md.renderer.rules.footnote_anchor = (tokens, idx) => {
  let id = String(tokens[idx].meta.id + 1);
  if (tokens[idx].meta.subId > 0) id += `:${tokens[idx].meta.subId}`;
  return ` <a href="#fnref${id}" class="article-footnote-backref">${FOOTNOTE_ICON}</a>`;
};

/* -- custom renderer: images + mp4/webm ---------------------------------- */
const defaultImg = md.renderer.rules.image;
md.renderer.rules.image = (tokens, idx, opts, env, self) => {
  const token = tokens[idx];
  const src = token.attrGet("src") || "";
  if (/\.(mp4|webm)$/i.test(src)) {
    const type = src.endsWith(".mp4") ? "mp4" : "webm";
    return `<video controls>\n<source src="${src}" type="video/${type}">\nYour browser does not support the video tag.\n</video>`;
  }
  token.attrSet("loading", "lazy");
  token.attrSet("decoding", "async");

  if (!token.attrGet("data-lightbox-item")) {
    token.attrSet("data-lightbox-item", "");
  }

  if (!token.attrGet("data-lightbox-group") && env) {
    const group = env.lightboxGroup || (env.slug ? `post-${env.slug}` : null);
    if (group) {
      token.attrSet("data-lightbox-group", group);
    }
  }
  return defaultImg(tokens, idx, opts, env, self);
};

/* -- custom renderer: links target="_blank" ------------------------------ */
const defaultLinkRenderer =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const href = tokens[idx].attrGet("href") || "";

  // Exclude footnote backlinks (e.g., href="#fn1") and internal anchor links
  if (!href.startsWith("#")) {
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener noreferrer");
  }

  return defaultLinkRenderer(tokens, idx, options, env, self);
};

/* ---------- Pre-processing tweaks --------------------------------------- */
function preprocess(markdown) {
  let txt = markdown;

  /* 1· callout “> [!info]” → :::info … -------------------------------- */
  txt = txt.replace(/^>\s*\[!info]\s*\n((?:>.*\n?)+)/gim, (_, body) => {
    const inner = body.replace(/^>\s?/gm, "").trimEnd();
    return `:::info\n${inner}\n:::\n`;
  });

  /* 2· definition list with “= ” → “: ” -------------------------------- */
  txt = txt.replace(/^\s*=\s+/gm, ": ");

  /* 3· strip trailing “(H1–H6)” in headings ---------------------------- */
  txt = txt.replace(/^(#{1,6}.*?)\s*\(H[1-6]\)\s*$/gm, "$1");

  /* 4· ensure task list starts a **new** list by switching bullet char -- */
  txt = txt.replace(/^-(\s+\[(?:\s|x|X)])+/gm, (m) => m.replace(/^-/, "+"));

  return txt;
}

/* ---------- builder ----------------------------------------------------- */
async function buildDir(srcDir, outDir) {
  await mkdir(outDir, { recursive: true });

  for (const file of await readdir(srcDir)) {
    if (!file.endsWith(".md")) continue;

    const title = file.replace(/\.md$/i, "");
    const meta = postsMeta[title];
    if (!meta) {
      console.warn("⚠  No JSON metadata for", title);
      continue;
    }

    const slug = slugify(title);
    const rawMd = await readFile(path.join(srcDir, file), "utf8");
    let rendered = md.render(preprocess(rawMd), {
      slug,
      lightboxGroup: `post-${slug}`,
    });

    /* Normalize plugin-generated classes to article-* ------------------- */
    rendered = rendered
      .replace(/class="footnotes"/g, 'class="article-footnotes"')
      .replace(/class="footnotes-list"/g, 'class="article-footnotes-list"')
      .replace(/class="footnote-item"/g, 'class="article-footnote-item"')
      .replace(
        /class="task-list-item-checkbox"/g,
        'class="article-task-list-checkbox"'
      )
      .replace(/class="task-list-item"/g, 'class="article-task-list-item"')
      .replace(
        /class="contains-task-list"/g,
        'class="article-contains-task-list"'
      )
      .replace(/class="task-list"/g, 'class="article-task-list"');

    const dateStr = `${monthName(meta.month)} ${meta.day}, ${meta.year}`;

    //  — Task-list ULs: no bullets ————————————————————————————————
    const styledTasks = rendered.replace(
      /<ul class="(article-task-list|article-contains-task-list)"/g,
      '<ul class="$1" style="list-style:none;margin:0;padding:0;"'
    );

    // No additional UL styling here — keep semantic HTML clean.
    const html = (
      await readFile(path.join(__dirname, "page-skeleton.html"), "utf8")
    )
      .replace(/{{TITLE}}/g, title)
      .replace(
        "{{POST_HEADER}}",
        `<div class="article-meta-data"><h1>${title}</h1>\n<span class="article-publish-date">${dateStr}</span></div>`
      )
      .replace("{{CONTENT}}", styledTasks)
      .replace(/{{LIGHTBOX_GROUP}}/g, `post-${slug}`);

    const out = path.join(outDir, `${slug}.html`);
    await writeFile(out, html);
    console.log("✔  built", path.relative(root, out));
  }
}

await buildDir(ARTICLES_MD_DIR, ARTICLES_OUT_DIR);
await buildDir(NOTES_MD_DIR, NOTES_OUT_DIR);
await buildDir(EXPERIMENTS_MD_DIR, EXPERIMENTS_OUT_DIR);

console.log("✔  buildMdPages complete");
