import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPhotos } from "./build-photos.mjs";
import { buildProjects } from "./build-projects.mjs";
import { syncSharedComponents } from "./shared-components.mjs";
import { startSiteServer } from "./site-server.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8000);

const shouldRebuildPhotos = (filename) => {
  return (
    filename.startsWith("content/photos/") ||
    filename === "scripts/build-photos.mjs" ||
    filename === "scripts/lib/yaml.mjs"
  );
};

const shouldRebuildProjects = (filename) => {
  return (
    filename.startsWith("content/projects/") ||
    filename === "scripts/build-projects.mjs" ||
    filename === "scripts/lib/image-dimensions.mjs" ||
    filename === "scripts/lib/yaml.mjs"
  );
};

const shouldSyncSharedComponents = (filename) => {
  return filename.endsWith(".html") || filename === "scripts/shared-components.mjs";
};

const shouldIgnore = (filename) => {
  return (
    filename.startsWith(".git/") ||
    filename.startsWith(".dist-tmp-") ||
    filename.startsWith("dist/") ||
    filename.startsWith("node_modules/") ||
    filename.startsWith(".playwright") ||
    filename.startsWith("assets/projects/") ||
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
      const rebuildPhotos = shouldRebuildPhotos(filename);
      const rebuildProjects = shouldRebuildProjects(filename);

      if (rebuildPhotos) {
        const result = await buildPhotos();
        console.log(
          `Rebuilt photos: ${result.collections} collection(s), ${result.photos} photo(s), ` +
            `${result.assets.generated} generated asset(s), ` +
            `${result.assets.skipped} cached asset(s), ` +
            `${result.assets.removed} stale item(s) removed.`,
        );
      }

      if (rebuildProjects) {
        const result = await buildProjects();
        console.log(
          `Rebuilt projects: ${result.featured} featured, ` +
            `${result.playground} playground (${result.total} total), ` +
            `${result.assets.generated} generated, ${result.assets.skipped} cached, ` +
            `${result.assets.removed} stale asset(s) removed.`,
        );
      }

      if (
        rebuildPhotos ||
        rebuildProjects ||
        shouldSyncSharedComponents(filename)
      ) {
        const changed = await syncSharedComponents();

        if (changed.length > 0) {
          console.log(`Synced shared components: ${changed.join(", ")}.`);
        }
      }

      reload();
    } catch (error) {
      console.error(error.message);
    } finally {
      isBuilding = false;
    }
  }, 120);
};

const initialProjects = await buildProjects();
const initialPhotos = await buildPhotos();
await syncSharedComponents();
const site = await startSiteServer({ dev: true, port: PORT });

console.log(
  `Built projects: ${initialProjects.featured} featured, ` +
    `${initialProjects.playground} playground (${initialProjects.total} total), ` +
    `${initialProjects.assets.generated} generated, ` +
    `${initialProjects.assets.skipped} cached, ` +
    `${initialProjects.assets.removed} stale asset(s) removed.`,
);
console.log(
  `Built photos: ${initialPhotos.collections} collection(s), ${initialPhotos.photos} photo(s), ` +
    `${initialPhotos.assets.generated} generated asset(s), ` +
    `${initialPhotos.assets.skipped} cached asset(s), ` +
    `${initialPhotos.assets.removed} stale item(s) removed.`,
);
console.log(`Dev server: http://${site.host}:${site.port}/`);

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
