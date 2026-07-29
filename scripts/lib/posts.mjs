import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as csstree from "css-tree";
import matter from "gray-matter";
import hljs from "highlight.js";
import { POST_COMPONENTS } from "../../posts/components/registry.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const POSTS_ROOT = path.join(ROOT, "content/posts");
export const POST_ARTICLES_DIR = path.join(POSTS_ROOT, "articles");
export const POST_HEADERS_DIR = path.join(ROOT, "posts/headers");
export const POST_COMPONENTS_DIR = path.join(ROOT, "posts/components");
export const POST_TYPES = Object.freeze(["article", "note", "experiment"]);
export const POST_LANGUAGE_ALIASES = Object.freeze({
  "c++": "cpp",
  cs: "csharp",
  html: "xml",
  js: "javascript",
  md: "markdown",
  py: "python",
  rb: "ruby",
  sh: "bash",
  shell: "bash",
  tex: "latex",
  ts: "typescript",
  yml: "yaml",
  zsh: "bash",
});

const IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);
const MEDIA_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ".mp3",
  ".mp4",
  ".ogg",
  ".pdf",
  ".wav",
  ".webm",
]);
const REMOTE_PROTOCOL = /^(?:https?:)?\/\//i;
const FRONTMATTER_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEADER_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMPONENT_TAG = /^pl-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const POST_PROPERTY_NAMES = new Set([
  "date",
  "description",
  "header-backdrop",
  "header-nav",
  "header-tag-color",
  "hero-alt",
  "hero-caption",
  "hero-image",
  "lang",
  "slug",
  "tags",
  "title",
  "toc",
  "type",
]);
const COMPONENT_PROPERTY_NAMES = new Set([
  "app",
  "label",
  "script",
  "style",
]);

const toPosix = (value) => value.split(path.sep).join("/");

export const slugifyPost = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const normalizePostLanguage = (value) => {
  const language = String(value || "").trim().toLowerCase();
  return POST_LANGUAGE_ALIASES[language] || language;
};

export const normalizePostTags = (value) => {
  const tags = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? [value]
      : [];

  return tags
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .filter((tag, index, all) => all.indexOf(tag) === index);
};

export const postDateIso = (value) => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }

  return String(value || "").trim();
};

export const normalizePostData = (rawData) => {
  const data = { ...rawData };
  const tags = normalizePostTags(data.tags);
  const type = String(data.type || "").toLowerCase();
  const slug = String(data.slug || "").trim();

  return {
    ...data,
    date: postDateIso(data.date),
    lang: String(data.lang || "en").trim().toLowerCase(),
    slug,
    tags,
    toc: data.toc ?? "auto",
    type,
  };
};

const formatIssue = (inputPath, property, message) => {
  const file = toPosix(path.relative(ROOT, inputPath));
  return `${file}: \`${property}\` ${message}`;
};

const isValidCssColor = (value) => {
  if (typeof value !== "string" || value.length > 160) {
    return false;
  }

  try {
    const ast = csstree.parse(value, { context: "value" });
    return !csstree.lexer.matchProperty("color", ast).error;
  } catch {
    return false;
  }
};

const stripReferenceDecorations = (rawReference) => {
  const reference = String(rawReference || "")
    .trim()
    .replace(/^<|>$/g, "");
  const hashIndex = reference.indexOf("#");
  const queryIndex = reference.indexOf("?");
  const cutAt = [hashIndex, queryIndex]
    .filter((index) => index >= 0)
    .sort((first, second) => first - second)[0];

  return cutAt === undefined ? reference : reference.slice(0, cutAt);
};

const resolveLocalReference = (reference, inputPath, articlesDir) => {
  const clean = stripReferenceDecorations(reference);

  if (!clean || clean.startsWith("#") || REMOTE_PROTOCOL.test(clean)) {
    return null;
  }

  let decoded;

  try {
    decoded = decodeURIComponent(clean);
  } catch {
    decoded = clean;
  }

  if (decoded.startsWith("/")) {
    const resolved = path.resolve(ROOT, decoded.slice(1));
    const relative = path.relative(ROOT, resolved);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("escapes the site root");
    }

    return resolved;
  }

  const resolved = path.resolve(path.dirname(inputPath), decoded);
  const relative = path.relative(articlesDir, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("escapes the synchronized article mirror");
  }

  return resolved;
};

