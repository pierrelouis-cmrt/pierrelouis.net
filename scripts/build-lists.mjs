import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGE_FILE = path.join(ROOT, "lists", "index.html");
const SHEETS_DIR = path.join(ROOT, "lists", "sheets");
const GENERATED_START = "        <!-- list-sheets:generated:start -->";
const GENERATED_END = "        <!-- list-sheets:generated:end -->";
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isDirectRun = () =>
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const indentFragment = (source, spaces) => {
  const indentation = " ".repeat(spaces);

  return source
    .split("\n")
    .map((line) => (line ? `${indentation}${line}` : ""))
    .join("\n");
};

const generatedBounds = (source) => {
  const startIndex = source.indexOf(GENERATED_START);
  const endIndex = source.indexOf(GENERATED_END);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(
      "lists/index.html is missing its list-sheets generated markers",
    );
  }

  return {
    before: source.slice(0, startIndex + GENERATED_START.length),
    after: source.slice(endIndex),
    authorSource:
      source.slice(0, startIndex) +
      source.slice(endIndex + GENERATED_END.length),
  };
};

const triggerSlugs = (source) => {
  const slugs = [
    ...source.matchAll(/\bdata-list-sheet-open="([^"]+)"/g),
  ].map((match) => match[1]);
  const unique = new Set(slugs);

  if (slugs.length === 0) {
    throw new Error("lists/index.html does not contain any list sheet triggers");
  }

  if (unique.size !== slugs.length) {
    throw new Error("Each data-list-sheet-open slug must be unique");
  }

  for (const slug of slugs) {
    if (!SLUG_PATTERN.test(slug)) {
      throw new Error(`Invalid list sheet slug "${slug}"`);
    }

    const expectedControl = `aria-controls="list-sheet-${slug}"`;

    if (!source.includes(expectedControl)) {
      throw new Error(
        `The "${slug}" trigger must include ${expectedControl}`,
      );
    }
  }

  return slugs;
};

const validateFragment = (slug, source) => {
  const relativePath = `lists/sheets/${slug}.html`;
  const forbidden = [
    ["<!doctype", "a doctype"],
    ["<html", "an <html> element"],
    ["<body", "a <body> element"],
    ["<dialog", "a <dialog> element"],
  ];

  if (!source.trim()) {
    throw new Error(`${relativePath} is empty`);
  }

  for (const [needle, label] of forbidden) {
    if (source.toLowerCase().includes(needle)) {
      throw new Error(
        `${relativePath} must be a fragment and cannot contain ${label}`,
      );
    }
  }

  const titleId = `list-sheet-title-${slug}`;
  const descriptionId = `list-sheet-description-${slug}`;
  const titleMatch = source.match(/\bdata-list-sheet-title="([^"]+)"/);

  if (!source.includes(`id="${titleId}"`)) {
    throw new Error(`${relativePath} must contain id="${titleId}"`);
  }

  if (!titleMatch?.[1]?.trim()) {
    throw new Error(
      `${relativePath} must declare data-list-sheet-title on its content root`,
    );
  }

  if (!source.includes('class="list-sheet__content')) {
    throw new Error(
      `${relativePath} must contain a .list-sheet__content root`,
    );
  }

  return {
    descriptionId: source.includes(`id="${descriptionId}"`)
      ? descriptionId
      : null,
    source: source.trim(),
    title: titleMatch[1].trim(),
    titleId,
  };
};

const renderSheet = (slug, fragment) => {
  const describedBy = fragment.descriptionId
    ? `\n          aria-describedby="${escapeHtml(fragment.descriptionId)}"`
    : "";

  return `        <dialog
          class="list-sheet"
          id="list-sheet-${escapeHtml(slug)}"
          aria-labelledby="${escapeHtml(fragment.titleId)}"${describedBy}
          tabindex="-1"
          data-list-sheet="${escapeHtml(slug)}"
        >
          <div class="list-sheet__surface">
            <button
              class="list-sheet__handle"
              type="button"
              aria-label="Close ${escapeHtml(fragment.title)}"
              data-list-sheet-handle
            >
              <span class="list-sheet__handle-bar"></span>
            </button>

            <button
              class="list-sheet__close"
              type="button"
              aria-label="Close ${escapeHtml(fragment.title)}"
              data-list-sheet-close
            >
              <span aria-hidden="true"></span>
            </button>

            <!-- Source: lists/sheets/${escapeHtml(slug)}.html -->
${indentFragment(fragment.source, 12)}
          </div>
        </dialog>`;
};

export const buildLists = async () => {
  const pageSource = await readFile(PAGE_FILE, "utf8");
  const bounds = generatedBounds(pageSource);
  const slugs = triggerSlugs(bounds.authorSource);
  const entries = await readdir(SHEETS_DIR, { withFileTypes: true });
  const sourceSlugs = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => path.basename(entry.name, ".html"))
    .sort();
  const expected = new Set(slugs);
  const orphaned = sourceSlugs.filter((slug) => !expected.has(slug));

  if (orphaned.length > 0) {
    throw new Error(
      `List sheet source(s) have no matching card: ${orphaned.join(", ")}`,
    );
  }

  const sheets = await Promise.all(
    slugs.map(async (slug) => {
      const file = path.join(SHEETS_DIR, `${slug}.html`);
      let source;

      try {
        source = await readFile(file, "utf8");
      } catch (error) {
        if (error.code === "ENOENT") {
          throw new Error(
            `Missing lists/sheets/${slug}.html for the "${slug}" card`,
          );
        }

        throw error;
      }

      return renderSheet(slug, validateFragment(slug, source));
    }),
  );

  const output = `${bounds.before}\n${sheets.join("\n\n")}\n${bounds.after}`;
  const changed = output !== pageSource;

  if (changed) {
    await writeFile(PAGE_FILE, output);
  }

  return {
    changed,
    sheets: sheets.length,
  };
};

if (isDirectRun()) {
  const result = await buildLists();
  console.log(
    `Built Lists page: ${result.sheets} sheet(s)${
      result.changed ? "" : " (unchanged)"
    }.`,
  );
}
