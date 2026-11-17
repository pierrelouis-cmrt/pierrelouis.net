/**
 * <pl-video-player> and <pl-audio-player>: minimal custom controls around a
 * real <video>/<audio> element. The authored media element keeps its native
 * `controls` until this module upgrades it, so articles degrade to the
 * browser player without JavaScript. Any other children (captions, credits)
 * stay where they are, below the player.
 */

const SEEK_STEP = 5;
const IDLE_DELAY = 1800;
const SVG_NS = "http://www.w3.org/2000/svg";
const players = new Set();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const MARKER_SNAP = 6;
const ICON_SHAPES = {
  play: [
    ["path", { d: "M3 3.5L15 10L3 16.5Z", fill: "currentColor", stroke: "currentColor", "stroke-width": "1.5", "stroke-linejoin": "round" }],
  ],
  pause: [
    ["rect", { x: "3", y: "3", width: "5", height: "14", rx: "1.5", fill: "currentColor" }],
    ["rect", { x: "10", y: "3", width: "5", height: "14", rx: "1.5", fill: "currentColor" }],
  ],
};

const formatTime = (value) => {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }

  const total = Math.floor(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");

  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const element = (tag, className, attributes = {}) => {
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }

  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }

  return node;
};

const icon = (name) => {
  const svg = document.createElementNS(SVG_NS, "svg");

  svg.setAttribute("viewBox", "0 0 18 20");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", `pl-player__icon pl-player__icon--${name}`);

  for (const [tag, attributes] of ICON_SHAPES[name]) {
    const shape = document.createElementNS(SVG_NS, tag);

    for (const [key, value] of Object.entries(attributes)) {
      shape.setAttribute(key, value);
    }
    svg.append(shape);
  }

  return svg;
};

class MediaPlayer extends HTMLElement {
  static observedAttributes = [
    "autoplay",
    "label",
    "loop",
    "muted",
    "poster",
    "preload",
    "ratio",
    "src",
  ];

  /** Overridden by subclasses. */
  static kind = "video";

  #built = false;
  #controller = null;
  #frame = 0;
  #idleTimer = 0;
  #scrub = null;
  #hoverRatio = null;
  #surfacePointer = "mouse";

  /* Native media API, forwarded so the player can be scripted like media. */
  get media() {
    return this.mediaElement;
  }

  get paused() {
    return this.mediaElement?.paused ?? true;
  }

  get currentTime() {
    return this.mediaElement?.currentTime ?? 0;
  }

  set currentTime(value) {
    this.#seek(value);
  }

  get duration() {
    return this.mediaElement?.duration ?? Number.NaN;
  }

  play() {
    return this.mediaElement?.play() ?? Promise.resolve();
  }

  pause() {
    this.mediaElement?.pause();
  }

  connectedCallback() {
    if (!this.#built) {
      this.#build();
    }

    this.#listen();
    players.add(this);
    this.#render();
  }

