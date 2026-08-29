import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createLastfmProxy,
  normalizeLastfmResponse,
} from "../scripts/lastfm-proxy.mjs";

const upstreamPayload = {
  recenttracks: {
    track: [
      {
        "@attr": { nowplaying: "true" },
        album: { "#text": "Dreamland" },
        artist: { "#text": "Glass Animals" },
        date: { uts: "1785499200" },
        image: [
          {
            size: "large",
            "#text":
              "https://lastfm-img.freetls.fastly.net/i/u/174s/album-cover.jpg",
          },
        ],
        name: "Heat Waves",
        url: "https://www.last.fm/music/Glass+Animals/_/Heat+Waves",
      },
    ],
  },
};

const createResponse = () => {
  const result = { body: "", headers: {}, status: 0 };

  return {
    result,
    response: {
      end(body) {
        result.body = body;
      },
      setHeader(name, value) {
        result.headers[name] = value;
      },
      writeHead(status, headers) {
        result.status = status;
        Object.assign(result.headers, headers);
      },
    },
  };
};

test("normalizes a Last.fm response into the public contract", () => {
  const payload = normalizeLastfmResponse(upstreamPayload, 1_785_499_200_000);

  assert.deepEqual(payload, {
    track: {
      name: "Heat Waves",
      artist: "Glass Animals",
      album: "Dreamland",
      url: "https://www.last.fm/music/Glass+Animals/_/Heat+Waves",
      image: "https://lastfm-img.freetls.fastly.net/i/u/174s/album-cover.jpg",
      nowPlaying: true,
      playedAt: "2026-07-31T12:00:00.000Z",
    },
    stale: false,
    updatedAt: "2026-07-31T12:00:00.000Z",
  });
});

test("local proxy keeps the key server-side, caches, and degrades to stale data", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lastfm-proxy-test-"));
  let clock = 1_785_499_200_000;
  let requests = 0;
  let upstreamFails = false;

  try {
    await writeFile(
      path.join(root, ".env.local"),
      "LASTFM_API_KEY=server-only-test-key\nLASTFM_USER=pierrelouis-c\n",
    );

    const proxy = createLastfmProxy({
      root,
      now: () => clock,
      async fetchImpl(url) {
        requests += 1;
        assert.equal(url.searchParams.get("api_key"), "server-only-test-key");

        if (upstreamFails) {
          throw new Error("simulated outage");
        }

        return new Response(JSON.stringify(upstreamPayload), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      },
    });

    const first = createResponse();
    await proxy({ method: "GET" }, first.response);
    const firstPayload = JSON.parse(first.result.body);

    assert.equal(first.result.status, 200);
    assert.equal(firstPayload.track.name, "Heat Waves");
    assert.equal(first.result.body.includes("server-only-test-key"), false);
    assert.equal(first.result.headers["Cache-Control"], "no-store");
    assert.equal(
      first.result.headers["Cross-Origin-Resource-Policy"],
      "same-origin",
    );

    const cached = createResponse();
    await proxy({ method: "GET" }, cached.response);
    assert.equal(requests, 1);

    clock += 16_000;
    upstreamFails = true;
    const stale = createResponse();
    await proxy({ method: "GET" }, stale.response);
    const stalePayload = JSON.parse(stale.result.body);

    assert.equal(stale.result.status, 200);
    assert.equal(stalePayload.stale, true);
    assert.equal(stalePayload.track.nowPlaying, false);
    assert.equal(requests, 2);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
