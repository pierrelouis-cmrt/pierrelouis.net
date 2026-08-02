import { cp, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLists, LISTS_CONTENT_DIR } from "./build-lists.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_VAULT_LISTS = path.resolve(
  "/Users/pierrelouis/Documents/Obsidian/Main Vault/Portfolio/Lists",
);
const SOURCE_DIR = path.resolve(
  process.env.OBSIDIAN_LISTS_DIR || DEFAULT_VAULT_LISTS,
);
export const VAULT_LISTS_DIR = SOURCE_DIR;
const TEMP_DIR = path.join(
  ROOT,
  "content",
  `.lists-sync-${process.pid}`,
);
const BACKUP_DIR = path.join(
  ROOT,
  "content",
  `.lists-backup-${process.pid}`,
);

const isDirectRun = () =>
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const directoryExists = async (directory, label) => {
  try {
    const value = await stat(directory);

    if (!value.isDirectory()) {
      throw new Error(`${label} is not a directory: ${directory}`);
    }

    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
};

const mirrorVaultLists = async () => {
  await rm(TEMP_DIR, { force: true, recursive: true });
  await mkdir(TEMP_DIR, { recursive: true });

  try {
    await cp(SOURCE_DIR, TEMP_DIR, {
      filter: (source) => path.basename(source) !== ".DS_Store",
      recursive: true,
    });

    await buildLists({
      contentDir: TEMP_DIR,
      write: false,
    });

    await rm(BACKUP_DIR, { force: true, recursive: true });

    let hadPreviousMirror = true;

    try {
      await rename(LISTS_CONTENT_DIR, BACKUP_DIR);
    } catch (error) {
      if (error.code === "ENOENT") {
        hadPreviousMirror = false;
      } else {
        throw error;
      }
    }

    try {
      await rename(TEMP_DIR, LISTS_CONTENT_DIR);
    } catch (error) {
      if (hadPreviousMirror) {
        await rename(BACKUP_DIR, LISTS_CONTENT_DIR);
      }

      throw error;
    }

    return { hadPreviousMirror };
  } finally {
    await rm(TEMP_DIR, { force: true, recursive: true });
  }
};

export const syncAndBuildLists = async () => {
  const sourceExists = await directoryExists(
    SOURCE_DIR,
    "Obsidian list source",
  );

  if (!sourceExists) {
    if (process.env.OBSIDIAN_LISTS_DIR) {
      throw new Error(`Obsidian list source does not exist: ${SOURCE_DIR}`);
    }

    return {
      ...(await buildLists()),
      source: null,
      synced: null,
    };
  }

  const mirrored = await mirrorVaultLists();

  try {
    const build = await buildLists();
    await rm(BACKUP_DIR, { force: true, recursive: true });

    return {
      ...build,
      source: SOURCE_DIR,
      synced: build.sources,
    };
  } catch (error) {
    await rm(LISTS_CONTENT_DIR, { force: true, recursive: true });

    if (mirrored.hadPreviousMirror) {
      await rename(BACKUP_DIR, LISTS_CONTENT_DIR);
      await buildLists();
    }

    throw error;
  }
};

if (isDirectRun()) {
  const result = await syncAndBuildLists();
  console.log(
    `Built Lists page: ${result.sheets} sheet(s), ${result.sources} Markdown source(s)${
      result.changed ? "" : " (unchanged)"
    }.`,
  );

  if (result.source) {
    console.log(`Synced ${result.synced} list source(s) from ${result.source}.`);
  }
}
