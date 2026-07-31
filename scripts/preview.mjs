import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startSiteServer } from "./site-server.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST_DIR = path.join(ROOT, "dist");
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4173);

try {
  const index = await stat(path.join(DIST_DIR, "index.html"));

  if (!index.isFile()) {
    throw new Error("dist/index.html is not a file");
  }
} catch {
  throw new Error(
    "No production build found in dist/. Run `npm run build` before previewing.",
  );
}

const site = await startSiteServer({
  dev: false,
  host: HOST,
  port: PORT,
  root: DIST_DIR,
});

console.log(`Preview server:\n  Local:   ${site.localUrl}`);
for (const url of site.networkUrls) {
  console.log(`  Network: ${url}`);
}
