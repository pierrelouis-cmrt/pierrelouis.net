import { readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Eleventy from "@11ty/eleventy";
import { loadPostManifest } from "./lib/posts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POSTS_OUTPUT_DIR = path.join(ROOT, "posts");
const CONFIG_PATH = path.join(ROOT, "eleventy.config.mjs");
const RESERVED_POST_DIRECTORIES = new Set(["components", "headers"]);
const REMOTE_REFERENCE = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

const validateLocalReferences = async (html, outputPath, errors) => {
  const references = new Set(
    [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(
      (match) => match[1],
    ),
  );

  for (const reference of references) {
    if (
      !reference ||
      reference.startsWith("#") ||
      REMOTE_REFERENCE.test(reference)
    ) {
      continue;
    }

    const pathname = reference.split(/[?#]/, 1)[0];

    if (!pathname) {
      continue;
    }

    let decoded;

    try {
      decoded = decodeURI(pathname);
    } catch {
      errors.push(
        `${path.relative(ROOT, outputPath)} contains an invalid URL: ${reference}`,
      );
      continue;
    }

    const resolved = decoded.startsWith("/")
      ? path.resolve(ROOT, `.${decoded}`)
      : path.resolve(path.dirname(outputPath), decoded);

    if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) {
      errors.push(
        `${path.relative(ROOT, outputPath)} links outside the site root: ${reference}`,
      );
      continue;
    }

    try {
      await stat(resolved);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      errors.push(
        `${path.relative(ROOT, outputPath)} has a missing local reference: ${reference}`,
      );
    }
  }
};

const removeStalePostPages = async (slugs) => {
  const expected = new Set(slugs);
  const entries = await readdir(POSTS_OUTPUT_DIR, { withFileTypes: true });
  let removed = 0;

  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      RESERVED_POST_DIRECTORIES.has(entry.name) ||
      expected.has(entry.name)
    ) {
      continue;
    }

    const candidate = path.join(POSTS_OUTPUT_DIR, entry.name);

    try {
      const index = await stat(path.join(candidate, "index.html"));

      if (!index.isFile()) {
        continue;
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        continue;
      }
      throw error;
    }

    await rm(candidate, { force: true, recursive: true });
    removed += 1;
  }

  return removed;
};

const normalizeGeneratedHtml = async (manifest) => {
  const files = [
    path.join(POSTS_OUTPUT_DIR, "index.html"),
    ...manifest.posts.map((post) =>
      path.join(POSTS_OUTPUT_DIR, post.data.slug, "index.html"),
    ),
  ];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const normalized = `${source
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .join("\n")
      .trimEnd()}\n`;

    if (normalized !== source) {
      await writeFile(file, normalized);
    }
  }
};

const validateGeneratedPages = async (manifest) => {
  const errors = [];

  for (const post of manifest.posts) {
    const outputPath = path.join(
      POSTS_OUTPUT_DIR,
      post.data.slug,
      "index.html",
    );
    let html;

    try {
      html = await readFile(outputPath, "utf8");
    } catch {
      errors.push(`Missing generated page posts/${post.data.slug}/index.html`);
      continue;
    }

    const h1Count = (html.match(/<h1\b/g) || []).length;

    if (h1Count !== 1) {
      errors.push(
        `posts/${post.data.slug}/index.html contains ${h1Count} H1 elements (expected exactly one)`,
      );
    }

    if (
      /assets\/vendor\/(?:highlight|katex\/(?:katex|auto-render)).*\.js/.test(
        html,
      )
    ) {
      errors.push(
        `posts/${post.data.slug}/index.html includes a runtime math or syntax-highlighting renderer`,
      );
    }

    if (!html.includes('class="post-body"')) {
      errors.push(
        `posts/${post.data.slug}/index.html is missing the post body wrapper`,
      );
    }

    await validateLocalReferences(html, outputPath, errors);
  }

  const indexPath = path.join(POSTS_OUTPUT_DIR, "index.html");

  try {
    const indexHtml = await readFile(indexPath, "utf8");

    for (const post of manifest.posts) {
      if (!indexHtml.includes(`href="./${post.data.slug}/"`)) {
        errors.push(`Posts index does not link to ${post.data.slug}`);
      }
    }

    await validateLocalReferences(indexHtml, indexPath, errors);
  } catch {
    errors.push("Missing generated posts/index.html");
  }

  if (errors.length > 0) {
    throw new Error(`Generated post validation failed:\n- ${errors.join("\n- ")}`);
  }
};

export const buildPosts = async () => {
  const manifest = await loadPostManifest();
  const eleventy = new Eleventy("content/posts", "posts", {
    configPath: CONFIG_PATH,
    quietMode: true,
    source: "script",
  });

  await eleventy.write();
  await normalizeGeneratedHtml(manifest);
  const removed = await removeStalePostPages(
    manifest.posts.map((post) => post.data.slug),
  );
  await validateGeneratedPages(manifest);

  return {
    posts: manifest.posts.length,
    removed,
    warnings: manifest.warnings,
  };
};

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const result = await buildPosts();
  console.log(
    `Built posts: ${result.posts} page(s), ${result.removed} stale page(s) removed, ${result.warnings.length} warning(s).`,
  );
}