  disconnectedCallback() {
    this.mediaElement?.pause();
    this.#controller?.abort();
    this.#controller = null;
    cancelAnimationFrame(this.#frame);
    clearTimeout(this.#idleTimer);
    this.#scrub = null;
    this.toggleAttribute("data-scrubbing", false);
    this.toggleAttribute("data-marker", false);
    players.delete(this);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this.#built) {
      if (newValue === null && ["autoplay", "loop", "muted"].includes(name)) {
        this.mediaElement[name] = false;
        if (name === "muted") this.mediaElement.defaultMuted = false;
      }
      if (newValue === null && ["src", "poster"].includes(name)) {
        this.mediaElement.removeAttribute(name);
        if (name === "src") this.mediaElement.load();
      }
      this.#applyAttribute(name);
      if (name === "ratio" && this.#kind === "video") this.#applyRatio(this.mediaElement);
      this.#render();
    }
  }

  get #kind() {
    return this.constructor.kind;
  }

  get #label() {
    const media = this.mediaElement;

    return (
      this.getAttribute("label")?.trim() ||
      media?.getAttribute("aria-label")?.trim() ||
      media?.getAttribute("title")?.trim() ||
      (this.#kind === "video" ? "Video" : "Audio")
    );
  }

  #build() {
    const kind = this.#kind;
    let media = this.querySelector(`:scope > ${kind}`);

    if (!media) {
      media = document.createElement(kind);
      media.textContent = `Your browser cannot play this ${kind}.`;
    }

    this.mediaElement = media;
    media.controls = false;
    media.removeAttribute("controls");
    media.classList.add("pl-player__media");

    if (kind === "video") {
      media.playsInline = true;
      media.setAttribute("playsinline", "");
      media.disablePictureInPicture = true;
    }

    for (const name of MediaPlayer.observedAttributes) {
      this.#applyAttribute(name);
    }

    if (!media.getAttribute("preload")) {
      media.preload = "metadata";
    }

    // Autoplay is opt-in and never runs for readers who asked for less motion.
    if (reducedMotion.matches) {
      media.autoplay = false;
      media.removeAttribute("autoplay");
      media.pause();
    }

    this.ui = kind === "video" ? this.#buildVideo(media) : this.#buildAudio(media);
    this.prepend(this.ui.root);
    this.dataset.playerState = "paused";
    this.setAttribute("role", "group");
    this.setAttribute("aria-roledescription", `${kind} player`);
    this.#built = true;
    this.dataset.componentState = "ready";
  }

  #applyAttribute(name) {
    const media = this.mediaElement;
    const value = this.getAttribute(name);

    if (!media) {
      return;
    }

    switch (name) {
      case "src":
        if (value && media.getAttribute("src") !== value) {
          media.src = value;
          this.#clearError();
        }
        break;
      case "poster":
        if (this.#kind === "video" && value !== null) {
          media.poster = value;
        }
        break;
      case "preload":
        if (value !== null) {
          media.preload = value;
        }
        break;
      case "loop":
      case "autoplay":
        if (this.hasAttribute(name)) {
          media[name] = !(name === "autoplay" && reducedMotion.matches);
        }
        break;
      case "muted":
        if (this.hasAttribute("muted")) {
          media.muted = true;
          media.defaultMuted = true;
        }
        break;
      case "label":
        break;
    }

    if (name === "label" || name === "src") {
      this.setAttribute("aria-label", this.#label);
      this.ui?.toggle && this.#renderToggleLabel();
    }
  }

  #buildScrubber() {
    const scrubber = element("div", "pl-player__scrubber", {
      role: "slider",
      tabindex: "0",
      "aria-label": "Seek",
      "aria-valuemin": "0",
      "aria-valuemax": "0",
      "aria-valuenow": "0",
      "aria-valuetext": "0:00",
      "aria-disabled": "true",
    });
    const track = element("span", "pl-player__track");
    const ghost = element("span", "pl-player__ghost");
    const fill = element("span", "pl-player__fill");
    const marker = element("span", "pl-player__marker", { "aria-hidden": "true" });
    const bubble = element("span", "pl-player__bubble", { "aria-hidden": "true" });

    track.append(ghost, fill);
    scrubber.append(track, marker, bubble);

