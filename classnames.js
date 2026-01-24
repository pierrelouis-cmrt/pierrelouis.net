/**
 * fix-missing-css-replacements.js
 *
 * Fix leftover CSS selectors after timeline/article renames.
 * - Context-aware:
 *    • article headers:  article .post-meta        → article .article-meta-data
 *    • timeline/bookmarks: (other) .post-meta      → .timeline-item-meta
 *    • timeline/bookmarks: .post-card-title        → .timeline-item-title
 * - Also catches remaining timeline/article selector renames.
 *
 * Usage:
 *   node scripts/fix-missing-css-replacements.js
 *   node scripts/fix-missing-css-replacements.js --dry-run
 */

const fs = require("fs");
let globSync;
try {
  const glob = require("glob"); // v7 CJS or v10 ESM shim
  globSync = glob.sync || glob.globSync;
} catch (e) {
  console.error("Install glob v7 for CommonJS: npm i glob@^7");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ---- Canonical mappings from your Posts & Articles plan ---- */
const TIMELINE_MAP = {
  "posts-page": "timeline-page",
  "post-filters": "timeline-filters",
  "post-filter": "timeline-filter",
  "posts-timeline": "content-timeline",
  "timeline-header": "content-timeline-header",
  "timeline-year": "content-timeline-year",
  "timeline-content": "content-timeline-content",
  "timeline-month": "content-timeline-month",
  "month-header": "content-timeline-month-header",
  "month-items": "content-timeline-month-items",
  "post-item": "timeline-item",
  "post-description": "timeline-item-description",
  "post-preview": "timeline-item-preview",
  "external-icon": "external-link-icon",
  // Special: .post-card-title handled contextually below
};

const ARTICLE_MAP = {
  "post-date": "article-publish-date",
  callout: "article-callout",
  "callout-inner": "article-callout-inner",
  "math-display": "article-math-display",
  "math-inline": "article-math-inline",
  "meta-data": "article-meta-data",
  "footnote-ref": "article-footnote-ref",
  footnotes: "article-footnotes",
  "footnotes-list": "article-footnotes-list",
  "footnote-item": "article-footnote-item",
  "footnote-backref": "article-footnote-backref",
  "footnotes-sep": "article-footnotes-separator",
  "task-list": "article-task-list",
  "task-list-item": "article-task-list-item",
  "task-list-item-checkbox": "article-task-list-checkbox",
  "contains-task-list": "article-contains-task-list",
};

/* ---- Heuristics --------------------------------------------------------- */
function isTimelineCSS(filePath, content) {
  const p = filePath.toLowerCase();
  return (
    /posts|bookmarks/.test(p) ||
    content.includes("content-timeline") ||
    content.includes(".timeline-item")
  );
}

function toSelectorRegexToken(cls) {
  // Match .className not followed by a word/hyphen (avoid partials)
  return new RegExp(`\\.${escapeRegExp(cls)}(?![\\w-])`, "g");
}

/* ---- Core transform ----------------------------------------------------- */
function transformCSS(content, filePath) {
  let out = content;
  const changes = new Set();

  // 1) Article header: article .post-meta → article .article-meta-data
  //    (Do this first so the next step won't touch article headers.)
  out = out.replace(/article\s+\.post-meta\b/g, () => {
    changes.add("article .post-meta → article .article-meta-data");
    return "article .article-meta-data";
  });

  // 2) Remaining .post-meta → .timeline-item-meta
  out = out.replace(toSelectorRegexToken("post-meta"), () => {
    changes.add(".post-meta → .timeline-item-meta");
    return ".timeline-item-meta";
  });

  // 3) Contextual: .post-card-title → .timeline-item-title (only in timeline/bookmarks CSS)
  if (isTimelineCSS(filePath, out)) {
    out = out.replace(toSelectorRegexToken("post-card-title"), () => {
      changes.add(".post-card-title → .timeline-item-title");
      return ".timeline-item-title";
    });

    // In timeline CSS, if we see comma lists like ".timeline-item a:hover .link-text, .post-card a:hover .link-text"
    // switch the .post-card part to .timeline-item.
    out = out.replace(
      /(\.timeline-item\s+a:hover\s+\.link-text,\s*)\.post-card\s+a:hover\s+\.link-text/g,
      (_m, a) => {
        changes.add(
          ".post-card a:hover .link-text → .timeline-item a:hover .link-text"
        );
        return `${a}.timeline-item a:hover .link-text`;
      }
    );
  }

  // 4) Generic timeline selector renames (safe anywhere)
  for (const [oldCls, newCls] of Object.entries(TIMELINE_MAP)) {
    const re = toSelectorRegexToken(oldCls);
    if (re.test(out)) {
      out = out.replace(re, () => {
        changes.add(`.${oldCls} → .${newCls}`);
        return `.${newCls}`;
      });
    }
  }

  // 5) Generic article selector renames (safe anywhere)
  for (const [oldCls, newCls] of Object.entries(ARTICLE_MAP)) {
    const re = toSelectorRegexToken(oldCls);
    if (re.test(out)) {
      out = out.replace(re, () => {
        changes.add(`.${oldCls} → .${newCls}`);
        return `.${newCls}`;
      });
    }
  }

  // 6) IDs that may be present (#posts-timeline → #content-timeline)
  out = out.replace(/#posts-timeline\b/g, () => {
    changes.add("#posts-timeline → #content-timeline");
    return "#content-timeline";
  });

  return { out, changes };
}

/* ---- Runner ------------------------------------------------------------- */
function main() {
  const files = globSync("**/*.css", {
    ignore: ["node_modules/**", "dist/**", "build/**", ".git/**"],
    nodir: true,
  });

  if (!files.length) {
    console.log("No CSS files found.");
    return;
  }

  console.log(`Scanning ${files.length} CSS file(s)...\n`);

  let totalChanges = 0;
  for (const file of files) {
    const css = fs.readFileSync(file, "utf8");
    const { out, changes } = transformCSS(css, file);

    if (changes.size) {
      if (!DRY_RUN) fs.writeFileSync(file, out, "utf8");
      console.log(`✅ ${DRY_RUN ? "[dry-run] " : ""}Updated: ${file}`);
      console.log(
        [...changes]
          .sort()
          .map((s) => `   ${s}`)
          .join("\n")
      );
      totalChanges += changes.size;
    } else {
      console.log(`⏭️  No changes needed: ${file}`);
    }
  }

  console.log(
    `\nDone. ${
      DRY_RUN ? "(dry run) " : ""
    }Total selector updates: ${totalChanges}`
  );
}

if (require.main === module) main();

module.exports = { transformCSS };
