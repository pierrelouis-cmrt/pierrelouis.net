// scripts/buildCssVersioned.mjs
// -----------------------------------------------------------------------------
// One script, two modes:
//   • Production  (default) → output-vNNN.css  + minified  + full cache‑bust
//   • Development ( --dev ) → output-dev.css    *no* versioning, keeps dev fast
//
// Production mode additionally removes old versioned CSS files.
// Both modes re‑link *every* HTML file – single‑ or double‑quoted, absolute or
// relative – to the freshly‑chosen CSS file.
//
// Requires Node ≥ 18 (ESM) plus Tailwind CLI and `glob` (npm i -D glob).
// -----------------------------------------------------------------------------

import { readFile, writeFile, readdir, unlink } from "fs/promises";
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
if (devMode) {
  outFile = "src/output-dev.css";
} else {
  const VERSION_FILE = path.join(root, ".css-version");
  let version = 1;
  try {
    version = parseInt(await readFile(VERSION_FILE, "utf8"), 10) + 1;
  } catch {
    /* first run – keep 1 */
  }
  await writeFile(VERSION_FILE, String(version), "utf8");
  const tag = String(version).padStart(3, "0");
  outFile = `src/output-v${tag}.css`;

  /* ----- Remove stale versioned files ------------------------------------ */
  for (const file of await glob("src/output-v*.css", {
    cwd: root,
    absolute: true,
  })) {
    await unlink(file);
    console.log("✖  removed", path.relative(root, file));
  }
}

/* ---------- Build Tailwind CSS ------------------------------------------- */
console.log(`◆ Building Tailwind → ${outFile}`);
execSync(
  `npx tailwindcss -i ./src/styles.css -o ./${outFile}` +
    (devMode ? "" : " --minify"),
  { stdio: "inherit" }
);

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

for await (const file of walk(root)) {
  const html = await readFile(file, "utf8");
  const updated = html.replace(cssLinkPattern, `href="/${outFile}"`);
  if (updated !== html) {
    await writeFile(file, updated);
    console.log("✔  linked", path.relative(root, file));
  }
}

console.log(`✔  CSS ${devMode ? "dev" : "cache"} build complete: /${outFile}`);
