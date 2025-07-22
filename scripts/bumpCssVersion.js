// scripts/bumpCssVersion.js
// -----------------------------------------------------------------------------
// Increment a build counter and append it to every <link href="/src/output.css">
// in all HTML files.  Requires Node ≥ 18 (ESM).
// -----------------------------------------------------------------------------

import { readFile, writeFile, readdir } from "fs/promises";
import { statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* ---------- Locate repo root ---------------------------------------------- */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/* ---------- Counter file --------------------------------------------------- */
const VERSION_FILE = path.join(root, ".css-version");

let version = 1;
try {
  version = parseInt(await readFile(VERSION_FILE, "utf8"), 10) + 1;
} catch {
  /* file doesn’t exist on first run — keep version = 1 */
}
const tag = String(version).padStart(3, "0");
await writeFile(VERSION_FILE, String(version), "utf8");

/* ---------- Recursively walk repo for .html files -------------------------- */
async function* walk(dir) {
  for (const entry of await readdir(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (entry.endsWith(".html")) {
      yield full;
    }
  }
}

/* ---------- Update every HTML file ---------------------------------------- */
const cssRegex = /href="\/src\/output\.css(?:\?[^"]*)?"/g;

for await (const file of walk(root)) {
  const html = await readFile(file, "utf8");
  const updated = html.replace(cssRegex, `href="/src/output.css?${tag}"`);
  if (updated !== html) {
    await writeFile(file, updated);
    console.log("✔  cache-busted", path.relative(root, file));
  }
}

console.log(`✔  CSS cache tag bumped to ?${tag}`);
