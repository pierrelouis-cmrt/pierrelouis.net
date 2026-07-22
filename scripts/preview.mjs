import { buildPhotos } from "./build-photos.mjs";
import { syncSharedComponents } from "./shared-components.mjs";
import { startSiteServer } from "./site-server.mjs";

const PORT = Number(process.env.PORT || 4173);
const result = await buildPhotos();
await syncSharedComponents();
const site = await startSiteServer({ dev: false, port: PORT });

console.log(`Built photos: ${result.collections} collection(s), ${result.photos} photo(s).`);
console.log(`Preview server: http://${site.host}:${site.port}/photos/`);
