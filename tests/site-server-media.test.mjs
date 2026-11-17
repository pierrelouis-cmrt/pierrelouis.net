import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { startSiteServer } from "../scripts/site-server.mjs";

test("local media serves MIME types, HEAD and seekable byte ranges", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "post-media-"));
  const data = Buffer.from("0123456789");
  await writeFile(path.join(root, "clip.mp4"), data);
  await writeFile(path.join(root, "sound.mp3"), data);
  const { server } = await startSiteServer({ root, port: 0 });
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const full = await fetch(`${origin}/clip.mp4`);
    assert.equal(full.headers.get("content-type"), "video/mp4");
    assert.equal(full.headers.get("accept-ranges"), "bytes");
    assert.equal(await full.text(), "0123456789");
    const head = await fetch(`${origin}/sound.mp3`, { method: "HEAD" });
    assert.equal(head.headers.get("content-type"), "audio/mpeg");
    assert.equal(head.headers.get("content-length"), "10");
    assert.equal(await head.text(), "");
    for (const [range, expected, contentRange] of [
      ["bytes=2-5", "2345", "bytes 2-5/10"],
      ["bytes=7-", "789", "bytes 7-9/10"],
      ["bytes=-3", "789", "bytes 7-9/10"],
      ["bytes=8-100", "89", "bytes 8-9/10"],
    ]) {
      const response = await fetch(`${origin}/clip.mp4`, { headers: { Range: range } });
      assert.equal(response.status, 206);
      assert.equal(response.headers.get("content-range"), contentRange);
      assert.equal(await response.text(), expected);
    }
    const invalid = await fetch(`${origin}/clip.mp4`, { headers: { Range: "bytes=10-" } });
    assert.equal(invalid.status, 416);
    assert.equal(invalid.headers.get("content-range"), "bytes */10");
    const unsupported = await fetch(`${origin}/clip.mp4`, { headers: { Range: "bytes=0-1,4-5" } });
    assert.equal(unsupported.status, 200);
    await unsupported.arrayBuffer();
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