    return { bubble, fill, ghost, marker, scrubber, track };
  }

  #buildToggle(className) {
    const toggle = element("button", `pl-player__toggle ${className}`, {
      type: "button",
    });

    toggle.append(icon("play"), icon("pause"));
    return toggle;
  }

  #buildVideo(media) {
    const root = element("div", "pl-player pl-player--video");
    const surface = element("div", "pl-player__surface", { "aria-hidden": "true" });
    const toggle = this.#buildToggle("pl-player__toggle--video");
    const time = element("span", "pl-player__time", { "aria-hidden": "true" });
    const status = element("p", "pl-player__status", { role: "status" });
    const parts = this.#buildScrubber();

    root.append(media, surface, toggle, time, parts.scrubber, status);
    this.#applyRatio(media);

    return { ...parts, root, status, surface, time, toggle };
  }

  #buildAudio(media) {
    const root = element("div", "pl-player pl-player--audio");
    const toggle = this.#buildToggle("pl-player__toggle--audio");
    const title = element("span", "pl-player__title", { "aria-hidden": "true" });
    const time = element("span", "pl-player__time", { "aria-hidden": "true" });
    const elapsed = element("span", "pl-player__elapsed");
    const total = element("span", "pl-player__total");
    const status = element("p", "pl-player__status", { role: "status" });
    const parts = this.#buildScrubber();

    title.textContent = this.#label;
    time.append(elapsed, total);
    root.append(media, toggle, title, time, parts.scrubber, status);

    return { ...parts, elapsed, root, status, time, title, toggle, total };
  }

  #applyRatio(media) {
    const authored = this.getAttribute("ratio");
    let width = media.videoWidth || Number(media.getAttribute("width"));
    let height = media.videoHeight || Number(media.getAttribute("height"));

    if (!(width && height) && authored) {
      [width, height] = authored.split("/").map((part) => Number(part.trim()));
    }

    if (width > 0 && height > 0) {
      this.style.setProperty("--pl-player-ratio", `${width} / ${height}`);
      this.style.setProperty("--pl-player-ratio-value", String(width / height));
    }
  }

  #listen() {
    this.#controller?.abort();
    this.#controller = new AbortController();

    const { signal } = this.#controller;
    const media = this.mediaElement;
    const { scrubber, surface, toggle } = this.ui;
    const on = (target, type, handler, options = {}) =>
      target.addEventListener(type, handler, { ...options, signal });

    for (const type of [
      "durationchange",
      "emptied",
      "ended",
      "loadedmetadata",
      "pause",
      "play",
      "playing",
      "progress",
      "ratechange",
      "seeked",
      "timeupdate",
      "volumechange",
    ]) {
      on(media, type, () => this.#onMediaEvent(type));
    }

    on(media, "waiting", () => this.toggleAttribute("data-loading", true));
    on(media, "seeking", () => this.#render());
    on(media, "canplay", () => this.toggleAttribute("data-loading", false));
    // <source> errors don't bubble, but capture on the media element sees them.
    on(media, "error", (event) => this.#onError(event), { capture: true });

    on(toggle, "click", () => this.#toggle());
    on(this, "keydown", (event) => this.#onKeydown(event));
    on(this, "focusin", () => this.#poke());

    on(scrubber, "pointerdown", (event) => this.#scrubStart(event));
    on(scrubber, "pointermove", (event) => this.#scrubMove(event));
    on(scrubber, "pointerup", (event) => this.#scrubEnd(event));
    on(scrubber, "pointercancel", (event) => this.#scrubEnd(event, true));
    on(scrubber, "lostpointercapture", (event) => this.#scrubEnd(event, true));
    on(scrubber, "pointerleave", () => this.#setHover(null));

    if (surface) {
      on(this.ui.root, "pointermove", (event) => {
        if (event.pointerType === "mouse") {
          this.#poke();
        }
      });
      on(this.ui.root, "pointerleave", (event) => {
        if (event.pointerType === "mouse") {
          this.#idle(0);
        }
      });
      on(surface, "click", (event) => this.#onSurfaceClick(event));
      on(surface, "pointerdown", (event) => {
        this.#surfacePointer = event.pointerType;
      });
    }

    on(reducedMotion, "change", () => this.#render());
  }

  #onMediaEvent(type) {
    const media = this.mediaElement;

    if (type === "loadedmetadata" && this.#kind === "video") {
      this.#applyRatio(media);
    }

    if (type === "loadedmetadata" || type === "emptied") {
      this.#clearError();
    }

    if (type === "play") {
      this.#pauseOthers();

      if (!this.hasAttribute("data-error")) {
        this.ui.status.replaceChildren();
      }
    }

    if (type === "playing" || type === "seeked") {
      this.toggleAttribute("data-loading", false);
    }

    if (type === "play" || type === "pause" || type === "ended") {
      this.#pulse();
      this.#poke();
    }

    this.#render();
  }

  /* Only one audible player at a time; muted ambient loops keep going. */
  #pauseOthers() {
    if (this.mediaElement.muted) {
      return;
    }

    for (const player of players) {
      if (player !== this && !player.paused && !player.mediaElement.muted) {
        player.pause();
      }
    }
  }

  #onError(event) {
    const media = this.mediaElement;
    const sources = [...media.querySelectorAll("source")];
    const lastSource = sources.at(-1);

    // A failing <source> is only fatal once the browser has run out of them.
    if (event.target !== media && event.target !== lastSource) {
      return;
    }

    if (event.target === media && media.error?.code === MediaError.MEDIA_ERR_ABORTED) {
      return;
    }

    const href = media.currentSrc || media.getAttribute("src") || lastSource?.src;
    const status = this.ui.status;
    const noun = this.#kind;

    status.replaceChildren(`This ${noun} could not be loaded.`);

    if (href) {
      const link = element("a", "pl-player__status-link", { href });
      link.textContent = `Open the ${noun} file`;
      status.append(" ", link);
    }

    this.toggleAttribute("data-error", true);
    this.toggleAttribute("data-loading", false);
    this.#render();
  }

  #clearError() {
    if (this.hasAttribute("data-error")) {
      this.toggleAttribute("data-error", false);
      this.ui.status.replaceChildren();
    }
  }

  #toggle() {
    const media = this.mediaElement;

    if (this.hasAttribute("data-error")) {
      return;
    }

    if (media.paused || media.ended) {
      const attempt = media.play();

      attempt?.catch((error) => {
        if (error?.name === "NotAllowedError") {
          this.ui.status.textContent = "Playback was blocked by the browser. Press play again.";
        }
        this.#render();
      });
    } else {
      media.pause();
    }
  }

  #onSurfaceClick(event) {
    // On touch, the first tap reveals the controls; the next one toggles.
    if (this.#surfacePointer !== "mouse" && !this.hasAttribute("data-controls")) {
      this.#poke();
      return;
    }

    event.preventDefault();
    this.#toggle();
  }

  #seek(value) {
    const media = this.mediaElement;
    const duration = media.duration;

    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }

    media.currentTime = clamp(value, 0, duration);
    this.#render();
  }

  #onKeydown(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const media = this.mediaElement;
    const duration = media.duration;
    const onSlider = event.target === this.ui.scrubber;
    const onButton = event.target.closest("button, a");
    let handled = true;

    switch (event.key) {
      case " ":
      case "Enter":
        if (onButton) {
          handled = false; // Native button activation already toggles.
        } else if (onSlider) {
          this.#toggle();
        } else {
          handled = false;
        }
        break;
      case "k":
      case "K":
        this.#toggle();
        break;
      case "ArrowLeft":
      case "ArrowDown":
        if (!onSlider && event.key === "ArrowDown") {
          handled = false;
          break;
        }
        this.#seek(media.currentTime - SEEK_STEP);
        break;
      case "ArrowRight":
      case "ArrowUp":
        if (!onSlider && event.key === "ArrowUp") {
          handled = false;
          break;
        }
        this.#seek(media.currentTime + SEEK_STEP);
        break;
      case "PageDown":
      case "PageUp":
        if (!onSlider) {
          handled = false;
          break;
        }
        this.#seek(
          media.currentTime +
            (event.key === "PageUp" ? 1 : -1) * Math.max(SEEK_STEP * 2, duration / 10),
        );
        break;
      case "Home":
      case "End":
        if (!onSlider) {
          handled = false;
          break;
        }
        this.#seek(event.key === "Home" ? 0 : duration);
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
      this.#poke();
    }
  }

  #ratioFrom(event, rect) {
    return rect.width ? clamp((event.clientX - rect.left) / rect.width, 0, 1) : 0;
  }

  /* Near the origin notch, the scrub settles back exactly where it began. */
  #snap(event, scrub) {
    const ratio = this.#ratioFrom(event, scrub.rect);

    if (
      this.hasAttribute("data-marker") &&
      Math.abs(event.clientX - scrub.rect.left - scrub.originX) <= MARKER_SNAP
    ) {
      return scrub.origin;
    }

    return ratio;
  }

  #scrubStart(event) {
    const media = this.mediaElement;

    if (event.button !== 0 || !Number.isFinite(media.duration) || media.duration <= 0) {
      return;
    }

    event.preventDefault();
    this.ui.scrubber.focus({ focusVisible: false, preventScroll: true });
    this.ui.scrubber.setPointerCapture?.(event.pointerId);
    const rect = this.ui.track.getBoundingClientRect();
    const origin = clamp(media.currentTime / media.duration, 0, 1);
    const originX = origin * rect.width;

    this.#scrub = {
      origin,
      originX,
      pointerId: event.pointerId,
      rect,
      resume: !media.paused,
      ratio: 0,
      pending: false,
    };
    // The origin notch only appears when there is somewhere to come back to.
    this.toggleAttribute(
      "data-marker",
      media.currentTime > 0.25 && originX >= MARKER_SNAP && originX <= rect.width - MARKER_SNAP,
    );
    this.ui.marker.style.transform = `translateX(${Math.round(originX - 1)}px)`;
    media.pause();
    this.toggleAttribute("data-scrubbing", true);
    this.#scrubMove(event);
  }

  #scrubMove(event) {
    const scrub = this.#scrub;

    if (!scrub || scrub.pointerId !== event.pointerId) {
      if (event.pointerType === "mouse") {
        this.#setHover(this.#ratioFrom(event, this.ui.track.getBoundingClientRect()));
      }
      return;
    }

    scrub.ratio = this.#snap(event, scrub);
    this.#setHover(scrub.ratio);
    this.#paintProgress(scrub.ratio);

    if (!scrub.pending) {
      scrub.pending = true;
      requestAnimationFrame(() => {
        if (this.#scrub !== scrub) {
          return;
        }
        scrub.pending = false;
        const media = this.mediaElement;
        const target = scrub.ratio * media.duration;

        if (typeof media.fastSeek === "function") {
          media.fastSeek(target);
        } else {
          media.currentTime = target;
        }
        this.#renderTime(target);
      });
    }
  }

  #scrubEnd(event, cancelled = false) {
    const scrub = this.#scrub;

    if (!scrub || scrub.pointerId !== event.pointerId) {
      return;
    }

    this.#scrub = null;
    this.toggleAttribute("data-scrubbing", false);

    if (!cancelled) {
      scrub.ratio = this.#snap(event, scrub);
    }

    this.toggleAttribute("data-marker", false);

    this.#seek(scrub.ratio * this.mediaElement.duration);

    if (event.pointerType !== "mouse") {
      this.#setHover(null);
    }

    if (scrub.resume) {
      this.mediaElement.play().catch(() => this.#render());
    }

    this.#poke();
  }

  #setHover(ratio) {
    const { bubble, ghost, track } = this.ui;
    const duration = this.mediaElement.duration;

    this.#hoverRatio = Number.isFinite(duration) && duration > 0 ? ratio : null;

    if (this.#hoverRatio === null) {
      this.toggleAttribute("data-hovering", false);

      return;
    }

    const width = track.clientWidth;
    const half = (bubble.offsetWidth || 36) / 2;
    const x = clamp(this.#hoverRatio * width, half, Math.max(half, width - half));

    bubble.textContent = formatTime(this.#hoverRatio * duration);
    bubble.style.transform = `translate3d(calc(${x}px - 50%), 0, 0)`;
    ghost.style.setProperty("--pl-p", String(this.#hoverRatio));
    this.toggleAttribute("data-hovering", true);
  }

  /* Controls stay up while paused, focused by keyboard, or recently used. */
  #poke() {
    this.toggleAttribute("data-controls", true);
    this.#idle(IDLE_DELAY);
  }

  #idle(delay) {
    clearTimeout(this.#idleTimer);
    this.#idleTimer = setTimeout(() => {
      const media = this.mediaElement;

      if (
        !media.paused &&
        !this.#scrub &&
        !this.#hasKeyboardFocus()
      ) {
        this.toggleAttribute("data-controls", false);
      } else if (!media.paused) {
        this.#idle(IDLE_DELAY);
      }
    }, delay);
  }

  #hasKeyboardFocus() {
    try {
      return this.ui.root.matches(":has(:focus-visible)");
    } catch {
      return this.ui.root.contains(document.activeElement);
    }
  }

  #pulse() {
    if (this.#kind !== "video" || reducedMotion.matches) {
      return;
    }

    this.toggleAttribute("data-pulse", false);
    void this.ui.toggle.offsetWidth;
    this.toggleAttribute("data-pulse", true);
    this.ui.toggle.addEventListener(
      "animationend",
      () => this.toggleAttribute("data-pulse", false),
      { once: true },
    );
  }

  #paintProgress(ratio) {
    const value = clamp(ratio, 0, 1);
    const scrub = this.#scrub;

    this.ui.fill.style.setProperty("--pl-p", String(value));

    if (scrub) {
      this.ui.marker.toggleAttribute(
        "data-covered",
        value * scrub.rect.width > scrub.originX + 1,
      );
    }
  }

  #renderTime(current) {
    const media = this.mediaElement;
    const duration = media.duration;
    const { scrubber, time } = this.ui;
    const known = Number.isFinite(duration) && duration > 0;
    const now = formatTime(current);

    const atRest = known && media.paused && current === 0;

    if (this.#kind === "audio") {
      this.ui.elapsed.textContent = atRest ? "" : now;
      this.ui.total.textContent = known
        ? `${atRest ? "" : " / "}${formatTime(duration)}`
        : "";
    } else {
      time.textContent = atRest ? formatTime(duration) : now;
    }

    scrubber.setAttribute("aria-valuemax", known ? String(Math.round(duration)) : "0");
    scrubber.setAttribute("aria-valuenow", String(Math.round(current)));
    scrubber.setAttribute(
      "aria-valuetext",
      known ? `${now} of ${formatTime(duration)}` : now,
    );
    scrubber.setAttribute("aria-disabled", String(!known));
    scrubber.tabIndex = known ? 0 : -1;
  }

  #renderToggleLabel() {
    const media = this.mediaElement;
    const playing = !media.paused && !media.ended;
    const label = this.#label;

    this.ui.toggle.setAttribute("aria-label", `${playing ? "Pause" : "Play"} ${label}`);

    if (this.ui.title) {
      this.ui.title.textContent = label;
    }
  }

  #render() {
    const media = this.mediaElement;

    if (!media || !this.ui) {
      return;
    }

    const duration = media.duration;
    const known = Number.isFinite(duration) && duration > 0;
    const playing = !media.paused && !media.ended;

    this.dataset.playerState = playing ? "playing" : "paused";
    this.toggleAttribute("data-ended", media.ended);

    if (!playing) {
      this.toggleAttribute("data-controls", true);
      clearTimeout(this.#idleTimer);
    }

    if (!this.#scrub) {
      this.#paintProgress(known ? media.currentTime / duration : 0);

      this.#renderTime(media.currentTime);
    }

    this.#renderToggleLabel();

    cancelAnimationFrame(this.#frame);

    if (playing && known) {
      // timeupdate fires ~4×/s; a frame loop keeps the fill gliding.
      const tick = () => {
        if (!this.#scrub) {
          this.#paintProgress(media.currentTime / media.duration);
        }
        this.#frame = requestAnimationFrame(tick);
      };
      this.#frame = requestAnimationFrame(tick);
    }
  }
}

class VideoPlayer extends MediaPlayer {
  static kind = "video";
}

class AudioPlayer extends MediaPlayer {
  static kind = "audio";
}

if (!customElements.get("pl-video-player")) {
  customElements.define("pl-video-player", VideoPlayer);
}

if (!customElements.get("pl-audio-player")) {
  customElements.define("pl-audio-player", AudioPlayer);
}
