import { cp, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLists } from "./build-lists.mjs";
import { buildPhotos } from "./build-photos.mjs";
import { buildProjects } from "./build-projects.mjs";
import { syncSharedComponents } from "./shared-components.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST_DIR = path.join(ROOT, "dist");
const TEMP_DIST_DIR = path.join(ROOT, `.dist-tmp-${process.pid}`);
const PUBLIC_DIRECTORIES = ["assets", "favicon"];
const NON_PAGE_DIRECTORIES = new Set([
  "content",
  "dist",
  "node_modules",
  "output",
  "scripts",
  "src",
]);
const PUBLIC_ROOT_FILES = [
  "base.css",
  "favicon.ico",
  "footer.js",
  "home.css",
  "index.html",
  "script.js",
];

const isBuildCache = (source) => path.basename(source) === ".build-cache.json";

const isAuthoringSource = (source) => {
  const relativePath = path.relative(ROOT, source).split(path.sep).join("/");

  return (
    relativePath === "lists/sheets" ||
    relativePath.startsWith("lists/sheets/")
  );
};

const getPageDirectories = async () => {
  const entries = await readdir(ROOT, { withFileTypes: true });
  const pageDirectories = [];

  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      entry.name.startsWith(".") ||
      PUBLIC_DIRECTORIES.includes(entry.name) ||
      NON_PAGE_DIRECTORIES.has(entry.name)
    ) {
      continue;
    }

    try {
      const index = await stat(path.join(ROOT, entry.name, "index.html"));

      if (index.isFile()) {
        pageDirectories.push(entry.name);
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return pageDirectories.sort();
};

const copyPublicPath = async (relativePath) => {
  await cp(
    path.join(ROOT, relativePath),
    path.join(TEMP_DIST_DIR, relativePath),
    {
      filter: (source) => !isBuildCache(source) && !isAuthoringSource(source),
      recursive: true,
    },
  );
};

const assembleDist = async () => {
  const publicPaths = [
    ...PUBLIC_ROOT_FILES,
    ...PUBLIC_DIRECTORIES,
    ...(await getPageDirectories()),
  ];

  await rm(TEMP_DIST_DIR, { force: true, recursive: true });
  await mkdir(TEMP_DIST_DIR, { recursive: true });

  try {
    await Promise.all(publicPaths.map(copyPublicPath));
    await rm(DIST_DIR, { force: true, recursive: true });
    await rename(TEMP_DIST_DIR, DIST_DIR);
  } finally {
    await rm(TEMP_DIST_DIR, { force: true, recursive: true });
  }

  return publicPaths.length;
};

const lists = await buildLists();
const projects = await buildProjects();
const photos = await buildPhotos();
const sharedComponents = await syncSharedComponents();
const copiedPaths = await assembleDist();

console.log(
  `Built Lists page: ${lists.sheets} sheet(s)${
    lists.changed ? "" : " (unchanged)"
  }.`,
);
console.log(
  `Built projects page: ${projects.featured} featured, ` +
    `${projects.playground} playground (${projects.total} total), ` +
    `${projects.assets.generated} generated, ${projects.assets.skipped} cached, ` +
    `${projects.assets.removed} stale asset(s) removed, ` +
    `${projects.caseStudies.total} project page(s).`,
);
console.log(
  `Built photos page: ${photos.collections} collection(s), ${photos.photos} photo(s), ` +
    `${photos.assets.generated} generated asset(s), ` +
    `${photos.assets.skipped} cached asset(s), ` +
    `${photos.assets.removed} stale item(s) removed.`,
);
console.log(
  `Synced shared components: ${sharedComponents.length} file(s) updated.`,
);
console.log(`Built dist/: ${copiedPaths} public path(s) copied.`);
