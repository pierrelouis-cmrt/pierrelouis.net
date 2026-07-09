import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPhotos } from "./build-photos.mjs";
import { startSiteServer } from "./site-server.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8000);

const shouldRebuild = (filename) => {
  return (
    filename.startsWith("content/photos/") ||
    filename === "scripts/build-photos.mjs"
  );
};

const shouldIgnore = (filename) => {
  return (
    filename.startsWith(".git/") ||
    filename.startsWith("node_modules/") ||
    filename.startsWith(".playwright") ||
    filename.startsWith("assets/photos/") ||
    filename === "photos/index.html" ||
    filename === "photos/photos-data.json"
  );
};

let timer;
let isBuilding = false;

const queue = (filename, reload) => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (isBuilding) {
      return;
    }

    isBuilding = true;

    try {
      if (shouldRebuild(filename)) {
        const result = await buildPhotos();
        console.log(
          `Rebuilt photos: ${result.collections} collection(s), ${result.photos} photo(s), ` +
            `${result.assets.generated} generated asset(s), ` +
            `${result.assets.skipped} cached asset(s), ` +
            `${result.assets.removed} stale item(s) removed.`,
        );
      }

      reload();
    } catch (error) {
      console.error(error.message);
    } finally {
      isBuilding = false;
    }
  }, 120);
};

const initial = await buildPhotos();
const site = await startSiteServer({ dev: true, port: PORT });

console.log(
  `Built photos: ${initial.collections} collection(s), ${initial.photos} photo(s), ` +
    `${initial.assets.generated} generated asset(s), ` +
    `${initial.assets.skipped} cached asset(s), ` +
    `${initial.assets.removed} stale item(s) removed.`,
);
console.log(`Dev server: http://${site.host}:${site.port}/photos/`);

watch(ROOT, { recursive: true }, (eventType, rawFilename) => {
  if (!rawFilename) {
    return;
  }

  const filename = rawFilename.split(path.sep).join("/");

  if (shouldIgnore(filename)) {
    return;
  }

  queue(filename, site.reload);
});
