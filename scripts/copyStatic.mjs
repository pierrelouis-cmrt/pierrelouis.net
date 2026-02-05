// scripts/copyStatic.mjs
// ---------------------------------------------------------------------------
// Copies static assets that Vite does not bundle to the dist folder.
// This keeps legacy absolute/relative paths working (e.g. /src/assets/*).
// ---------------------------------------------------------------------------

import { copyFile, cp, mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { transform } from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const outArgIndex = process.argv.indexOf("--out");
const outRoot =
  outArgIndex !== -1 && process.argv[outArgIndex + 1]
    ? path.resolve(root, process.argv[outArgIndex + 1])
    : path.join(root, "dist");

const logCopy = (label, src, dest) => {
  console.log(
    `OK ${label}: ${path.relative(root, src)} -> ${path.relative(root, dest)}`
  );
};

const warnMissing = (label, src) => {
  console.warn(`WARN: ${label} missing at ${path.relative(root, src)}`);
};

const isJsLike = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".js" || ext === ".mjs";
};

const writeMinifiedJs = async (src, dest) => {
  const source = await readFile(src, "utf8");
  const minified = await transform(source, {
    loader: "js",
    minify: true,
    target: "es2018",
    legalComments: "none",
  });
  await writeFile(dest, minified.code);
};

const copyFileSafe = async (src, dest, label) => {
  try {
    await mkdir(path.dirname(dest), { recursive: true });
    if (isJsLike(dest)) {
      await writeMinifiedJs(src, dest);
    } else {
      await copyFile(src, dest);
    }
    logCopy(label, src, dest);
  } catch (error) {
    if (error?.code === "ENOENT") {
      warnMissing(label, src);
      return;
    }
    throw error;
  }
};

const copyDirSafe = async (src, dest, label) => {
  try {
    await cp(src, dest, { recursive: true, force: true });
    logCopy(label, src, dest);
  } catch (error) {
    if (error?.code === "ENOENT") {
      warnMissing(label, src);
      return;
    }
    throw error;
  }
};

const copySrcJs = async () => {
  const srcDir = path.join(root, "src");
  let entries = [];
  try {
    entries = await readdir(srcDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      warnMissing("src", srcDir);
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    const src = path.join(srcDir, entry.name);
    const dest = path.join(outRoot, "src", entry.name);
    await copyFileSafe(src, dest, "src js");
  }
};

const copyNowAssets = async () => {
  const nowDir = path.join(root, "now");
  let entries = [];
  try {
    entries = await readdir(nowDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      warnMissing("now", nowDir);
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.endsWith(".html")) continue;
    const src = path.join(nowDir, entry.name);
    const dest = path.join(outRoot, "now", entry.name);
    await copyFileSafe(src, dest, "now asset");
  }
};

const ROOT_FILES = [
  ".htaccess",
  "android-chrome-192x192.png",
  "android-chrome-256x256.png",
  "apple-touch-icon.png",
  "browserconfig.xml",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "favicon.ico",
  "mstile-150x150.png",
  "robots.txt",
  "safari-pinned-tab.svg",
  "site.webmanifest",
  "sitemap.xml",
];

const DIRS_TO_COPY = [
  { src: "api", dest: "api", label: "api" },
  { src: "now/lowres", dest: "now/lowres", label: "now lowres" },
  { src: "photos/pics", dest: "photos/pics", label: "photos pics" },
  { src: "projects/screenshots", dest: "projects/screenshots", label: "project screenshots" },
  { src: "posts/assets", dest: "posts/assets", label: "post assets" },
  { src: "src/assets", dest: "src/assets", label: "src assets" },
];

const FILES_TO_COPY = [
  { src: "photos/photos.js", dest: "photos/photos.js", label: "photos js" },
  { src: "bookmarks/bookmarks.js", dest: "bookmarks/bookmarks.js", label: "bookmarks js" },
  { src: "posts/posts.js", dest: "posts/posts.js", label: "posts js" },
  { src: "posts/posts.json", dest: "posts/posts.json", label: "posts json" },
];

await mkdir(outRoot, { recursive: true });

for (const file of ROOT_FILES) {
  await copyFileSafe(path.join(root, file), path.join(outRoot, file), "root file");
}

for (const entry of FILES_TO_COPY) {
  await copyFileSafe(
    path.join(root, entry.src),
    path.join(outRoot, entry.dest),
    entry.label
  );
}

for (const dir of DIRS_TO_COPY) {
  await copyDirSafe(
    path.join(root, dir.src),
    path.join(outRoot, dir.dest),
    dir.label
  );
}

await copySrcJs();
await copyNowAssets();
