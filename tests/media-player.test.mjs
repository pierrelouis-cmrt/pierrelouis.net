import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

/*
 * Browser tests for posts/components/media-player.js. They need system Chrome
 * (Playwright's `chrome` channel) and ffmpeg to synthesize a throwaway test
 * clip; when either is missing the suite is skipped rather than failed.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
};

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="/base.css">
<link rel="stylesheet" href="/posts/components/media-player.css">
</head><body style="width:720px;padding:20px">
<pl-video-player id="video" label="Test clip">
  <video src="/__fixture/clip.mp4" controls preload="auto"></video>
  <p class="post-caption" id="credit">Credit line</p>
</pl-video-player>
<pl-audio-player id="audio" label="Perfect fifth" src="/posts/components/media/perfect-fifth.mp3" preload="auto"></pl-audio-player>
<pl-video-player id="broken" label="Missing clip" src="/__fixture/missing.mp4"></pl-video-player>
<script type="module" src="/posts/components/media-player.js"></script>
</body></html>`;

let browser;
let fixtureDir;
let server;
let origin;
let skipReason = null;

const serve = (request, response) => {
  const url = new URL(request.url, "http://localhost");

  if (url.pathname === "/__test/") {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(PAGE);
    return;
  }

  const file = url.pathname.startsWith("/__fixture/")
    ? path.join(fixtureDir, path.basename(url.pathname))
    : path.join(ROOT, decodeURIComponent(url.pathname));

  if (!file.startsWith(ROOT) && !file.startsWith(fixtureDir)) {
    response.writeHead(403).end();
    return;
  }

  if (!existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end();
    return;
  }

  const size = statSync(file).size;
  const type = TYPES[path.extname(file)] || "application/octet-stream";
  const range = /bytes=(\d*)-(\d*)/.exec(request.headers.range || "");

  if (range) {
    const start = Number(range[1] || 0);
    const end = range[2] ? Number(range[2]) : size - 1;
    response.writeHead(206, {
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Type": type,
    });
    createReadStream(file, { start, end }).pipe(response);
    return;
  }

  response.writeHead(200, {
    "Accept-Ranges": "bytes",
    "Content-Length": size,
    "Content-Type": type,
  });
  createReadStream(file).pipe(response);
};

before(async () => {
  let chromium;

  try {
    ({ chromium } = await import("playwright"));
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    skipReason = "playwright or ffmpeg is unavailable";
    return;
  }

  fixtureDir = mkdtempSync(path.join(tmpdir(), "pl-media-player-"));
  // A 12 s synthetic test pattern; never published, only used by this test.
  execFileSync("ffmpeg", [
    "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24:duration=12",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-g", "12", "-movflags", "+faststart",
    path.join(fixtureDir, "clip.mp4"),
  ]);

  try {
    browser = await chromium.launch({
      args: ["--autoplay-policy=no-user-gesture-required"],
      channel: "chrome",
    });
  } catch {
    skipReason = "system Chrome is unavailable to Playwright";
    return;
  }

  server = createServer(serve);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));

  if (fixtureDir) {
    rmSync(fixtureDir, { force: true, recursive: true });
  }
});

const openPage = async (t, options = {}) => {
  if (skipReason) {
    t.skip(skipReason);
    return null;
  }

  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];

  page.on("pageerror", (error) => errors.push(error));
  t.after(async () => {
    await context.close();
    assert.deepEqual(errors.map(String), []);
  });
  await page.goto(`${origin}/__test/`);
  await page.waitForFunction(() =>
    ["video", "audio"].every((id) => {
      const media = document.getElementById(id).media;
      return media && Number.isFinite(media.duration) && media.duration > 0;
    }),
  );

  return page;
};

const state = (page, id) =>
  page.evaluate((elementId) => {
    const player = document.getElementById(elementId);
    const scrubber = player.querySelector(".pl-player__scrubber");
    return {
      ariaLabel: player.getAttribute("aria-label"),
      currentTime: player.media.currentTime,
      duration: player.media.duration,
      paused: player.media.paused,
      playerState: player.dataset.playerState,
      toggleLabel: player.querySelector(".pl-player__toggle").getAttribute("aria-label"),
      valueMax: scrubber.getAttribute("aria-valuemax"),
      valueNow: scrubber.getAttribute("aria-valuenow"),
      valueText: scrubber.getAttribute("aria-valuetext"),
    };
  }, id);

test("upgrades authored media without losing semantics or credits", async (t) => {
  const page = await openPage(t);
  if (!page) return;

  const structure = await page.evaluate(() => {
    const player = document.getElementById("video");
    return {
      children: [...player.children].map((child) => child.className),
      controls: player.media.controls,
      inFrame: player.media.parentElement.classList.contains("pl-player"),
      role: player.getAttribute("role"),
      tag: player.media.localName,
      audioTag: document.getElementById("audio").media.localName,
    };
  });

  assert.deepEqual(structure.children, ["pl-player pl-player--video", "post-caption"]);
  assert.equal(structure.controls, false);
  assert.equal(structure.inFrame, true);
  assert.equal(structure.role, "group");
  assert.equal(structure.tag, "video");
  assert.equal(structure.audioTag, "audio");

  const video = await state(page, "video");
  assert.equal(video.ariaLabel, "Test clip");
  assert.equal(video.toggleLabel, "Play Test clip");
  assert.equal(video.valueMax, "12");
  assert.equal(video.valueText, "0:00 of 0:12");
});

test("toggle and native media state stay in sync", async (t) => {
  const page = await openPage(t);
  if (!page) return;

  await page.click("#video .pl-player__toggle");
  await page.waitForFunction(() => document.getElementById("video").dataset.playerState === "playing");
  let video = await state(page, "video");
  assert.equal(video.paused, false);
  assert.equal(video.toggleLabel, "Pause Test clip");

  await page.evaluate(() => document.getElementById("video").media.pause());
  await page.waitForFunction(() => document.getElementById("video").dataset.playerState === "paused");
  video = await state(page, "video");
  assert.equal(video.toggleLabel, "Play Test clip");
});

test("scrubber supports slider keys and pointer scrubbing", async (t) => {
  const page = await openPage(t);
  if (!page) return;

  await page.focus("#video .pl-player__scrubber");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.getElementById("video").media.currentTime >= 4.9);
  assert.equal((await state(page, "video")).valueNow, "5");

  await page.keyboard.press("End");
  assert.equal(Math.round((await state(page, "video")).currentTime), 12);
  await page.keyboard.press("Home");
  assert.equal((await state(page, "video")).currentTime, 0);

  await page.keyboard.press(" ");
  await page.waitForFunction(() => !document.getElementById("video").media.paused);
  await page.keyboard.press("k");
  await page.waitForFunction(() => document.getElementById("video").media.paused);

  const box = await page.locator("#audio .pl-player__track").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  assert.equal(
    await page.evaluate(() => document.getElementById("audio").hasAttribute("data-scrubbing")),
    true,
  );
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  const audio = await state(page, "audio");
  assert.ok(Math.abs(audio.currentTime / audio.duration - 0.75) < 0.05, `${audio.currentTime}`);
});

test("only one audible player plays at a time", async (t) => {
  const page = await openPage(t);
  if (!page) return;

  await page.click("#video .pl-player__toggle");
  await page.waitForFunction(() => !document.getElementById("video").media.paused);
  await page.click("#audio .pl-player__toggle");
  await page.waitForFunction(() => !document.getElementById("audio").media.paused);
  await page.waitForFunction(() => document.getElementById("video").media.paused);
});

test("reports load errors with a direct link", async (t) => {
  const page = await openPage(t);
  if (!page) return;

  await page.waitForFunction(() => document.getElementById("broken").hasAttribute("data-error"));
  const status = await page.locator("#broken .pl-player__status").textContent();
  assert.match(status, /could not be loaded/);
  assert.match(
    await page.locator("#broken .pl-player__status a").getAttribute("href"),
    /missing\.mp4$/,
  );
});

test("reconnecting rebinds listeners exactly once and src changes sync", async (t) => {
  const page = await openPage(t);
  if (!page) return;

  await page.evaluate(() => {
    const player = document.getElementById("audio");
    const parent = player.parentNode;
    player.remove();
    parent.append(player);
  });
  await page.click("#audio .pl-player__toggle");
  await page.waitForFunction(() => !document.getElementById("audio").media.paused);

  await page.evaluate(() =>
    document.getElementById("audio").setAttribute("src", "/__fixture/clip.mp4"),
  );
  await page.waitForFunction(() =>
    document.getElementById("audio").media.currentSrc.endsWith("/__fixture/clip.mp4"),
  );
  assert.equal(
    (await state(page, "audio")).toggleLabel,
    "Play Perfect fifth",
  );
});

test("autoplay is suppressed for reduced motion", async (t) => {
  const page = await openPage(t, { reducedMotion: "reduce" });
  if (!page) return;

  await page.evaluate(() => {
    const player = document.createElement("pl-video-player");
    player.id = "auto";
    player.setAttribute("autoplay", "");
    player.setAttribute("muted", "");
    player.setAttribute("src", "/__fixture/clip.mp4");
    document.body.append(player);
  });
  await page.waitForFunction(() => document.getElementById("auto").media.readyState >= 3);
  assert.equal((await state(page, "auto")).paused, true);
});

test("scrubbing shows an origin marker, snaps back to it, and restores playback", async (t) => {
  const page = await openPage(t);
  if (!page) return;

  await page.evaluate(() => {
    document.getElementById("video").media.currentTime = 3;
  });
  await page.click("#video .pl-player__toggle");
  await page.waitForFunction(() => !document.getElementById("video").media.paused);

  const box = await page.locator("#video .pl-player__track").boundingBox();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.mouse.down();
  // The origin is wherever playback was at the press, read from the notch.
  const during = await page.evaluate(() => {
    const player = document.getElementById("video");
    const marker = player.querySelector(".pl-player__marker");
    return {
      covered: marker.hasAttribute("data-covered"),
      marker: player.hasAttribute("data-marker"),
      offset: new DOMMatrix(marker.style.transform).m41 + 1,
      paused: player.media.paused,
    };
  });
  const { offset, ...flags } = during;
  assert.deepEqual(flags, { covered: true, marker: true, paused: true });
  const origin = (offset / box.width) * 12;
  const originX = box.x + offset;

  // Releasing within the snap distance returns exactly to the origin.
  await page.mouse.move(originX + 3, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  const after = await page.evaluate(() => {
    const player = document.getElementById("video");
    return { marker: player.hasAttribute("data-marker"), time: player.media.currentTime };
  });
  assert.equal(after.marker, false);
  assert.ok(Math.abs(after.time - origin) < 0.06, `${after.time} vs ${origin}`);
  await page.waitForFunction(() => !document.getElementById("video").media.paused);
});

test("audio readout shows duration at rest and elapsed / total once started", async (t) => {
  const page = await openPage(t);
  if (!page) return;

  const readout = () => page.locator("#audio .pl-player__time").textContent();
  assert.equal(await readout(), "0:04");
  await page.evaluate(() => {
    document.getElementById("audio").currentTime = 2;
  });
  assert.equal(await readout(), "0:02 / 0:04");
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelector("#audio .pl-player").children].map((child) => child.className),
    ),
    [
      "pl-player__media",
      "pl-player__toggle pl-player__toggle--audio",
      "pl-player__title",
      "pl-player__time",
      "pl-player__scrubber",
      "pl-player__status",
    ],
  );
});
