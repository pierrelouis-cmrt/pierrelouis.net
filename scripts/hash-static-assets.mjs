import { createHash } from "node:crypto";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const HASHED_EXTENSIONS = new Set([".css", ".js"]);
const REFERENCE_EXTENSIONS = new Set([".css", ".html", ".js"]);

const walkFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
};

const toPosixPath = (value) => value.split(path.sep).join("/");

const replaceAssetReferences = (contents, sourcePath, assets) => {
  const sourceDirectory = path.posix.dirname(sourcePath);
  const references = [...assets].map(([originalPath, hashedPath]) => ({
    hashedPath,
    hashedRelativePath: path.posix.relative(sourceDirectory, hashedPath),
    originalPath,
    originalRelativePath: path.posix.relative(sourceDirectory, originalPath),
  }));
  let updated = contents;

  references.sort(
    (a, b) => b.originalRelativePath.length - a.originalRelativePath.length,
  );

  for (const reference of references) {
    const {
      hashedPath,
      hashedRelativePath,
      originalPath,
      originalRelativePath,
    } = reference;
    updated = updated.replaceAll(`/${originalPath}`, `/${hashedPath}`);

    if (originalRelativePath.startsWith(".")) {
      updated = updated.replaceAll(originalRelativePath, hashedRelativePath);
    } else {
      updated = updated.replaceAll(
        `./${originalRelativePath}`,
        `./${hashedRelativePath}`,
      );
    }
  }

  return updated;
};

export const hashStaticAssets = async (directory) => {
  const files = await walkFiles(directory);
  const assetContents = new Map();
  const assets = new Map();

  for (const file of files) {
    const extension = path.extname(file).toLowerCase();

    if (!HASHED_EXTENSIONS.has(extension)) {
      continue;
    }

    const contents = await readFile(file, "utf8");
    const originalPath = toPosixPath(path.relative(directory, file));

    assetContents.set(originalPath, contents);
  }

  const hashedPathFor = (originalPath, contents) => {
    const hash = createHash("sha256")
      .update(contents)
      .digest("hex")
      .slice(0, 10);
    const parsedPath = path.posix.parse(originalPath);

    return path.posix.join(
      parsedPath.dir,
      `${parsedPath.name}-${hash}${parsedPath.ext}`,
    );
  };

  for (const [originalPath, contents] of assetContents) {
    assets.set(originalPath, hashedPathFor(originalPath, contents));
  }

  // A module's final bytes can include another asset's hashed filename. Resolve
  // those dependency hashes before writing anything so every filename matches
  // the exact content shipped to dist/.
  for (let pass = 0; pass <= assets.size; pass += 1) {
    let changed = false;

    for (const [originalPath, contents] of assetContents) {
      const updated = replaceAssetReferences(contents, originalPath, assets);
      const hashedPath = hashedPathFor(originalPath, updated);

      if (assets.get(originalPath) !== hashedPath) {
        assets.set(originalPath, hashedPath);
        changed = true;
      }
    }

    if (!changed) {
      break;
    }

    if (pass === assets.size) {
      throw new Error("Could not resolve circular CSS/JS asset references");
    }
  }

  for (const file of files) {
    const extension = path.extname(file).toLowerCase();

    if (!REFERENCE_EXTENSIONS.has(extension)) {
      continue;
    }

    const sourcePath = toPosixPath(path.relative(directory, file));
    const contents =
      assetContents.get(sourcePath) ?? (await readFile(file, "utf8"));
    const updated = replaceAssetReferences(contents, sourcePath, assets);
    const outputPath = assets.get(sourcePath) ?? sourcePath;

    await writeFile(path.join(directory, outputPath), updated);

    if (outputPath !== sourcePath) {
      await rm(file);
    }
  }

  return assets;
};
