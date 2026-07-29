import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { buildPosts } from "./build-posts.mjs";
import { loadPostManifest } from "./lib/posts.mjs";
import { startSiteServer } from "./site-server.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QA_DIR = path.join(ROOT, "output/playwright/posts-qa");
const CACHE_PATH = path.join(QA_DIR, ".build-cache.json");
const SHARED_INPUTS = [
  path.join(ROOT, "base.css"),
  path.join(ROOT, "posts/post.css"),
  path.join(ROOT, "posts/post.js"),
  path.join(ROOT, "posts/headers/header-protocol.js"),
  path.join(ROOT, "eleventy.config.mjs"),
  path.join(ROOT, "package-lock.json"),
  path.join(ROOT, "content/posts/legacy-posts.json"),
  path.join(ROOT, "posts/components/registry.mjs"),
  path.join(ROOT, "scripts/lib/post-markdown.mjs"),
  path.join(ROOT, "scripts/lib/posts.mjs"),
];

const collectFiles = async (directory) => {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(candidate)));
    } else if (entry.isFile()) {
      files.push(candidate);
    }
  }

  return files.sort();
};

const readCache = async () => {
  try {
    return JSON.parse(await readFile(CACHE_PATH, "utf8"));
  } catch {
    return { posts: {}, version: 1 };
  }
};

const fileExists = async (filePath) => {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
};

const hashPost = async (post, sharedFiles) => {
  const hash = createHash("sha256");

  for (const filePath of sharedFiles) {
    hash.update(path.relative(ROOT, filePath));
    hash.update(await readFile(filePath));
  }

  hash.update(post.source);

  if (post.data["header-backdrop"]) {
    const headerPath = path.join(
      ROOT,
      "posts/headers",
      `${post.data["header-backdrop"]}.html`,
    );
    hash.update(await readFile(headerPath));
  }

  return hash.digest("hex");
};

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const inspectPost = async ({ baseUrl, browser, post }) => {
  const slug = post.data.slug;
  const context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { height: 1000, width: 1440 },
  });
  const page = await context.newPage();
  const browserIssues = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      browserIssues.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    browserIssues.push(`page error: ${error.message}`);
  });
  page.on("response", (response) => {
    if (
      new URL(response.url()).origin === new URL(baseUrl).origin &&
      response.status() >= 400
    ) {
      browserIssues.push(
        `${response.status()} ${new URL(response.url()).pathname}`,
      );
    }
  });

  await page.goto(`${baseUrl}/posts/${slug}/`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => document.fonts?.status === "loaded");
  await page.evaluate(() => {
    document
      .querySelectorAll(".post-body > *, .post-endmatter__inner")
      .forEach((element) => element.classList.add("is-reveal-visible"));
  });

  const dom = await page.evaluate(() => {
    const toc = document.querySelector("[data-post-toc]");
    const h2Count = document.querySelectorAll(".post-body > h2").length;
    const tocMode = toc?.dataset.tocMode;
    const tocExpected =
      Boolean(toc) && (tocMode === "true" ? h2Count >= 1 : h2Count >= 2);

    return {
      codeBlocks: document.querySelectorAll(".post-code-block").length,
      h1Count: document.querySelectorAll("h1").length,
      hasKatexError: Boolean(document.querySelector(".katex-error")),
      imageMissingAlt: [...document.querySelectorAll(".post-body img")].some(
        (image) => !image.hasAttribute("alt"),
      ),
      title: document.title,
      tocExpected,
      tocVisible: toc ? !toc.hidden : false,
    };
  });

  if (dom.h1Count !== 1) {
    browserIssues.push(`expected one H1, found ${dom.h1Count}`);
  }

  if (!dom.title.startsWith(post.data.title)) {
    browserIssues.push(`document title does not start with article title`);
  }

  if (dom.hasKatexError) {
    browserIssues.push("KaTeX error element found");
  }

  if (dom.imageMissingAlt) {
    browserIssues.push("article image without alt attribute");
  }

  if (dom.tocExpected !== dom.tocVisible) {
    browserIssues.push(
      `TOC visibility mismatch (expected ${dom.tocExpected}, received ${dom.tocVisible})`,
    );
  }

  const lightboxTrigger = page.locator("[data-post-lightbox-item]").first();

  if ((await lightboxTrigger.count()) > 0) {
    await lightboxTrigger.click();

    if (await page.locator("[data-post-lightbox]").getAttribute("hidden")) {
      browserIssues.push("lightbox did not open");
    }

    await page.keyboard.press("Escape");
  }

  await page.screenshot({
    fullPage: true,
    path: path.join(QA_DIR, `${slug}-desktop.png`),
  });
  await page.setViewportSize({ height: 630, width: 1200 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(QA_DIR, `${slug}-social.png`),
  });

  if (post.data["header-backdrop"]) {
    await page.evaluate(() => {
      document
        .querySelector("[data-post-hero-backdrop]")
        ?.contentWindow?.postMessage(
          { progress: 0.5, type: "post-header:set-progress" },
          "*",
        );
    });
    await page.waitForTimeout(100);
    await page.locator(".post-hero").screenshot({
      path: path.join(QA_DIR, `${slug}-header-50.png`),
    });
    await page.evaluate(() => {
      document
        .querySelector("[data-post-hero-backdrop]")
        ?.contentWindow?.postMessage(
          { renderer: "css", type: "post-header:set-renderer" },
          "*",
        );
    });
    await page.waitForTimeout(100);
    await page.locator(".post-hero").screenshot({
      path: path.join(QA_DIR, `${slug}-header-css.png`),
    });
  }

  await page.setViewportSize({ height: 844, width: 390 });
  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(() => {
    document
      .querySelectorAll(".post-body > *, .post-endmatter__inner")
      .forEach((element) => element.classList.add("is-reveal-visible"));
  });
  await page.screenshot({
    fullPage: true,
    path: path.join(QA_DIR, `${slug}-mobile.png`),
  });

  await context.close();

  if (browserIssues.length > 0) {
    throw new Error(`${slug}:\n  - ${[...new Set(browserIssues)].join("\n  - ")}`);
  }
};

