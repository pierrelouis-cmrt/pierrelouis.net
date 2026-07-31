"use strict";

(() => {
  const widget = document.querySelector("[data-listening-widget]");

  if (!widget) {
    return;
  }

  const elements = {
    label: widget.querySelector("[data-listening-label]"),
    link: widget.querySelector("[data-listening-link]"),
    artwork: widget.querySelector("[data-listening-artwork]"),
    song: widget.querySelector("[data-listening-song]"),
    artist: widget.querySelector("[data-listening-artist]"),
  };

  if (Object.values(elements).some((element) => !element)) {
    return;
  }

  const API_PATH = "/api/lastfm.php";
  const PROFILE_URL = "https://www.last.fm/user/pierrelouis-c";
  const REQUEST_TIMEOUT_MS = 8_000;
  const POLL_INTERVALS = {
    playing: 15_000,
    recent: 60_000,
    hidden: 120_000,
  };

  const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let activeController = null;
  let consecutiveFailures = 0;
  let hasRenderedTrack = false;
  let pollTimer = null;

  const setText = (element, value) => {
    if (element.textContent !== value) {
      element.textContent = value;
    }
  };

  const setState = (state) => {
    widget.dataset.listeningState = state;
    widget.setAttribute("aria-busy", state === "loading" ? "true" : "false");
  };

  const setArtwork = (value = "") => {
    const safeUrl = isSafeArtworkUrl(value) ? value : "";
    let image = elements.artwork.querySelector("img");

    if (!safeUrl) {
      image?.remove();
      return;
    }

    if (!image) {
      image = document.createElement("img");
      image.alt = "";
      image.width = 160;
      image.height = 160;
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => image.remove());
      elements.artwork.prepend(image);
    }

    if (image.src !== safeUrl) {
      image.src = safeUrl;
    }
  };

  const isSafeLastfmUrl = (value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        (url.hostname === "last.fm" || url.hostname.endsWith(".last.fm"))
      );
    } catch {
      return false;
    }
  };

  const isSafeArtworkUrl = (value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        [
          "lastfm.freetls.fastly.net",
          "lastfm-img2.akamaized.net",
        ].includes(url.hostname)
      );
    } catch {
      return false;
    }
  };

  const formatPlayedAt = (value) => {
    const playedAt = new Date(value);
    const elapsedSeconds = Math.round((playedAt.getTime() - Date.now()) / 1_000);

    if (!Number.isFinite(elapsedSeconds)) {
      return "";
    }

    const ranges = [
      [60, "second"],
      [60, "minute"],
      [24, "hour"],
      [7, "day"],
      [4.345, "week"],
      [12, "month"],
      [Number.POSITIVE_INFINITY, "year"],
    ];

    let amount = elapsedSeconds;

    for (const [limit, unit] of ranges) {
      if (Math.abs(amount) < limit) {
        return relativeTime.format(Math.round(amount), unit);
      }

      amount /= limit;
    }

    return "";
  };

  const renderTrack = ({ track, stale = false }) => {
    if (!track || typeof track !== "object") {
      setState("empty");
      setText(elements.label, "Listening history:");
      setText(elements.song, "Nothing scrobbled yet");
      setText(elements.artist, "Open my Last.fm profile");
      elements.link.href = PROFILE_URL;
      setArtwork();
      hasRenderedTrack = false;
      return;
    }

    const name = typeof track.name === "string" ? track.name.trim() : "";
    const artist = typeof track.artist === "string" ? track.artist.trim() : "";

    if (!name || !artist) {
      throw new Error("Last.fm returned an invalid track");
    }

    const isPlaying = track.nowPlaying === true && !stale;
    const playedAt = !isPlaying && track.playedAt
      ? formatPlayedAt(track.playedAt)
      : "";
    const album = typeof track.album === "string" ? track.album.trim() : "";
    const detailParts = [artist];

    if (album) {
      detailParts.push(album);
    }

    if (playedAt) {
      detailParts.push(playedAt);
    }

    setState(isPlaying ? "playing" : stale ? "stale" : "recent");
    setText(
      elements.label,
      isPlaying
        ? "Currently listening to:"
        : stale
          ? "Last known scrobble:"
          : "Recently listened to:",
    );
    setText(elements.song, name);
    setText(elements.artist, detailParts.join(" · "));

    elements.link.href = isSafeLastfmUrl(track.url) ? track.url : PROFILE_URL;
    elements.link.setAttribute(
      "aria-label",
      `${name} by ${artist} on Last.fm (opens in a new tab)`,
    );

    setArtwork(track.image);

    hasRenderedTrack = true;
  };

  const renderUnavailable = () => {
    setState("unavailable");
    setText(elements.label, "Listening on Last.fm:");
    setText(elements.song, "Live status unavailable");
    setText(elements.artist, "Open my listening history");
    elements.link.href = PROFILE_URL;
    setArtwork();
  };

  const requestTrack = async () => {
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;
    const timeout = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch(API_PATH, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Last.fm proxy returned ${response.status}`);
      }

      return await response.json();
    } finally {
      window.clearTimeout(timeout);

      if (activeController === controller) {
        activeController = null;
      }
    }
  };

  const getNextInterval = () => {
    if (document.hidden) {
      return POLL_INTERVALS.hidden;
    }

    return widget.dataset.listeningState === "playing"
      ? POLL_INTERVALS.playing
      : POLL_INTERVALS.recent;
  };

  const scheduleNextPoll = (delay = getNextInterval()) => {
    window.clearTimeout(pollTimer);
    pollTimer = window.setTimeout(poll, delay);
  };

  const poll = async () => {
    if (document.hidden || navigator.onLine === false) {
      scheduleNextPoll();
      return;
    }

    try {
      const payload = await requestTrack();
      renderTrack(payload);
      consecutiveFailures = 0;
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      consecutiveFailures += 1;

      if (!hasRenderedTrack) {
        renderUnavailable();
      } else if (widget.dataset.listeningState === "playing") {
        setState("stale");
        setText(elements.label, "Last known scrobble:");
      }
    } finally {
      const backoff = Math.min(
        300_000,
        POLL_INTERVALS.recent * 2 ** Math.max(0, consecutiveFailures - 1),
      );
      scheduleNextPoll(consecutiveFailures > 0 ? backoff : getNextInterval());
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      activeController?.abort();
      scheduleNextPoll();
    } else {
      scheduleNextPoll(0);
    }
  });

  window.addEventListener("online", () => scheduleNextPoll(0));
  window.addEventListener("pagehide", () => activeController?.abort());

  poll();
})();
