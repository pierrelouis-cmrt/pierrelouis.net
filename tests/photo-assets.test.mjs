import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PHOTO_FULL_MAX_EDGE } from "../scripts/build-photos.mjs";
import { getImageDimensions } from "../scripts/lib/image-dimensions.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PHOTOS_DIR = path.join(ROOT, "photos");
const FULL_ASSETS_DIR = path.join(ROOT, "assets", "photos-full");

test("generated lightbox photos exist and respect the display-size limit", async () => {
  const collections = JSON.parse(
    await readFile(path.join(PHOTOS_DIR, "photos-data.json"), "utf8"),
  );
  const photos = collections.flatMap((collection) => collection.photos);

  assert.ok(photos.length > 0, "expected at least one generated photo");

  for (const photo of photos) {
    const fullPath = path.resolve(PHOTOS_DIR, photo.fullSrc);

    assert.ok(
      fullPath.startsWith(`${FULL_ASSETS_DIR}${path.sep}`),
      `${photo.id} points outside the lightbox asset directory`,
    );
    await access(fullPath);

    const dimensions = await getImageDimensions(fullPath);
    assert.ok(
      Math.max(dimensions.width, dimensions.height) <= PHOTO_FULL_MAX_EDGE,
      `${photo.id} is ${dimensions.width}x${dimensions.height}; expected a maximum edge of ${PHOTO_FULL_MAX_EDGE}px`,
    );
  }
});