export const runPostQa = async ({
  build = true,
  changedOnly = false,
} = {}) => {
  if (build) {
    await buildPosts();
  }

  const manifest = await loadPostManifest();
  const cache = await readCache();
  const includes = await collectFiles(
    path.join(ROOT, "content/posts/_includes"),
  );
  const sharedFiles = [...SHARED_INPUTS, ...includes];
  const candidates = [];
  let cached = 0;

  await mkdir(QA_DIR, { recursive: true });

  for (const post of manifest.posts) {
    const hash = await hashPost(post, sharedFiles);
    const desktop = path.join(QA_DIR, `${post.data.slug}-desktop.png`);
    const mobile = path.join(QA_DIR, `${post.data.slug}-mobile.png`);

    if (
      changedOnly &&
      cache.posts?.[post.data.slug]?.hash === hash &&
      (await fileExists(desktop)) &&
      (await fileExists(mobile))
    ) {
      cached += 1;
      continue;
    }

    candidates.push({ hash, post });
  }

  if (candidates.length === 0) {
    return { cached, checked: 0 };
  }

  const site = await startSiteServer({
    dev: false,
    port: 8120,
    root: ROOT,
  });
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const baseUrl = `http://${site.host}:${site.port}`;

    for (const candidate of candidates) {
      await inspectPost({
        baseUrl,
        browser,
        post: candidate.post,
      });
      cache.posts[candidate.post.data.slug] = {
        hash: candidate.hash,
        updatedAt: new Date().toISOString(),
      };
    }

    const activeSlugs = new Set(
      manifest.posts.map((post) => post.data.slug),
    );

    for (const slug of Object.keys(cache.posts || {})) {
      if (!activeSlugs.has(slug)) {
        delete cache.posts[slug];
      }
    }

    await writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
  } finally {
    await browser?.close();
    await closeServer(site.server);
  }

  return { cached, checked: candidates.length };
};

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const result = await runPostQa({
    changedOnly: process.argv.includes("--changed"),
  });
  console.log(
    `Post visual QA complete: ${result.checked} checked, ${result.cached} cached.`,
  );
}
