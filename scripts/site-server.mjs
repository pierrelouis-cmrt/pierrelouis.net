import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLastfmProxy } from "./lastfm-proxy.mjs";
import { renderPostHeaderLab } from "./post-header-lab.mjs";
import { createWeatherProxy } from "./weather-proxy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".m4a", "audio/mp4"],
  [".ogg", "audio/ogg"],
  [".wav", "audio/wav"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webm", "video/webm"],
  [".webp", "image/webp"],
]);

const getNetworkUrls = (port) => {
  const addresses = Object.entries(networkInterfaces())
    .flatMap(([name, entries = []]) =>
      entries.map((entry) => ({ ...entry, name })),
    )
    .filter(
      ({ address, family, internal }) =>
        !internal &&
        (family === "IPv4" || family === 4) &&
        !address.startsWith("169.254."),
    )
    .sort(({ name: a }, { name: b }) => {
      const priority = (name) => (/^en\d+$/.test(name) ? 0 : 1);
      return priority(a) - priority(b);
    });

  return [
    ...new Set(addresses.map(({ address }) => `http://${address}:${port}/`)),
  ];
};

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
  const lastfmProxy = createLastfmProxy({ root: ROOT });
  const weatherProxy = createWeatherProxy();

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url, "http://localhost");

    if (requestUrl.pathname === "/api/lastfm.php") {
      await lastfmProxy(request, response);
      return;
    }

    if (requestUrl.pathname === "/api/weather.php") {
      await weatherProxy(request, response);
      return;
    }

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

    if (
      dev &&
      requestUrl.searchParams.get("header-lab") === "1" &&
      /^\/posts\/[a-z0-9-]+\/$/.test(requestUrl.pathname)
    ) {
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      });
      response.end(
        renderPostHeaderLab({ pathname: requestUrl.pathname }).replace(
          "</body>",
          `${DEV_RELOAD_SCRIPT}\n  </body>`,
        ),
      );
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

      const requestPath = getRequestPath(request.url);
      const isIsolatedPostDocument =
        requestPath.startsWith("/posts/headers/") ||
        requestPath.startsWith("/posts/components/apps/");

      if (dev && extension === ".html" && !isIsolatedPostDocument) {
        const html = await readFile(filePath, "utf8");
        response.writeHead(200, { "Content-Type": contentType });
        response.end(html.replace("</body>", `${DEV_RELOAD_SCRIPT}\n  </body>`));
        return;
      }

      // Browsers request byte ranges when loading and seeking local media.
      const headers = {
        "Accept-Ranges": "bytes",
        "Content-Type": contentType,
        "Content-Length": fileStat.size,
      };
      let start = 0;
      let end = fileStat.size - 1;
      let status = 200;
      const range = request.headers.range;

      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (match && (match[1] || match[2])) {
          start = match[1] ? Number(match[1]) : Math.max(0, fileStat.size - Number(match[2]));
          end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= fileStat.size) {
            response.writeHead(416, { "Content-Range": `bytes */${fileStat.size}` });
            response.end();
            return;
          }
          status = 206;
          headers["Content-Range"] = `bytes ${start}-${end}/${fileStat.size}`;
          headers["Content-Length"] = end - start + 1;
        }
      }

      response.writeHead(status, headers);
      if (request.method === "HEAD" || fileStat.size === 0) {
        response.end();
        return;
      }
      const stream = createReadStream(filePath, { start, end });
      stream.on("error", () => response.destroy());
      response.on("close", () => stream.destroy());
      stream.pipe(response);
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
    localUrl:
      `http://${host === "0.0.0.0" ? "localhost" : host}:` +
      `${currentPort}/`,
    networkUrls: host === "0.0.0.0" ? getNetworkUrls(currentPort) : [],
    port: currentPort,
    server,
    reload() {
      for (const client of clients) {
        client.write("event: reload\ndata: now\n\n");
      }
    },
  };
};
