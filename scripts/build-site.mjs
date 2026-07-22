import { buildPhotos } from "./build-photos.mjs";
import { syncSharedComponents } from "./shared-components.mjs";

const photos = await buildPhotos();
const sharedComponents = await syncSharedComponents();

console.log(
  `Built photos page: ${photos.collections} collection(s), ${photos.photos} photo(s), ` +
    `${photos.assets.generated} generated asset(s), ` +
    `${photos.assets.skipped} cached asset(s), ` +
    `${photos.assets.removed} stale item(s) removed.`,
);
console.log(
  `Synced shared components: ${sharedComponents.length} file(s) updated.`,
);
