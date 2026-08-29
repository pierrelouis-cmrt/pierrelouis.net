import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:8000";
const OUTPUT_DIR = process.env.QA_OUTPUT_DIR || path.join(os.tmpdir(), "pierrelouis-lastfm-qa");

const track = {
  album: "Dreamland",
  artist: "Glass Animals",
  image:
    "https://lastfm-img.freetls.fastly.net/i/u/174s/album-cover.jpg",
  name: "Heat Waves",
  nowPlaying: true,
  playedAt: null,
  url: "https://www.last.fm/music/Glass+Animals/_/Heat+Waves",
};

await mkdir(OUTPUT_DIR, { recursive: true });

const browser = await chromium.launch();

const checkLoadingState = async () => {
  const page = await browser.newPage({ viewport: { height: 1000, width: 1440 } });

  await page.route("**/api/lastfm.php", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fulfill({
      body: JSON.stringify({ stale: false, track }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.goto(`${BASE_URL}/now/`, { waitUntil: "domcontentloaded" });
  const widget = page.locator('[data-listening-state="loading"]');
  await widget.waitFor();

  const result = await widget.evaluate((element) => {
    const artwork = element.querySelector("[data-listening-artwork]");
    const song = element.querySelector("[data-listening-song]");
    const artist = element.querySelector("[data-listening-artist]");

    return {
      artistWidth: artist?.getBoundingClientRect().width || 0,
      artworkBackground: artwork ? getComputedStyle(artwork).backgroundImage : "none",
      hasArtworkImage: Boolean(artwork?.querySelector("img")),
      songWidth: song?.getBoundingClientRect().width || 0,
      state: element.getAttribute("data-listening-state"),
    };
  });

  assert.equal(result.state, "loading");
  assert.equal(result.hasArtworkImage, false);
  assert.ok(result.artworkBackground.includes("gradient"));
  assert.ok(result.songWidth > result.artistWidth);

  await page.screenshot({
    fullPage: true,
    path: path.join(OUTPUT_DIR, "desktop-loading.png"),
  });
  await page.close();

  return result;
};

const checkState = async ({ name, payload, responseStatus = 200, state, viewport }) => {
  const page = await browser.newPage({ viewport });
  const consoleErrors = [];

  await page.route("https://lastfm-img.freetls.fastly.net/**", (route) =>
    route.fulfill({
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
      contentType: "image/png",
      status: 200,
    }),
  );

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.route("**/api/lastfm.php", (route) =>
    route.fulfill({
      body: JSON.stringify(payload),
      contentType: "application/json",
      status: responseStatus,
    }),
  );

  await page.goto(`${BASE_URL}/now/`, { waitUntil: "networkidle" });
  await page.locator(`[data-listening-state="${state}"]`).waitFor();

  const result = await page.locator("[data-listening-widget]").evaluate((widget) => {
    const artwork = widget.querySelector("[data-listening-artwork] img");

    return {
      ariaBusy: widget.getAttribute("aria-busy"),
      artworkLoaded:
        artwork instanceof HTMLImageElement &&
        artwork.complete &&
        artwork.naturalWidth > 0,
      documentWidth: document.documentElement.scrollWidth,
      label: widget.querySelector("[data-listening-label]")?.textContent?.trim(),
      song: widget.querySelector("[data-listening-song]")?.textContent?.trim(),
      state: widget.getAttribute("data-listening-state"),
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  assert.equal(result.state, state);
  assert.equal(result.ariaBusy, "false");
  assert.ok(result.label);
  assert.ok(result.song);
  assert.ok(result.documentWidth <= result.viewportWidth);
  if (responseStatus < 400) {
    assert.equal(result.artworkLoaded, true);
    assert.deepEqual(consoleErrors, []);
  } else {
    assert.ok(
      consoleErrors.every((message) => message.includes(`status of ${responseStatus}`)),
    );
  }

  await page.screenshot({
    fullPage: true,
    path: path.join(OUTPUT_DIR, `${name}.png`),
  });
  await page.close();

  return result;
};

try {
  const loading = await checkLoadingState();

  const live = await checkState({
    name: "desktop-playing",
    payload: {
      stale: false,
      track,
      updatedAt: new Date().toISOString(),
    },
    state: "playing",
    viewport: { height: 1000, width: 1440 },
  });

  const recent = await checkState({
    name: "mobile-recent",
    payload: {
      stale: false,
      track: {
        ...track,
        nowPlaying: false,
        playedAt: new Date(Date.now() - 8 * 60 * 1_000).toISOString(),
      },
      updatedAt: new Date().toISOString(),
    },
    state: "recent",
    viewport: { height: 844, width: 390 },
  });

  const unavailable = await checkState({
    name: "desktop-unavailable",
    payload: { error: "temporarily_unavailable" },
    responseStatus: 502,
    state: "unavailable",
    viewport: { height: 1000, width: 1440 },
  });

  console.log(`Loading: skeleton (${Math.round(loading.songWidth)}px)`);
  console.log(`Playing: ${live.label} ${live.song}`);
  console.log(`Recent: ${recent.label} ${recent.song}`);
  console.log(`Unavailable: ${unavailable.label} ${unavailable.song}`);
  console.log(`Screenshots: ${OUTPUT_DIR}`);
} finally {
  await browser.close();
}
