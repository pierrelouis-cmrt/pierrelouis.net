import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLists } from "./build-lists.mjs";
import { buildPhotos } from "./build-photos.mjs";
import { buildPosts } from "./build-posts.mjs";
import { buildProjects } from "./build-projects.mjs";
import { syncSharedComponents } from "./shared-components.mjs";
import { startSiteServer } from "./site-server.mjs";
import {
  syncAndBuildLists,
  VAULT_LISTS_DIR,
} from "./vault-lists.mjs";
import {
  syncAndBuildPosts,
  VAULT_POSTS_DIR,
} from "./vault-posts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8000);
const VAULT_LISTS_CHANGE = "@vault/lists";
const VAULT_POSTS_CHANGE = "@vault/posts";

const shouldRebuildLists = (filename) => {
  return (
    filename === VAULT_LISTS_CHANGE ||
    filename === "content/lists" ||
    filename.startsWith("content/lists/") ||
    filename.startsWith("lists/sheets/") ||
    filename === "lists/index.html" ||
    filename === "scripts/build-lists.mjs" ||
    filename === "scripts/lib/list-markdown.mjs" ||
    filename === "scripts/vault-lists.mjs"
  );
};

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

const shouldRebuildPosts = (filename) => {
  return (
    filename === VAULT_POSTS_CHANGE ||
    filename.startsWith("content/posts/") ||
    filename.startsWith("posts/headers/") ||
    filename.startsWith("posts/components/") ||
    filename === "eleventy.config.mjs" ||
    filename === "scripts/build-posts.mjs" ||
    filename === "scripts/lib/post-markdown.mjs" ||
    filename === "scripts/lib/posts.mjs"
  );
};

const shouldSyncSharedComponents = (filename) => {
  return filename === "scripts/shared-components.mjs";
};

const shouldIgnore = (filename) => {
  return (
    filename.startsWith(".git/") ||
    filename.startsWith(".dist-tmp-") ||
    filename.startsWith("dist/") ||
    filename.startsWith("node_modules/") ||
    filename.startsWith(".playwright") ||
    filename.startsWith("content/.articles-backup-") ||
    filename.startsWith("content/.lists-backup-") ||
    filename.startsWith("content/.lists-sync-") ||
    filename.startsWith("content/posts/.articles-sync-") ||
    filename === "content/posts/articles" ||
    filename.startsWith("content/posts/articles/") ||
    filename.startsWith("assets/projects/") ||
    filename.startsWith("assets/photos/") ||
    filename.startsWith("posts/assets/") ||
    filename === "posts/index.html" ||
    /^posts\/(?!headers\/|components\/)[^/]+\/index\.html$/.test(filename) ||
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
      queue(filename, reload);
      return;
    }

    isBuilding = true;

    try {
      const rebuildPhotos = shouldRebuildPhotos(filename);
      const rebuildProjects = shouldRebuildProjects(filename);
      const rebuildLists = shouldRebuildLists(filename);
      const rebuildPosts = shouldRebuildPosts(filename);
      const syncVaultPosts = filename === VAULT_POSTS_CHANGE;
      const syncVaultLists = filename === VAULT_LISTS_CHANGE;

      if (rebuildLists) {
        const result = syncVaultLists
          ? await syncAndBuildLists()
          : await buildLists();
        console.log(
          `${syncVaultLists ? "Synced and rebuilt" : "Rebuilt"} Lists: ${result.sheets} sheet(s), ${result.sources} Markdown source(s)${
            result.changed ? "" : " (unchanged)"
          }.`,
        );
      }

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
            `${result.assets.removed} stale asset(s) removed, ` +
            `${result.caseStudies.total} project page(s).`,
        );
      }

      if (rebuildPosts) {
        const result = syncVaultPosts
          ? await syncAndBuildPosts()
          : await buildPosts();
        console.log(
          `${syncVaultPosts ? "Synced and rebuilt" : "Rebuilt"} posts: ${result.posts} page(s), ` +
            `${result.removed} stale page(s) removed, ` +
            `${result.warnings.length} warning(s).`,
        );
      }

      if (
        rebuildLists ||
        rebuildPhotos ||
        rebuildProjects ||
        rebuildPosts ||
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

const initialLists = await syncAndBuildLists();
const initialProjects = await buildProjects();
const initialPhotos = await buildPhotos();
const initialPosts = await syncAndBuildPosts();
await syncSharedComponents();
const site = await startSiteServer({ dev: true, host: HOST, port: PORT });

console.log(
  `Built Lists: ${initialLists.sheets} sheet(s), ${initialLists.sources} Markdown source(s)${
    initialLists.changed ? "" : " (unchanged)"
  }.`,
);
if (initialLists.source) {
  console.log(
    `Synced ${initialLists.synced} list source(s) from ${initialLists.source}.`,
  );
}
console.log(
  `Built projects: ${initialProjects.featured} featured, ` +
    `${initialProjects.playground} playground (${initialProjects.total} total), ` +
  `${initialProjects.assets.generated} generated, ` +
  `${initialProjects.assets.skipped} cached, ` +
  `${initialProjects.assets.removed} stale asset(s) removed, ` +
  `${initialProjects.caseStudies.total} project page(s).`,
);
console.log(
  `Built photos: ${initialPhotos.collections} collection(s), ${initialPhotos.photos} photo(s), ` +
    `${initialPhotos.assets.generated} generated asset(s), ` +
    `${initialPhotos.assets.skipped} cached asset(s), ` +
    `${initialPhotos.assets.removed} stale item(s) removed.`,
);
console.log(
  `Built posts: ${initialPosts.posts} page(s), ` +
    `${initialPosts.removed} stale page(s) removed, ` +
    `${initialPosts.warnings.length} warning(s).`,
);
if (initialPosts.source) {
  console.log(
    `Synced ${initialPosts.synced} post(s) from ${initialPosts.source}.`,
  );
}
console.log(`Dev server:\n  Local:   ${site.localUrl}`);
for (const url of site.networkUrls) {
  console.log(`  Network: ${url}`);
}

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

if (initialPosts.source) {
  watch(VAULT_POSTS_DIR, { recursive: true }, (eventType, rawFilename) => {
    if (rawFilename && path.basename(rawFilename) === ".DS_Store") {
      return;
    }

    queue(VAULT_POSTS_CHANGE, site.reload);
  });

  console.log(`Watching Obsidian posts: ${VAULT_POSTS_DIR}`);
}

if (initialLists.source) {
  watch(VAULT_LISTS_DIR, { recursive: true }, (eventType, rawFilename) => {
    if (rawFilename && path.basename(rawFilename) === ".DS_Store") {
      return;
    }

    queue(VAULT_LISTS_CHANGE, site.reload);
  });

  console.log(`Watching Obsidian lists: ${VAULT_LISTS_DIR}`);
}
