import { buildPhotos } from "./build-photos.mjs";
import { buildProjects } from "./build-projects.mjs";
import { syncSharedComponents } from "./shared-components.mjs";

const projects = await buildProjects();
const photos = await buildPhotos();
const sharedComponents = await syncSharedComponents();

console.log(
  `Built projects page: ${projects.featured} featured, ` +
    `${projects.playground} playground (${projects.total} total).`,
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