const collectMarkdownReferences = (content) => {
  const references = [];
  const standardImages = /!\[[^\]]*]\(\s*(?:<([^>]+)>|([^\s)]+))/g;
  const obsidianEmbeds = /!\[\[([^|\]#]+)(?:[|#][^\]]*)?]]/g;
  const htmlImages = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  const htmlIframes = /<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = standardImages.exec(content))) {
    references.push({ kind: "image", reference: match[1] || match[2] });
  }

  while ((match = obsidianEmbeds.exec(content))) {
    if (MEDIA_EXTENSIONS.has(path.extname(match[1]).toLowerCase())) {
      references.push({ kind: "embed", reference: match[1] });
    }
  }

  while ((match = htmlImages.exec(content))) {
    references.push({ kind: "image", reference: match[1] });
  }

  while ((match = htmlIframes.exec(content))) {
    references.push({ kind: "iframe", reference: match[1] });
  }

  return references;
};

const validateCodeFences = (content, inputPath, errors) => {
  const lines = content.split(/\r?\n/);
  let openFence = null;

  lines.forEach((line, index) => {
    const match = line.match(/^\s*(`{3,}|~{3,})(.*)$/);

    if (!match) {
      return;
    }

    const marker = match[1][0];
    const length = match[1].length;

    if (openFence) {
      if (marker === openFence.marker && length >= openFence.length) {
        openFence = null;
      }
      return;
    }

    const info = match[2].trim();
    const tokens = info.split(/\s+/).filter(Boolean);
    const requested = tokens[0] || "text";
    const language = normalizePostLanguage(requested);
    const flags = tokens.slice(1);

    if (!["text", "plaintext"].includes(language) && !hljs.getLanguage(language)) {
      errors.push(
        `${toPosix(path.relative(ROOT, inputPath))}:${index + 1}: unknown code language \`${requested}\``,
      );
    }

    const unknownFlags = flags.filter((flag) => flag !== "copy");

    if (unknownFlags.length > 0) {
      errors.push(
        `${toPosix(path.relative(ROOT, inputPath))}:${index + 1}: unknown code fence flag(s): ${unknownFlags.join(", ")}`,
      );
    }

    openFence = { length, marker };
  });

  if (openFence) {
    errors.push(
      `${toPosix(path.relative(ROOT, inputPath))}: unclosed code fence`,
    );
  }
};

const validateComponents = (content, inputPath, errors) => {
  const tags = new Set(
    [...content.matchAll(/<(pl-[a-z0-9-]+)\b/g)].map((match) => match[1]),
  );

  for (const tag of tags) {
    if (!POST_COMPONENTS[tag]) {
      errors.push(
        `${toPosix(path.relative(ROOT, inputPath))}: unregistered article component \`<${tag}>\``,
      );
    }
  }
};

const validateComponentRegistry = (errors) => {
  for (const [tag, component] of Object.entries(POST_COMPONENTS)) {
    if (!COMPONENT_TAG.test(tag)) {
      errors.push(
        `posts/components/registry.js: invalid component tag \`${tag}\``,
      );
    }

    if (!component || typeof component !== "object" || Array.isArray(component)) {
      errors.push(
        `posts/components/registry.js: \`${tag}\` must map to a component object`,
      );
      continue;
    }

    for (const property of Object.keys(component)) {
      if (!COMPONENT_PROPERTY_NAMES.has(property)) {
        errors.push(
          `posts/components/registry.js: \`${tag}\` has unknown property \`${property}\``,
        );
      }
    }

    for (const [property, expectedExtension] of [
      ["app", ".html"],
      ["script", ".js"],
      ["style", ".css"],
    ]) {
      const value = component[property];

      if (value === undefined) {
        continue;
      }

      if (typeof value !== "string" || !value.trim()) {
        errors.push(
          `posts/components/registry.js: \`${tag}.${property}\` must be a non-empty local path`,
        );
        continue;
      }

      const resolved = path.resolve(POST_COMPONENTS_DIR, value);
      const relative = path.relative(POST_COMPONENTS_DIR, resolved);

      if (
        relative.startsWith("..") ||
        path.isAbsolute(relative) ||
        path.extname(value) !== expectedExtension
      ) {
        errors.push(
          `posts/components/registry.js: \`${tag}.${property}\` must be a ${expectedExtension} file inside posts/components`,
        );
        continue;
      }

      if (!existsSync(resolved)) {
        errors.push(
          `posts/components/registry.js: \`${tag}.${property}\` references missing file \`${value}\``,
        );
      }
    }

    if (
      component.app &&
      (typeof component.label !== "string" || !component.label.trim())
    ) {
      errors.push(
        `posts/components/registry.js: \`${tag}.label\` is required when \`app\` is set`,
      );
    }
  }
};

