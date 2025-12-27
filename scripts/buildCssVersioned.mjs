// scripts/buildCssVersioned.mjs
// -----------------------------------------------------------------------------
// One script, two modes:
//   • Production  (default) → output‑<hash>.css + minified + full cache‑bust.
//     ‑‑ Also removes all stale css: any output‑*.css and output‑dev.css.
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
import { createHash } from "crypto";

/* ---------- Flags --------------------------------------------------------- */
const devMode = process.argv.includes("--dev");

/* ---------- Locate repo root --------------------------------------------- */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/* ---------- Pick output file & hash -------------------------------------- */
let outFile;
let currentHash = "";
let currentHashPath = null;
if (devMode) {
  outFile = "src/output-dev.css";
} else {
  // In production mode we will build to a temp file first, compare with
  // the latest hashed CSS (if any), and only relink when the content
  // actually changed. This avoids noisy commits.
  const existingHashes = (await glob("src/output-*.css", {
    cwd: root,
    absolute: true,
  })).filter((file) => path.basename(file) !== "output-dev.css");
  if (existingHashes.length > 0) {
    existingHashes.sort(
      (a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs
    );
    currentHashPath = existingHashes[0];
    const match = /output-([a-z0-9]+)\.css$/i.exec(
      path.basename(currentHashPath)
    );
    if (match) {
      currentHash = match[1];
    } else {
      currentHashPath = null;
    }
  }

  // Always build to a temporary path first
  outFile = "src/.output-temp.css";
}

/* ---------- Build Tailwind CSS ------------------------------------------- */
console.log(`◆ Building Tailwind → ${outFile}`);
const tailwindEnv = {
  ...process.env,
  BROWSERSLIST_IGNORE_OLD_DATA:
    process.env.BROWSERSLIST_IGNORE_OLD_DATA || "1",
};
execSync(
  `npx tailwindcss -i ./src/styles.css -o ./${outFile}` +
    (devMode ? "" : " --minify"),
  { stdio: "inherit", env: tailwindEnv }
);

// If production: compare temp output to previous hash; defer decisions
let isSameAsCurrent = false;
let tempPath = null;
let tempBuffer = null;
let nextHash = "";
if (!devMode) {
  tempPath = path.join(root, outFile);
  tempBuffer = await readFile(tempPath);
  nextHash = createHash("sha256")
    .update(tempBuffer)
    .digest("hex")
    .slice(0, 10);
  if (currentHashPath && currentHash === nextHash) {
    try {
      await readFile(currentHashPath, "utf8");
      isSameAsCurrent = true;
    } catch {
      isSameAsCurrent = false;
    }
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
// Matches: href="/src/output.css" | 'src/output-1a2b3c4d5e.css?foo' | "output-dev.css"
const cssLinkPattern =
  /href=("|')[^"']*output(?:-[a-z0-9]+)?\.css[^"']*("|')/gi;
const devLinkPattern = /href=("|')[^"']*output-dev\.css[^"']*("|')/i;

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
  // If CSS content unchanged but pages point to output-dev.css, relink without bumping
  let anyDevLinked = false;
  for await (const file of walk(root)) {
    const html = await readFile(file, "utf8");
    if (devLinkPattern.test(html)) {
      anyDevLinked = true;
      break;
    }
  }

  if (isSameAsCurrent && currentHashPath) {
    // Remove temp file
    await rm(tempPath, { force: true });
    if (anyDevLinked) {
      const versionRel = `/${path.relative(root, currentHashPath)}`.replaceAll("\\\\", "/");
      for await (const file of walk(root)) {
        const html = await readFile(file, "utf8");
        const updated = html.replace(cssLinkPattern, `href=\"${versionRel}\"`);
        if (updated !== html) {
          await writeFile(file, updated);
          console.log("✔  linked", path.relative(root, file));
        }
      }
      try { await unlink(path.join(root, "src/output-dev.css")); } catch {}
      console.log("✔  CSS unchanged; relinked from dev to current hash");
    } else {
      console.log("✔  CSS unchanged; skipped hash update");
    }
    process.exit(0);
  }

  // Determine next hash, move temp to hashed name, clean stale, relink
  const finalOut = `src/output-${nextHash}.css`;

  // Remove stale hashed + dev files BEFORE we move the new one in place
  for (const file of await glob("src/output-*.css", {
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
  await writeFile(fsPath, tempBuffer);
  await rm(path.join(root, outFile), { force: true });

  // Relink HTML to the new hashed file
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
