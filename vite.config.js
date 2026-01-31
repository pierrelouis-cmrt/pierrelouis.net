import { defineConfig } from "vite";
import path from "path";
import { readdirSync, existsSync } from "fs";

const EXCLUDE_DIRS = new Set([
  "node_modules",
  "dist",
  "scripts",
  "_cache",
  ".git",
]);

const collectHtmlEntries = (dir, entries = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      collectHtmlEntries(path.join(dir, entry.name), entries);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".html")) {
      entries.push(path.join(dir, entry.name));
    }
  }
  return entries;
};

const trailingSlashRedirect = () => {
  const stripQuery = (url) => url.split("?")[0].split("#")[0];
  const hasExtension = (urlPath) => path.posix.extname(urlPath) !== "";

  const maybeRedirect = (req, res, rootDir) => {
    if (!req.url) return false;
    const urlPath = stripQuery(req.url);
    if (urlPath === "/" || urlPath.endsWith("/")) return false;
    if (hasExtension(urlPath)) return false;
    const candidate = path.join(rootDir, urlPath, "index.html");
    if (!existsSync(candidate)) return false;
    res.statusCode = 308;
    res.setHeader("Location", `${urlPath}/`);
    res.end();
    return true;
  };

  return {
    name: "trailing-slash-redirect",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (maybeRedirect(req, res, server.config.root)) return;
        next();
      });
    },
    configurePreviewServer(server) {
      const distRoot = path.resolve(
        server.config.root,
        server.config.build.outDir
      );
      server.middlewares.use((req, res, next) => {
        if (maybeRedirect(req, res, distRoot)) return;
        next();
      });
    },
  };
};

export default defineConfig(() => ({
  appType: "mpa",
  plugins: [trailingSlashRedirect()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: collectHtmlEntries(process.cwd()),
    },
  },
}));
