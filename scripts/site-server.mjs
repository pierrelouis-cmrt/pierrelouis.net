import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

const DEV_RELOAD_SCRIPT = `
<script>
(() => {
  const events = new EventSource("/__dev/events");
  events.addEventListener("reload", () => window.location.reload());
})();
</script>`;

const getRequestPath = (url) => {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  return normalized === "/" ? "/index.html" : normalized;
};

const resolveFile = async (url, root) => {
  const requestPath = getRequestPath(url);
  const fullPath = path.join(root, requestPath);
  const relativePath = path.relative(root, fullPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  try {
    const fileStat = await stat(fullPath);

    if (fileStat.isDirectory()) {
      return path.join(fullPath, "index.html");
    }

    return fullPath;
  } catch {
    if (!path.extname(fullPath)) {
      return path.join(fullPath, "index.html");
    }
  }

  return fullPath;
};

const listen = (server, port, host) => {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
};

export const startSiteServer = async ({
  dev = false,
  host = "127.0.0.1",
  port = 8000,
  root = ROOT,
} = {}) => {
  const clients = new Set();
  const siteRoot = path.resolve(root);

  const server = createServer(async (request, response) => {
    if (dev && request.url === "/__dev/events") {
      response.writeHead(200, {
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
      });
      response.write("\n");
      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }

    const filePath = await resolveFile(request.url, siteRoot);

    if (!filePath) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const fileStat = await stat(filePath);

      if (!fileStat.isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      const extension = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES.get(extension) || "application/octet-stream";

      if (dev && extension === ".html") {
        const html = await readFile(filePath, "utf8");
        response.writeHead(200, { "Content-Type": contentType });
        response.end(html.replace("</body>", `${DEV_RELOAD_SCRIPT}\n  </body>`));
        return;
      }

      response.writeHead(200, { "Content-Type": contentType });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  let currentPort = Number(port);

  while (currentPort < Number(port) + 20) {
    try {
      await listen(server, currentPort, host);
      break;
    } catch (error) {
      if (error.code !== "EADDRINUSE") {
        throw error;
      }

      currentPort += 1;
    }
  }

  return {
    host,
    port: currentPort,
    server,
    reload() {
      for (const client of clients) {
        client.write("event: reload\ndata: now\n\n");
      }
    },
  };
};