const validatePost = async ({
  articlesDir,
  content,
  data,
  inputPath,
  rawData,
  warnings,
}) => {
  const errors = [];

  for (const property of Object.keys(rawData)) {
    if (!POST_PROPERTY_NAMES.has(property)) {
      errors.push(formatIssue(inputPath, property, "is not a supported property"));
    }
  }

  for (const property of ["title", "description", "date"]) {
    if (!String(data[property] || "").trim()) {
      errors.push(formatIssue(inputPath, property, "is required"));
    }
  }

  if (!data.slug) {
    errors.push(formatIssue(inputPath, "slug", "is required"));
  } else if (!SLUG.test(data.slug)) {
    errors.push(
      formatIssue(
        inputPath,
        "slug",
        "must contain only lowercase letters, numbers, and single hyphens",
      ),
    );
  }

  if (!POST_TYPES.includes(data.type)) {
    errors.push(
      formatIssue(
        inputPath,
        "type",
        `must be one of ${POST_TYPES.join(", ")}`,
      ),
    );
  }

  if (!FRONTMATTER_DATE.test(data.date)) {
    errors.push(
      formatIssue(inputPath, "date", "must use the YYYY-MM-DD format"),
    );
  } else if (Number.isNaN(new Date(`${data.date}T00:00:00Z`).valueOf())) {
    errors.push(formatIssue(inputPath, "date", "is not a real calendar date"));
  }

  if (!/^[a-z]{2}(?:-[a-z]{2})?$/i.test(data.lang)) {
    errors.push(
      formatIssue(inputPath, "lang", "must be a language code such as en or fr"),
    );
  }

  if (![true, false, "auto"].includes(data.toc)) {
    errors.push(
      formatIssue(inputPath, "toc", "must be auto, true, or false"),
    );
  }

  const repeatedTypeTags = data.tags.filter(
    (tag) => tag.toLowerCase() === data.type,
  );

  if (repeatedTypeTags.length > 0) {
    errors.push(
      formatIssue(
        inputPath,
        "tags",
        `must contain topics, not the post type \`${data.type}\``,
      ),
    );
  }

  if (data["header-backdrop"]) {
    const header = String(data["header-backdrop"]);

    if (!HEADER_NAME.test(header)) {
      errors.push(
        formatIssue(
          inputPath,
          "header-backdrop",
          "must be a lowercase name, never a path",
        ),
      );
    } else if (!existsSync(path.join(POST_HEADERS_DIR, `${header}.html`))) {
      errors.push(
        formatIssue(
          inputPath,
          "header-backdrop",
          `references missing file posts/headers/${header}.html`,
        ),
      );
    }
  }

  if (
    data["header-nav"] !== undefined &&
    !["light", "dark"].includes(data["header-nav"])
  ) {
    errors.push(
      formatIssue(inputPath, "header-nav", "must be light or dark"),
    );
  }

  if (
    data["header-tag-color"] !== undefined &&
    !isValidCssColor(data["header-tag-color"])
  ) {
    errors.push(
      formatIssue(inputPath, "header-tag-color", "must be a valid CSS color"),
    );
  }

  if (data["hero-image"] && !String(data["hero-alt"] || "").trim()) {
    errors.push(
      formatIssue(inputPath, "hero-alt", "is required when hero-image is set"),
    );
  }

  if (/^#(?!#)\s+/m.test(content)) {
    errors.push(
      `${toPosix(path.relative(ROOT, inputPath))}: body must not contain an H1; the template supplies it from \`title\``,
    );
  }

  validateCodeFences(content, inputPath, errors);
  validateComponents(content, inputPath, errors);

  const references = collectMarkdownReferences(content);

  if (data["hero-image"]) {
    references.push({ kind: "hero-image", reference: data["hero-image"] });
  }

  for (const { kind, reference } of references) {
    if (REMOTE_PROTOCOL.test(reference)) {
      if (kind === "image" || kind === "hero-image") {
        warnings.push(
          `${toPosix(path.relative(ROOT, inputPath))}: remote image \`${reference}\` should be downloaded into the vault`,
        );
      }
      continue;
    }

    let resolved;

    try {
      resolved = resolveLocalReference(reference, inputPath, articlesDir);
    } catch (error) {
      errors.push(
        `${toPosix(path.relative(ROOT, inputPath))}: \`${reference}\` ${error.message}`,
      );
      continue;
    }

    if (!resolved) {
      continue;
    }

    if (!existsSync(resolved)) {
      const issue = `${toPosix(path.relative(ROOT, inputPath))}: ${kind} reference \`${reference}\` does not exist`;

      if (kind === "iframe") {
        warnings.push(issue);
      } else {
        errors.push(issue);
      }
    }
  }

  return errors;
};

