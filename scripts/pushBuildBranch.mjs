// scripts/pushBuildBranch.mjs
// -----------------------------------------------------------------------------
// Sync the current working tree into a temporary worktree on the build branch,
// commit if needed, and push to the configured remote.
//
// Defaults:
//   branch = build (override with --branch or BUILD_BRANCH)
//   remote = origin (override with --remote or BUILD_REMOTE)
// -----------------------------------------------------------------------------

import { execSync } from "child_process";
import { copyFile, lstat, mkdir, readlink, symlink, unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};

const branch = getArg("--branch") || process.env.BUILD_BRANCH || "build";
const remote = getArg("--remote") || process.env.BUILD_REMOTE || "origin";

const runId = Date.now().toString();
const worktreeDir = path.join(root, "_cache", `build-worktree-${runId}`);

const run = (cmd, opts = {}) =>
  execSync(cmd, { cwd: root, stdio: "inherit", ...opts });
const capture = (cmd, opts = {}) =>
  execSync(cmd, { cwd: root, encoding: "utf8", ...opts }).trim();
const ok = (cmd) => {
  try {
    execSync(cmd, { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const safeUnlink = async (filePath) => {
  try {
    await unlink(filePath);
  } catch {
    /* ignore */
  }
};

const copyFileSmart = async (src, dest) => {
  const st = await lstat(src);
  if (st.isSymbolicLink()) {
    const link = await readlink(src);
    await safeUnlink(dest);
    await symlink(link, dest);
    return;
  }
  await copyFile(src, dest);
};

await mkdir(path.join(root, "_cache"), { recursive: true });

try {
  try {
    execSync(`git fetch --quiet ${remote} ${branch}`, {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    /* ok if branch doesn't exist yet */
  }

  const hasLocalBranch = ok(
    `git show-ref --verify --quiet refs/heads/${branch}`
  );
  const hasRemoteBranch = ok(
    `git show-ref --verify --quiet refs/remotes/${remote}/${branch}`
  );

  if (hasLocalBranch) {
    run(`git worktree add "${worktreeDir}" "${branch}"`);
  } else if (hasRemoteBranch) {
    run(`git worktree add -b "${branch}" "${worktreeDir}" "${remote}/${branch}"`);
  } else {
    run(`git worktree add -b "${branch}" "${worktreeDir}" HEAD`);
  }

  const sourceList = capture("git ls-files -co --exclude-standard");
  const sourceFiles = sourceList ? sourceList.split("\n") : [];
  const sourceSet = new Set(sourceFiles);

  const worktreeList = execSync(`git -C "${worktreeDir}" ls-files`, {
    encoding: "utf8",
  }).trim();
  const worktreeFiles = worktreeList ? worktreeList.split("\n") : [];

  for (const file of worktreeFiles) {
    if (!sourceSet.has(file)) {
      await safeUnlink(path.join(worktreeDir, file));
    }
  }

  for (const file of sourceFiles) {
    const src = path.join(root, file);
    const dest = path.join(worktreeDir, file);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFileSmart(src, dest);
  }

  run(`git -C "${worktreeDir}" add -A`);

  const status = execSync(`git -C "${worktreeDir}" status --porcelain`, {
    encoding: "utf8",
  }).trim();

  if (status) {
    const shortSha = capture("git rev-parse --short HEAD");
    const timestamp = new Date().toISOString().replace("T", " ").replace("Z", "");
    const msg = `build: sync from ${shortSha} (${timestamp})`.replace(/"/g, '\\"');
    run(`git -C "${worktreeDir}" commit -m "${msg}"`);
  } else {
    console.log("✔ build branch already up to date");
  }

  run(`git -C "${worktreeDir}" push -u "${remote}" "${branch}"`);
} finally {
  try {
    run(`git worktree remove --force "${worktreeDir}"`);
  } catch {
    /* ignore cleanup errors */
  }
}
