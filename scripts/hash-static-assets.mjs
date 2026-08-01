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
    updated = updated
      .replaceAll(`/${originalPath}`, `/${hashedPath}`)
      .replaceAll(originalRelativePath, hashedRelativePath);

    if (!originalRelativePath.startsWith(".")) {
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

    const contents = await readFile(file);
    const hash = createHash("sha256").update(contents).digest("hex").slice(0, 10);
    const originalPath = toPosixPath(path.relative(directory, file));
    const parsedPath = path.posix.parse(originalPath);
    const hashedPath = path.posix.join(
      parsedPath.dir,
      `${parsedPath.name}-${hash}${parsedPath.ext}`,
    );

    assetContents.set(originalPath, contents.toString("utf8"));
    assets.set(originalPath, hashedPath);
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