export const loadPostManifest = async ({
  articlesDir = POST_ARTICLES_DIR,
} = {}) => {
  let entries;

  try {
    entries = await readdir(articlesDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        `Post source mirror not found at ${toPosix(path.relative(ROOT, articlesDir))}. Run \`npm run sync:posts\` first.`,
      );
    }
    throw error;
  }

  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(articlesDir, entry.name))
    .sort((first, second) => first.localeCompare(second));
  const posts = [];
  const warnings = [];
  const errors = [];
  const seenSlugs = new Map();

  validateComponentRegistry(errors);

  for (const inputPath of markdownFiles) {
    const source = await readFile(inputPath, "utf8");
    const parsed = matter(source);
    const data = normalizePostData(parsed.data);

    errors.push(
      ...(await validatePost({
        articlesDir,
        content: parsed.content,
        data,
        inputPath,
        rawData: parsed.data,
        warnings,
      })),
    );

    if (data.slug) {
      if (seenSlugs.has(data.slug)) {
        errors.push(
          `Duplicate post slug \`${data.slug}\` in ${toPosix(
            path.relative(ROOT, seenSlugs.get(data.slug)),
          )} and ${toPosix(path.relative(ROOT, inputPath))}`,
        );
      } else {
        seenSlugs.set(data.slug, inputPath);
      }
    }

    posts.push({
      content: parsed.content,
      data,
      filename: path.basename(inputPath),
      inputPath,
      source,
    });
  }

  if (errors.length > 0) {
    throw new Error(`Post validation failed:\n- ${errors.join("\n- ")}`);
  }

  const byInputPath = new Map(
    posts.map((post) => [path.resolve(post.inputPath), post]),
  );
  const byWikiName = new Map();

  for (const post of posts) {
    const candidates = [
      post.data.slug,
      post.data.title,
      path.basename(post.filename, ".md"),
    ];

    for (const candidate of candidates) {
      byWikiName.set(String(candidate).trim().toLowerCase(), post);
    }
  }

  return {
    articlesDir,
    byInputPath,
    byWikiName,
    posts,
    warnings: [...new Set(warnings)].sort(),
  };
};

export const resolvePostAssetPath = (
  reference,
  inputPath,
  articlesDir = POST_ARTICLES_DIR,
) => resolveLocalReference(reference, inputPath, articlesDir);

export const isRemotePostAsset = (reference) =>
  REMOTE_PROTOCOL.test(String(reference || ""));

export const isPostImage = (reference) =>
  IMAGE_EXTENSIONS.has(
    path.extname(stripReferenceDecorations(reference)).toLowerCase(),
  );
