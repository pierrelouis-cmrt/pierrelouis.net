import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { hashStaticAssets } from "../scripts/hash-static-assets.mjs";

const contentHash = (contents) =>
  createHash("sha256").update(contents).digest("hex").slice(0, 10);

test("hashes final CSS/JS bytes and updates production references", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "static-assets-"));
  t.after(() => rm(directory, { force: true, recursive: true }));

  await writeFile(
    path.join(directory, "index.html"),
    '<link rel="stylesheet" href="./site.css"><script type="module" src="./app.js"></script>',
  );
  await writeFile(path.join(directory, "site.css"), "body { color: navy; }\n");
  await writeFile(
    path.join(directory, "app.js"),
    'import value from "./dependency.js"; console.log(value);\n',
  );
  await writeFile(
    path.join(directory, "dependency.js"),
    'export default "app.js";\n',
  );

  await hashStaticAssets(directory);

  const filenames = await readdir(directory);
  const assetFilenames = filenames.filter((filename) => /\.(?:css|js)$/.test(filename));

  assert.equal(assetFilenames.length, 3);
  assert.equal(filenames.includes("app.js"), false);
  assert.equal(filenames.includes("site.css"), false);

  for (const filename of assetFilenames) {
    const contents = await readFile(path.join(directory, filename));
    assert.equal(filename.match(/-([a-f0-9]{10})\.(?:css|js)$/)?.[1], contentHash(contents));
  }

  const dependencyFilename = assetFilenames.find((filename) =>
    filename.startsWith("dependency-"),
  );
  const appFilename = assetFilenames.find((filename) => filename.startsWith("app-"));
  const app = await readFile(path.join(directory, appFilename), "utf8");
  const dependency = await readFile(path.join(directory, dependencyFilename), "utf8");
  const html = await readFile(path.join(directory, "index.html"), "utf8");

  assert.match(app, new RegExp(`\\./${dependencyFilename}`));
  assert.match(html, new RegExp(`\\./${appFilename}`));
  assert.equal(dependency, 'export default "app.js";\n');
});
