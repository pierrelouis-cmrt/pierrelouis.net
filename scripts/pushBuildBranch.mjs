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
const tryRun = (cmd) => {
  try {
    execSync(cmd, { cwd: root, stdio: "pipe" });
    return { ok: true, stdout: "", stderr: "" };
  } catch (err) {
    return {
      ok: false,
      stdout: err.stdout ? err.stdout.toString() : "",
      stderr: err.stderr ? err.stderr.toString() : "",
      error: err,
    };
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
  if (st.isDirectory()) return;
  if (st.isSymbolicLink()) {
    const link = await readlink(src);
    await safeUnlink(dest);
    await symlink(link, dest);
    return;
  }
  await copyFile(src, dest);
};

const getGitConfig = (repoDir, key) => {
  try {
    return execSync(`git -C "${repoDir}" config ${key}`, {
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
  } catch {
    return "";
  }
};

const setGitConfig = (repoDir, key, value) => {
  if (!value) return;
  execSync(`git -C "${repoDir}" config ${key} "${value.replace(/"/g, '\\"')}"`, {
    stdio: "ignore",
  });
};

const ensureIdentity = (repoDir) => {
  const existingName = getGitConfig(repoDir, "user.name");
  const existingEmail = getGitConfig(repoDir, "user.email");
  if (existingName && existingEmail) return;

  const name =
    process.env.BUILD_GIT_NAME ||
    process.env.GIT_AUTHOR_NAME ||
    process.env.GITHUB_ACTOR ||
    "github-actions[bot]";
  const email =
    process.env.BUILD_GIT_EMAIL ||
    process.env.GIT_AUTHOR_EMAIL ||
    process.env.GITHUB_EMAIL ||
    "41898282+github-actions[bot]@users.noreply.github.com";

  setGitConfig(repoDir, "user.name", name);
  setGitConfig(repoDir, "user.email", email);
};

await mkdir(path.join(root, "_cache"), { recursive: true });

try {
  const currentBranch = (() => {
    try {
      return capture("git rev-parse --abbrev-ref HEAD");
    } catch {
      return "";
    }
  })();
  const githubRef = process.env.GITHUB_REF || "";
  if (currentBranch === branch || githubRef === `refs/heads/${branch}`) {
    console.log(`ℹ  already on '${branch}' branch; skipping build push`);
    process.exit(0);
  }

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
  } else {
    const baseRef = hasRemoteBranch ? `${remote}/${branch}` : "HEAD";
    const attempt = tryRun(
      `git worktree add -b "${branch}" "${worktreeDir}" "${baseRef}"`
    );
    if (!attempt.ok) {
      const msg = `${attempt.stderr}\n${attempt.stdout}`;
      if (msg.includes("already exists")) {
        run(`git worktree add "${worktreeDir}" "${branch}"`);
      } else if (msg.includes("already checked out")) {
        console.log(`ℹ  '${branch}' is already checked out; skipping build push`);
        process.exit(0);
      } else {
        throw attempt.error;
      }
    }
  }

  const sourceList = capture("git ls-files -co --exclude-standard");
  const sourceEntries = sourceList ? sourceList.split("\n") : [];
  const sourceFiles = [];
  for (const file of sourceEntries) {
    const src = path.join(root, file);
    try {
      const st = await lstat(src);
      if (st.isDirectory()) continue;
      sourceFiles.push(file);
    } catch {
      /* skip missing files */
    }
  }
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
    ensureIdentity(worktreeDir);
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
