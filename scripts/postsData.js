// scripts/postsData.js
// ---------------------------------------------------------------------------
// Reads markdown from the Obsidian vault (if available) or /posts/md and
// exposes normalized post metadata + content.
// Frontmatter format: YAML-style properties between --- blocks.
// Required: title, description, tags (article|note|experiment), date.
// ---------------------------------------------------------------------------

import { readFile, readdir, access } from "fs/promises";
import path from "path";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTHS_FULL = {
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
};

const TYPE_TAG_MAP = {
  article: "Articles",
  articles: "Articles",
  note: "Notes",
  notes: "Notes",
  experiment: "Experiments",
  experiments: "Experiments",
};

export const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

export const monthName = (abbr) => MONTHS_FULL[abbr] || abbr;

function parseScalar(value) {
  let txt = String(value).trim();
  if (
    (txt.startsWith('"') && txt.endsWith('"')) ||
    (txt.startsWith("'") && txt.endsWith("'"))
  ) {
    txt = txt.slice(1, -1);
  }
  return txt;
}

function normalizeTags(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((entry) => {
      const str = parseScalar(entry);
      return str.split(",").map((part) => part.trim());
    })
    .filter(Boolean)
    .map((tag) => tag.toLowerCase());
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) {
    return { data: {}, body: raw, hasFrontmatter: false };
  }

  const data = {};
  let activeKey = null;
  const lines = match[1].split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && activeKey) {
      if (!Array.isArray(data[activeKey])) data[activeKey] = [];
      data[activeKey].push(parseScalar(listMatch[1]));
      continue;
    }

    const idx = line.indexOf(":");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim().toLowerCase();
    let value = line.slice(idx + 1).trim();

    if (!value) {
      data[key] = [];
      activeKey = key;
      continue;
    }

    activeKey = null;

    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1).trim();
      data[key] = inner
        ? inner.split(",").map((entry) => parseScalar(entry))
        : [];
      continue;
    }

    data[key] = parseScalar(value);
  }

  const body = raw.slice(match[0].length);
  return { data, body, hasFrontmatter: true };
}

function parseDateFromInput(value) {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match.map(Number);
    if (year && month && day) {
      return new Date(year, month - 1, day);
    }
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function parseMonthIndex(value) {
  if (!value && value !== 0) return null;
  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) {
    const idx = Number(raw) - 1;
    return idx >= 0 && idx < 12 ? idx : null;
  }

  const abbr = raw.slice(0, 3).toLowerCase();
  const idx = MONTHS.findIndex((m) => m.toLowerCase() === abbr);
  return idx === -1 ? null : idx;
}

function parseDateFromParts(data) {
  const year = Number(data.year);
  const day = Number(data.day);
  const monthIndex = parseMonthIndex(data.month);

  if (!year || !day || monthIndex === null) return null;
  return new Date(year, monthIndex, day);
}

function resolvePostTag(tags) {
  return tags.map((tag) => TYPE_TAG_MAP[tag]).find(Boolean) || null;
}

async function resolveSourceDir(root) {
  const repoDir = path.join(root, "posts", "md");
  const preferred = process.env.POSTS_SOURCE_DIR || DEFAULT_VAULT_PATH;

  if (preferred) {
    try {
      await access(preferred);
      return preferred;
    } catch {
      if (preferred !== repoDir) {
        console.warn(
          `WARN: Posts source not found at "${preferred}", using "${repoDir}".`
        );
      }
    }
  }

  return repoDir;
}

export async function loadPosts(root) {
  const mdDir = await resolveSourceDir(root);
  const entries = await readdir(mdDir);

  const posts = [];
  const errors = [];
  const slugKeys = new Set();

  for (const file of entries) {
    if (!file.endsWith(".md")) continue;

    const filePath = path.join(mdDir, file);
    const relPath = path.relative(root, filePath);
    const raw = await readFile(filePath, "utf8");
    const { data, body, hasFrontmatter } = parseFrontmatter(raw);

    if (!hasFrontmatter) {
      errors.push(`${relPath}: missing frontmatter block (---)`);
    }

    const title = data.title || file.replace(/\.md$/i, "");
    if (!data.title) {
      errors.push(`${relPath}: missing title`);
    }

    const description = data.description || "";
    if (!description) {
      errors.push(`${relPath}: missing description`);
    }

    const tags = [
      ...normalizeTags(data.tags),
      ...normalizeTags(data.tag),
      ...normalizeTags(data.type),
      ...normalizeTags(data.category),
    ];

    const tag = resolvePostTag(tags);
    if (!tag) {
      errors.push(
        `${relPath}: tags must include article, note, or experiment`
      );
    }

    const date =
      parseDateFromInput(data.date) || parseDateFromParts(data) || null;
    if (!date) {
      errors.push(`${relPath}: missing or invalid date`);
    }

    const slug = data.slug ? slugify(data.slug) : slugify(title);
    if (slugKeys.has(slug)) {
      errors.push(`${relPath}: duplicate slug "${slug}"`);
    }
    slugKeys.add(slug);

    if (!tag || !date || !title || !description) continue;

    posts.push({
      title,
      description,
      tags,
      tag,
      date,
      year: date.getFullYear(),
      month: MONTHS[date.getMonth()],
      day: date.getDate(),
      image: data.image ? String(data.image) : "",
      slug,
      body,
      sourcePath: filePath,
    });
  }

  if (errors.length) {
    throw new Error(
      `Post metadata issues:\n${errors.map((e) => `- ${e}`).join("\n")}`
    );
  }

  return posts;
}
const DEFAULT_VAULT_PATH =
  "/Users/pierrelouis/Documents/Obsidian/Main Vault/Writing/Final Versions";
