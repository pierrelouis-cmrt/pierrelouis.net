// scripts/buildCssVersioned.mjs
// -----------------------------------------------------------------------------
// One script, two modes:
//   • Production  (default) → output‑vNNN.css  + minified  + full cache‑bust.
//     ‑‑ Also removes all stale css: any output‑v*.css and output‑dev.css.
//   • Development ( --dev ) → output‑dev.css no versioning, keeps dev fast.
//
// Both modes re‑link every HTML file – single‑ or double‑quoted, absolute or
// relative – to the freshly‑chosen CSS file, so nothing is ever missed.
//
// Requires Node ≥ 18 (ESM) plus Tailwind CLI and `glob` (npm i -D glob).
// -----------------------------------------------------------------------------

import { readFile, writeFile, readdir, unlink, rm } from "fs/promises";
import { statSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { glob } from "glob";

/* ---------- Flags --------------------------------------------------------- */
const devMode = process.argv.includes("--dev");

/* ---------- Locate repo root --------------------------------------------- */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/* ---------- Pick output file & version ----------------------------------- */
let outFile;
let currentVersion = 0;
let currentVersionPath = null;
if (devMode) {
  outFile = "src/output-dev.css";
} else {
  // In production mode we will build to a temp file first, compare with
  // the latest versioned CSS (if any), and only bump the version + relink
  // when the content actually changed. This avoids noisy commits.
  const VERSION_FILE = path.join(root, ".css-version");
  try {
    currentVersion = parseInt(await readFile(VERSION_FILE, "utf8"), 10) || 0;
  } catch {
    /* no version yet */
  }

  const currentTag = String(currentVersion).padStart(3, "0");
  currentVersionPath =
    currentVersion > 0 ? path.join(root, `src/output-v${currentTag}.css`) : null;

  // Always build to a temporary path first
  outFile = "src/.output-temp.css";
}

/* ---------- Build Tailwind CSS ------------------------------------------- */
console.log(`◆ Building Tailwind → ${outFile}`);
execSync(
  `npx tailwindcss -i ./src/styles.css -o ./${outFile}` +
    (devMode ? "" : " --minify"),
  { stdio: "inherit" }
);

// If production: compare temp output to previous version; skip if identical
if (!devMode) {
  const tempPath = path.join(root, outFile);
  let isSameAsCurrent = false;
  if (currentVersionPath) {
    try {
      const [a, b] = await Promise.all([
        readFile(tempPath, "utf8"),
        readFile(currentVersionPath, "utf8"),
      ]);
      isSameAsCurrent = a === b;
    } catch {
      // if read fails, treat as changed
      isSameAsCurrent = false;
    }
  }

  if (isSameAsCurrent) {
    // Nothing changed: remove temp file and exit without bump/link updates
    await rm(tempPath, { force: true });
    console.log("✔  CSS unchanged; skipped version bump and relink");
    process.exit(0);
  }
}

/* ---------- Recursively walk repo for .html & .htm files ------------------ */
async function* walk(dir) {
  for (const entry of await readdir(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (/\.html?$/i.test(entry)) yield full;
  }
}

/* ---------- Update every HTML file --------------------------------------- */
// Matches: href="/src/output.css" | 'src/output-v012.css?foo' | "output-dev.css"
const cssLinkPattern =
  /href=("|')[^"']*output(?:-v\d{3}|-dev)?\.css[^"']*("|')/gi;

if (devMode) {
  // Development: directly link to output-dev.css
  for await (const file of walk(root)) {
    const html = await readFile(file, "utf8");
    const updated = html.replace(cssLinkPattern, `href="/${outFile}"`);
    if (updated !== html) {
      await writeFile(file, updated);
      console.log("✔  linked", path.relative(root, file));
    }
  }
  console.log(`✔  CSS dev build complete: /${outFile}`);
} else {
  // Production: we have a temp build at src/.output-temp.css
  // Determine next version, move temp to versioned name, clean stale, relink
  const VERSION_FILE = path.join(root, ".css-version");
  let version = 1;
  try {
    version = parseInt(await readFile(VERSION_FILE, "utf8"), 10) + 1;
  } catch {
    /* first run – keep 1 */
  }
  await writeFile(VERSION_FILE, String(version), "utf8");
  const tag = String(version).padStart(3, "0");
  const finalOut = `src/output-v${tag}.css`;

  // Remove stale versioned + dev files BEFORE we move the new one in place
  for (const file of await glob("src/output-v*.css", {
    cwd: root,
    absolute: true,
  })) {
    await unlink(file);
    console.log("✖  removed", path.relative(root, file));
  }
  try {
    await unlink(path.join(root, "src/output-dev.css"));
  } catch {}

  // Move temp into final location
  const fsPath = path.join(root, finalOut);
  await writeFile(fsPath, await readFile(path.join(root, outFile)));
  await rm(path.join(root, outFile), { force: true });

  // Relink HTML to the new versioned file
  for await (const file of walk(root)) {
    const html = await readFile(file, "utf8");
    const updated = html.replace(cssLinkPattern, `href="/${finalOut}"`);
    if (updated !== html) {
      await writeFile(file, updated);
      console.log("✔  linked", path.relative(root, file));
    }
  }
  console.log(`✔  CSS cache build complete: /${finalOut}`);
}
