(() => {
  const copyrightYearElements = document.querySelectorAll("[data-footer-year]");
  const weatherElement = document.querySelector("[data-footer-weather]");

  copyrightYearElements.forEach((element) => {
    element.textContent = new Date().getFullYear().toString();
  });

  if (!weatherElement) {
    return;
  }

  const LYON = {
    latitude: "45.7640",
    longitude: "4.8357",
    timeZone: "Europe/Paris",
  };

  const CACHE_KEY = "pierrelouis.footerWeather.lyon";
  const CACHE_TTL = 30 * 60 * 1000;
  const REQUEST_TIMEOUT = 4500;
  const WEATHER_REFRESH_INTERVAL = 30 * 60 * 1000;

  const weatherCodeLabels = new Map([
    [0, "Clear"],
    [1, "Mainly clear"],
    [2, "Partly cloudy"],
    [3, "Overcast"],
    [45, "Fog"],
    [48, "Rime fog"],
    [51, "Light drizzle"],
    [53, "Drizzle"],
    [55, "Heavy drizzle"],
    [56, "Freezing drizzle"],
    [57, "Freezing drizzle"],
    [61, "Light rain"],
    [63, "Rain"],
    [65, "Heavy rain"],
    [66, "Freezing rain"],
    [67, "Freezing rain"],
    [71, "Light snow"],
    [73, "Snow"],
    [75, "Heavy snow"],
    [77, "Snow grains"],
    [80, "Light showers"],
    [81, "Showers"],
    [82, "Heavy showers"],
    [85, "Snow showers"],
    [86, "Heavy snow showers"],
    [95, "Thunderstorm"],
    [96, "Thunderstorm with hail"],
    [99, "Thunderstorm with hail"],
  ]);

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: LYON.timeZone,
  });

  let currentWeather = null;

  const getApiUrl = () => {
    const url = new URL("https://api.open-meteo.com/v1/forecast");

    url.search = new URLSearchParams({
      latitude: LYON.latitude,
      longitude: LYON.longitude,
      current: "temperature_2m,weather_code",
      timezone: LYON.timeZone,
    }).toString();

    return url.toString();
  };

  const renderWeather = (weather) => {
    currentWeather = weather;
    weatherElement.textContent = `${timeFormatter.format(new Date())}, ${
      weather.condition
    } at ${weather.temperature}°C`;
  };

  const scheduleClockUpdate = () => {
    const now = new Date();
    const nextMinuteDelay =
      60 * 1000 - (now.getSeconds() * 1000 + now.getMilliseconds());

    window.setTimeout(() => {
      if (currentWeather) {
        renderWeather(currentWeather);
      }

      scheduleClockUpdate();
    }, nextMinuteDelay);
  };

  const readCache = () => {
    try {
      const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY));

      if (
        !cached ||
        typeof cached.fetchedAt !== "number" ||
        !cached.weather ||
        typeof cached.weather.condition !== "string" ||
        typeof cached.weather.temperature !== "number"
      ) {
        return null;
      }

      return cached;
    } catch {
      return null;
    }
  };

  const writeCache = (weather) => {
    try {
      window.localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          fetchedAt: Date.now(),
          weather,
        }),
      );
    } catch {
      // Local storage can be unavailable in private or restricted contexts.
    }
  };

  const getCondition = (weatherCode) => {
    return weatherCodeLabels.get(weatherCode) ?? "Weather";
  };

  const normalizeWeather = (current) => {
    const temperature = Number(current?.temperature_2m);
    const weatherCode = Number(current?.weather_code);

    if (!Number.isFinite(temperature) || !Number.isFinite(weatherCode)) {
      throw new Error("Invalid weather payload");
    }

    return {
      condition: getCondition(weatherCode),
      temperature: Math.round(temperature),
    };
  };

  const fetchWeather = async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT);

    try {
      const response = await fetch(getApiUrl(), {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Weather request failed: ${response.status}`);
      }

      const data = await response.json();
      const weather = normalizeWeather(data.current);

      writeCache(weather);
      renderWeather(weather);
    } catch {
      if (!currentWeather) {
        weatherElement.textContent = "Weather unavailable";
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const cachedWeather = readCache();
  const hasFreshCache =
    cachedWeather && Date.now() - cachedWeather.fetchedAt < CACHE_TTL;

  if (cachedWeather) {
    renderWeather(cachedWeather.weather);
  }

  if (!hasFreshCache) {
    fetchWeather();
  }

  scheduleClockUpdate();
  window.setInterval(fetchWeather, WEATHER_REFRESH_INTERVAL);
})();
