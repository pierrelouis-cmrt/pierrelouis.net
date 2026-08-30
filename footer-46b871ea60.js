(() => {
  const copyrightYearElements = document.querySelectorAll("[data-footer-year]");
  const weatherElement = document.querySelector("[data-footer-weather]");

  copyrightYearElements.forEach((element) => {
    element.textContent = new Date().getFullYear().toString();
  });

  if (!weatherElement) {
    return;
  }

  const API_PATH = "/api/weather.php";
  const REQUEST_TIMEOUT_MS = 4_500;
  const REFRESH_AFTER_MS = 30 * 60 * 1_000;
  const RETRY_AFTER_MS = 5 * 60 * 1_000;
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
    timeZone: "Europe/Paris",
  });

  let clockTimer = 0;
  let currentWeather = null;
  let inFlight = null;
  let weatherActivated = false;
  let weatherFetchedAt = 0;
  let weatherRefreshTimer = 0;

  const renderWeather = () => {
    if (!currentWeather) {
      return;
    }

    weatherElement.textContent = `${timeFormatter.format(new Date())}, ${
      currentWeather.condition
    } at ${currentWeather.temperature}°C`;
    weatherElement.title = currentWeather.stale
      ? "Weather data may be out of date"
      : "";
  };

  const scheduleClockUpdate = () => {
    window.clearTimeout(clockTimer);

    if (document.hidden || !currentWeather) {
      return;
    }

    const now = new Date();
    const delay =
      60 * 1_000 - (now.getSeconds() * 1_000 + now.getMilliseconds());

    clockTimer = window.setTimeout(() => {
      renderWeather();
      scheduleClockUpdate();
    }, delay);
  };

  const normalizeWeather = (payload) => {
    const temperature = payload?.current?.temperature_2m;
    const weatherCode = payload?.current?.weather_code;

    if (!Number.isFinite(temperature) || !Number.isInteger(weatherCode)) {
      throw new Error("Invalid weather payload");
    }

    return {
      condition: weatherCodeLabels.get(weatherCode) ?? "Weather",
      temperature: Math.round(temperature),
      stale: payload.stale === true,
    };
  };

  const scheduleWeatherRefresh = (delay) => {
    window.clearTimeout(weatherRefreshTimer);

    if (!weatherActivated || document.hidden) {
      return;
    }

    weatherRefreshTimer = window.setTimeout(fetchWeather, delay);
  };

  const fetchWeather = async () => {
    if (inFlight) {
      return inFlight;
    }

    if (navigator.onLine === false) {
      if (!currentWeather) {
        weatherElement.textContent = "Weather unavailable";
      }
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    inFlight = (async () => {
      let retryDelay = 0;

      try {
        const response = await fetch(API_PATH, {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Weather endpoint returned ${response.status}`);
        }

        currentWeather = normalizeWeather(await response.json());
        weatherFetchedAt = Date.now();
        renderWeather();
        scheduleClockUpdate();
      } catch {
        retryDelay = RETRY_AFTER_MS;

        if (!currentWeather) {
          weatherElement.textContent = "Weather unavailable";
          weatherElement.title = "";
        }
      } finally {
        window.clearTimeout(timeout);
        inFlight = null;
        scheduleWeatherRefresh(retryDelay || REFRESH_AFTER_MS);
      }
    })();

    return inFlight;
  };

  const resumeWeather = () => {
    if (!weatherActivated) {
      return;
    }

    const elapsed = Date.now() - weatherFetchedAt;

    if (!weatherFetchedAt || elapsed >= REFRESH_AFTER_MS) {
      fetchWeather();
      return;
    }

    scheduleWeatherRefresh(REFRESH_AFTER_MS - elapsed);
  };

  const activateWeather = () => {
    if (weatherActivated) {
      return;
    }

    weatherActivated = true;
    fetchWeather();
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          activateWeather();
        }
      },
      { rootMargin: "200px 0px" },
    );

    observer.observe(weatherElement.closest("footer") ?? weatherElement);
  } else {
    activateWeather();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.clearTimeout(clockTimer);
      window.clearTimeout(weatherRefreshTimer);
      return;
    }

    renderWeather();
    scheduleClockUpdate();
    resumeWeather();
  });
  window.addEventListener("online", resumeWeather);
})();
