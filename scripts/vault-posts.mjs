import {
  cp,
  mkdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPosts } from "./build-posts.mjs";
import {
  POST_ARTICLES_DIR,
  loadPostManifest,
} from "./lib/posts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_VAULT_POSTS = path.resolve(
  "/Users/pierrelouis/Documents/Obsidian/Main Vault/Portfolio/Posts",
);
const SOURCE_DIR = path.resolve(
  process.env.OBSIDIAN_POSTS_DIR || DEFAULT_VAULT_POSTS,
);
export const VAULT_POSTS_DIR = SOURCE_DIR;
const TEMP_DIR = path.join(
  ROOT,
  "content/posts",
  `.articles-sync-${process.pid}`,
);
const BACKUP_DIR = path.join(
  ROOT,
  "content",
  `.articles-backup-${process.pid}`,
);

const rebuildRestoredPosts = () =>
  new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(ROOT, "scripts/build-posts.mjs")],
      {
        cwd: ROOT,
        stdio: "inherit",
      },
    );

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `restored post build was terminated by ${signal}`
            : `restored post build exited with code ${code}`,
        ),
      );
    });
  });

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

const mirrorVaultPosts = async () => {
  await rm(TEMP_DIR, { force: true, recursive: true });
  await mkdir(TEMP_DIR, { recursive: true });

  try {
    await cp(SOURCE_DIR, TEMP_DIR, {
      filter: (source) => path.basename(source) !== ".DS_Store",
      recursive: true,
    });
    const candidate = await loadPostManifest({ articlesDir: TEMP_DIR });

    await rm(BACKUP_DIR, { force: true, recursive: true });

    let hadPreviousMirror = true;

    try {
      await rename(POST_ARTICLES_DIR, BACKUP_DIR);
    } catch (error) {
      if (error.code === "ENOENT") {
        hadPreviousMirror = false;
      } else {
        throw error;
      }
    }

    try {
      await rename(TEMP_DIR, POST_ARTICLES_DIR);
    } catch (error) {
      try {
        await rename(BACKUP_DIR, POST_ARTICLES_DIR);
      } catch {
        // The original error is more useful; the backup remains on disk.
      }
      throw error;
    }

    return { candidate, hadPreviousMirror };
  } finally {
    await rm(TEMP_DIR, { force: true, recursive: true });
  }
};

export const syncAndBuildPosts = async () => {
  const sourceExists = await directoryExists(
    SOURCE_DIR,
    "Obsidian post source",
  );

  if (!sourceExists) {
    if (process.env.OBSIDIAN_POSTS_DIR) {
      throw new Error(`Obsidian post source does not exist: ${SOURCE_DIR}`);
    }

    return {
      ...(await buildPosts()),
      source: null,
      synced: null,
    };
  }

  const mirrored = await mirrorVaultPosts();

  try {
    const build = await buildPosts();

    await rm(BACKUP_DIR, { force: true, recursive: true });

    return {
      ...build,
      source: SOURCE_DIR,
      synced: mirrored.candidate.posts.length,
    };
  } catch (error) {
    let rollbackError = null;

    try {
      await rm(POST_ARTICLES_DIR, { force: true, recursive: true });

      if (mirrored.hadPreviousMirror) {
        await rename(BACKUP_DIR, POST_ARTICLES_DIR);
        await rebuildRestoredPosts();
      }
    } catch (failure) {
      rollbackError = failure;
    }

    if (rollbackError) {
      throw new Error(
        `${error.message}\nPost mirror rollback also failed: ${rollbackError.message}. Backup location: ${BACKUP_DIR}`,
      );
    }

    throw error;
  }
};
