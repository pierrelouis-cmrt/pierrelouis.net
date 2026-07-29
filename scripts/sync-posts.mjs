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
import { runPostQa } from "./qa-posts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_VAULT_POSTS = path.resolve(
  "/Users/pierrelouis/Documents/Obsidian/Main Vault/Writing/Final Versions",
);
const SOURCE_DIR = path.resolve(
  process.env.OBSIDIAN_POSTS_DIR || DEFAULT_VAULT_POSTS,
);
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

const assertDirectory = async (directory, label) => {
  try {
    const value = await stat(directory);

    if (!value.isDirectory()) {
      throw new Error(`${label} is not a directory: ${directory}`);
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`${label} does not exist: ${directory}`);
    }
    throw error;
  }
};

const mirrorVaultPosts = async () => {
  await assertDirectory(SOURCE_DIR, "Obsidian post source");
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

export const syncPosts = async ({ qa = true } = {}) => {
  const mirrored = await mirrorVaultPosts();

  try {
    const build = await buildPosts();
    const visualQa = qa
      ? await runPostQa({ build: false, changedOnly: true })
      : null;

    await rm(BACKUP_DIR, { force: true, recursive: true });

    return {
      build,
      source: SOURCE_DIR,
      synced: mirrored.candidate.posts.length,
      visualQa,
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

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const result = await syncPosts({
    qa: !process.argv.includes("--skip-qa"),
  });
  console.log(
    `Synced ${result.synced} post(s) from ${result.source}. Built ${result.build.posts} page(s).`,
  );

  if (result.visualQa) {
    console.log(
      `Visual QA: ${result.visualQa.checked} checked, ${result.visualQa.cached} cached.`,
    );
  }
}
