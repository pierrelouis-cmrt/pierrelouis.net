import assert from "node:assert/strict";
import test from "node:test";
import {
  createWeatherProxy,
  normalizeWeather,
} from "../scripts/weather-proxy.mjs";

const upstreamPayload = {
  current: {
    temperature_2m: 26.4,
    weather_code: 80,
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

test("keeps only the weather fields used by the footer", () => {
  assert.deepEqual(normalizeWeather(upstreamPayload), {
    current: {
      temperature_2m: 26.4,
      weather_code: 80,
    },
    stale: false,
  });
});

test("local proxy provides the browser contract without production caching", async () => {
  let requests = 0;
  const proxy = createWeatherProxy({
    async fetchImpl(url) {
      requests += 1;
      assert.equal(url.hostname, "api.open-meteo.com");
      assert.equal(
        url.searchParams.get("current"),
        "temperature_2m,weather_code",
      );

      return new Response(JSON.stringify(upstreamPayload), { status: 200 });
    },
  });
  const first = createResponse();
  const second = createResponse();

  await proxy({ method: "GET" }, first.response);
  await proxy({ method: "GET" }, second.response);

  assert.equal(requests, 2);
  assert.equal(first.result.status, 200);
  assert.equal(first.result.headers["Cache-Control"], "no-store");
  assert.deepEqual(
    JSON.parse(first.result.body),
    normalizeWeather(upstreamPayload),
  );
});

test("local proxy rejects writes and contains upstream failures", async () => {
  let requests = 0;
  const proxy = createWeatherProxy({
    async fetchImpl() {
      requests += 1;
      throw new Error("simulated outage");
    },
  });
  const post = createResponse();
  const failedGet = createResponse();

  await proxy({ method: "POST" }, post.response);
  await proxy({ method: "GET" }, failedGet.response);

  assert.equal(requests, 1);
  assert.equal(post.result.status, 405);
  assert.equal(post.result.headers.Allow, "GET");
  assert.equal(failedGet.result.status, 502);
  assert.deepEqual(JSON.parse(failedGet.result.body), {
    error: "temporarily_unavailable",
  });
});
