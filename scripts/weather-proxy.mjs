const API_URL = "https://api.open-meteo.com/v1/forecast";
const REQUEST_TIMEOUT_MS = 4_500;

export const normalizeWeather = (data) => {
  const temperature = data?.current?.temperature_2m;
  const weatherCode = data?.current?.weather_code;

  if (!Number.isFinite(temperature) || !Number.isInteger(weatherCode)) {
    throw new Error("Open-Meteo returned invalid current weather");
  }

  return {
    current: {
      temperature_2m: temperature,
      weather_code: weatherCode,
    },
    stale: false,
  };
};

const writeJson = (response, status, payload) => {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
  });
  response.end(JSON.stringify(payload));
};

export const createWeatherProxy = ({ fetchImpl = globalThis.fetch } = {}) => {
  return async (request, response) => {
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      writeJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    const url = new URL(API_URL);
    url.search = new URLSearchParams({
      latitude: "45.7640",
      longitude: "4.8357",
      current: "temperature_2m,weather_code",
    }).toString();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const upstream = await fetchImpl(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "pierrelouis.net-local-weather/1.0",
        },
        signal: controller.signal,
      });

      if (!upstream.ok) {
        throw new Error(`Open-Meteo returned ${upstream.status}`);
      }

      writeJson(response, 200, normalizeWeather(await upstream.json()));
    } catch {
      writeJson(response, 502, { error: "temporarily_unavailable" });
    } finally {
      clearTimeout(timeout);
    }
  };
};
