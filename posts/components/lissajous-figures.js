/**
 * Native inline figures for the Lissajous article.
 *
 *   <pl-lissajous-closure>    rational vs irrational time-lapse
 *   <pl-lissajous-gap>        cycling curves with their actual central gap
 *   <pl-lissajous-intervals>  piano interval picker with curve and sound
 *
 * The maths is exported so it can be tested without a DOM. Elements are only
 * defined when a browser `customElements` registry exists.
 */

const TAU = Math.PI * 2;
const SVG_NS = "http://www.w3.org/2000/svg";

/* -------------------------------------------------------------------------- */
/* Maths                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The article's normalised form (Wang et al. 2020, eq. 5), with f0 = 1 and
 * t in [0, 1) covering one full period:
 *   X = cos(2π nx t),  Y = cos(2π ny t + kπ / (4 nx))
 */
export const sampleLissajous = (nx, ny, k = 2, steps = 400 * Math.max(nx, ny)) => {
  const phase = (k * Math.PI) / (4 * nx);
  const points = new Array(steps + 1);

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    points[index] = [Math.cos(TAU * nx * t), Math.cos(TAU * ny * t + phase)];
  }

  return points;
};

const distanceToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  let u = lengthSquared ? ((px - ax) * dx + (py - ay) * dy) / lengthSquared : 0;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  return Math.hypot(ax + u * dx - px, ay + u * dy - py);
};

/** Shortest distance from a point to a sampled polyline. */
export const distanceToPolyline = (point, points) => {
  let best = Infinity;

  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const distance = distanceToSegment(point[0], point[1], a[0], a[1], b[0], b[1]);

    if (distance < best) {
      best = distance;
    }
  }

  return best;
};

/**
 * Casts `rays` rays from `center` and returns, per ray, the distance to the
 * first crossing with the curve. For a convex empty cell this traces its
 * boundary exactly (up to the curve sampling).
 */
export const castCell = (center, points, rays = 180) => {
  const radii = new Float64Array(rays);

  for (let ray = 0; ray < rays; ray += 1) {
    const angle = (ray / rays) * TAU;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let best = Infinity;

    for (let index = 1; index < points.length; index += 1) {
      const ax = points[index - 1][0] - center[0];
      const ay = points[index - 1][1] - center[1];
      const ex = points[index][0] - points[index - 1][0];
      const ey = points[index][1] - points[index - 1][1];
      const denominator = dx * ey - dy * ex;

      if (Math.abs(denominator) < 1e-14) {
        continue;
      }

      const along = (ax * ey - ay * ex) / denominator;
      const segment = (ax * dy - ay * dx) / denominator;

      if (along > 1e-9 && segment >= 0 && segment <= 1 && along < best) {
        best = along;
      }
    }

    radii[ray] = Number.isFinite(best) ? best : 0;
  }

  return radii;
};

/**
 * Finds the largest empty disc in the central region of the curve (the
 * curve's maximum gap) by a coarse grid search refined by pattern search,
 * then traces the empty cell that contains it.
 *
 * Returns { center, radius, radii } in curve units (the scan spans [-1, 1]).
 * For odd:odd ratios at k = 2 the centre is the origin and the cell is the
 * rhombus whose inscribed diameter equals Wang et al.'s parallelogram height.
 */
export const centralGap = (nx, ny, k = 2, { rays = 180, steps } = {}) => {
  const points = sampleLissajous(nx, ny, k, steps);
  const grid = 24;
  const extent = 0.6;
  let best = { distance: -1, point: [0, 0] };

  for (let i = 0; i <= grid; i += 1) {
    for (let j = 0; j <= grid; j += 1) {
      const point = [-extent + (2 * extent * i) / grid, -extent + (2 * extent * j) / grid];
      const distance = distanceToPolyline(point, points);

      if (distance > best.distance + 1e-12) {
        best = { distance, point };
      }
    }
  }

  let step = (2 * extent) / grid;
  let { distance, point } = best;

  while (step > 1e-5) {
    let improved = false;

    for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const candidate = [point[0] + dx, point[1] + dy];
      const candidateDistance = distanceToPolyline(candidate, points);

      if (candidateDistance > distance) {
        distance = candidateDistance;
        point = candidate;
        improved = true;
      }
    }

    if (!improved) {
      step /= 2;
    }
  }

  // Snap numerical noise so symmetric cells stay exactly centred.
  const center = point.map((value) => (Math.abs(value) < 1e-4 ? 0 : value));

  return {
    center,
    points,
    radii: castCell(center, points, rays),
    radius: distanceToPolyline(center, points),
  };
};

/**
 * Time-lapse clock for the closure figure. Real seconds -> simulated seconds.
 * Linear until the rational curve closes (simulated t = 1 at `closeAt`), then
 * accelerates with a C¹-continuous cubic term to reach `end` at `duration`.
 */
export const timelapseClock = (seconds, { closeAt = 2.5, duration = 10, end = 14 } = {}) => {
  const clamped = Math.min(Math.max(seconds, 0), duration);
  const linear = clamped / closeAt;

  if (clamped <= closeAt) {
    return linear;
  }

  const span = duration - closeAt;
  const cubic = (end - duration / closeAt) / span ** 3;
  return linear + cubic * (clamped - closeAt) ** 3;
};

export const ROOT_FREQUENCY = 440 * 2 ** (-9 / 12); // C4, A4 = 440 Hz

const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B", "C"];

/**
 * 5-limit just ratios (upper : root) for each interval above the root, with
 * the conventional common-practice classification. The tritone and minor
 * seventh have several just candidates; 45:32 and 9:5 are the 5-limit ones.
 */
export const INTERVALS = Object.freeze([
  { name: "Unison", ratio: [1, 1], practice: "perfect consonance" },
  { name: "Minor second", ratio: [16, 15], practice: "dissonance" },
  { name: "Major second", ratio: [9, 8], practice: "dissonance" },
  { name: "Minor third", ratio: [6, 5], practice: "imperfect consonance" },
  { name: "Major third", ratio: [5, 4], practice: "imperfect consonance" },
  { name: "Perfect fourth", ratio: [4, 3], practice: "perfect consonance, context-dependent" },
  { name: "Tritone", ratio: [45, 32], practice: "dissonance" },
  { name: "Perfect fifth", ratio: [3, 2], practice: "perfect consonance" },
  { name: "Minor sixth", ratio: [8, 5], practice: "imperfect consonance" },
  { name: "Major sixth", ratio: [5, 3], practice: "imperfect consonance" },
  { name: "Minor seventh", ratio: [9, 5], practice: "dissonance" },
  { name: "Major seventh", ratio: [15, 8], practice: "dissonance" },
  { name: "Octave", ratio: [2, 1], practice: "perfect consonance" },
]);

/** Highest overtone in the synthesised tone; beats are only reported below it. */
export const SYNTH_PARTIALS = 8;

export const intervalInfo = (semitones, tuning = "equal") => {
  const interval = INTERVALS[semitones];
  const [p, q] = interval.ratio;
  const justRatio = p / q;
  const equalRatio = 2 ** (semitones / 12);
  const ratio = tuning === "just" ? justRatio : equalRatio;
  const cents = 1200 * Math.log2(equalRatio / justRatio);
  // Tenney height: log2 of the product of the reduced ratio terms.
  const complexity = Math.log2(p * q);
  // Beat between the p-th partial of the root and the q-th partial of the
  // upper note, which coincide in a just interval.
  const beat = Math.abs(q * ratio - p) * ROOT_FREQUENCY;

  return {
    ...interval,
    beat: tuning === "just" ? 0 : beat,
    beatAudible: Math.max(p, q) <= SYNTH_PARTIALS,
    cents,
    complexity,
    complexityLabel:
      complexity <= 3 ? "very simple" : complexity <= 4.5 ? "simple" : complexity <= 6 ? "moderate" : "complex",
    equalRatio,
    justRatio,
    noteName: NOTE_NAMES[semitones],
    ratioValue: ratio,
    semitones,
    upperFrequency: ROOT_FREQUENCY * ratio,
  };
};

/* -------------------------------------------------------------------------- */
/* DOM helpers                                                                */
/* -------------------------------------------------------------------------- */

const svg = (name, attributes = {}) => {
  const node = document.createElementNS(SVG_NS, name);

  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, value);
  }

  return node;
};

const html = (name, className, text) => {
  const node = document.createElement(name);

  if (className) {
    node.className = className;
  }

  if (text !== undefined) {
    node.textContent = text;
  }

  return node;
};

const button = (className, text, label) => {
  const node = html("button", className, text);
  node.type = "button";

  if (label) {
    node.setAttribute("aria-label", label);
  }

  return node;
};

// Plot coordinates: curve units [-1, 1] scaled to a 200-unit viewBox, y up.
const PLOT_SCALE = 90;
const toPlot = ([x, y]) => `${(x * PLOT_SCALE).toFixed(2)} ${(-y * PLOT_SCALE).toFixed(2)}`;

const plotSvg = (label) => {
  const node = svg("svg", {
    "aria-label": label,
    class: "lj-plot",
    role: "img",
    viewBox: "-100 -100 200 200",
  });
  node.append(svg("rect", { class: "lj-plot__bounds", height: 180, width: 180, x: -90, y: -90 }));
  return node;
};

const polylinePath = (points, start = 0, end = points.length) => {
  let d = "";

  for (let index = start; index < end; index += 1) {
    d += `${index === start ? "M" : "L"}${toPlot(points[index])}`;
  }

  return d;
};

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const caption = (element, fallback) => {
  const node = html("figcaption", "post-caption lj-caption");
  node.append(html("span", "", element.getAttribute("caption") || fallback));
  return node;
};

/**
 * Runs `onFrame(dt)` while the element is on screen, the tab is visible and
 * `isActive()` holds. `onFirstVisible` fires once when it first scrolls in.
 */
class FrameLoop {
  constructor(element, { onFrame, onFirstVisible, isActive }) {
    this.element = element;
    this.onFrame = onFrame;
    this.onFirstVisible = onFirstVisible;
    this.isActive = isActive;
    this.visible = false;
    this.seen = false;
    this.handle = 0;
    this.last = 0;
    this.tick = this.tick.bind(this);
    this.onVisibilityChange = () => this.sync();
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.observer = new IntersectionObserver(
      (entries) => {
        this.visible = entries.some((entry) => entry.isIntersecting);

        if (this.visible && !this.seen) {
          this.seen = true;
          this.onFirstVisible?.();
        }

        this.sync();
      },
      { threshold: 0.35 },
    );
    this.observer.observe(element);
  }

  sync() {
    const run = this.visible && !document.hidden && this.isActive();

    if (run && !this.handle) {
      this.last = performance.now();
      this.handle = requestAnimationFrame(this.tick);
    } else if (!run && this.handle) {
      cancelAnimationFrame(this.handle);
      this.handle = 0;
    }
  }

  tick(now) {
    // Clamp so a throttled or backgrounded tab does not jump ahead.
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.handle = 0;
    this.onFrame(dt);
    this.sync();
  }

  destroy() {
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.observer.disconnect();

    if (this.handle) {
      cancelAnimationFrame(this.handle);
      this.handle = 0;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* <pl-lissajous-closure>                                                     */
/* -------------------------------------------------------------------------- */

const CLOSURE = Object.freeze({
  chunk: 400,
  closeAt: 2.5,
  duration: 10,
  end: 14,
  phase: Math.PI / 4,
  step: 1 / 900,
});

const CLOSURE_CURVES = Object.freeze([
  { fx: 2, fy: 3, label: "2 : 3", name: "rational", closesAt: 1 },
  { fx: 2, fy: 2 * Math.SQRT2, label: "1 : √2", name: "irrational", closesAt: Infinity },
]);

const closurePoint = (curve, t) => [
  Math.cos(TAU * curve.fx * t),
  Math.cos(TAU * curve.fy * t + CLOSURE.phase),
];

const defineClosure = () =>
  class LissajousClosure extends HTMLElement {
    connectedCallback() {
      if (this.built) {
        this.loop = this.createLoop();
        return;
      }

      this.built = true;
      this.elapsed = 0;
      this.userPaused = false;
      this.started = false;
      this.render();
      this.reset();
      this.loop = this.createLoop();

      if (reducedMotion()) {
        this.started = true;
        this.seek(CLOSURE.duration);
      }

      this.dataset.componentState = "ready";
    }

    disconnectedCallback() {
      this.loop?.destroy();
      this.loop = null;
    }

    createLoop() {
      return new FrameLoop(this, {
        isActive: () => this.started && !this.userPaused && this.elapsed < CLOSURE.duration,
        onFirstVisible: () => {
          if (!reducedMotion()) {
            this.started = true;
          }
        },
        onFrame: (dt) => this.seek(this.elapsed + dt),
      });
    }

    render() {
      const figure = html("figure", "lj-figure lj-closure");
      const stage = html("div", "lj-stage lj-closure__stage");

      this.panels = CLOSURE_CURVES.map((curve) => {
        const panel = html("div", "lj-closure__panel");
        const plot = plotSvg(
          curve.closesAt === Infinity
            ? `Lissajous curve with frequency ratio ${curve.label}, which never returns to its start`
            : `Lissajous curve with frequency ratio ${curve.label}, which closes after one period`,
        );
        const trace = svg("g", { class: "lj-trace" });
        const start = svg("circle", { class: "lj-start", r: 3.2 });
        const pen = svg("circle", { class: "lj-pen", r: 2.6 });
        const [sx, sy] = toPlot(closurePoint(curve, 0)).split(" ");
        start.setAttribute("cx", sx);
        start.setAttribute("cy", sy);
        plot.append(trace, start, pen);

        const meta = html("div", "lj-meta");
        const ratio = html("span", "lj-meta__ratio", curve.label);
        const status = html("span", "lj-meta__status");
        meta.append(ratio, status);
        panel.append(plot, meta);
        stage.append(panel);

        return { curve, panel, pen, plot, start, status, trace };
      });

      const controls = html("div", "lj-controls");
      const bar = html("div", "lj-timebar");
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-label", "Time-lapse progress");
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", String(CLOSURE.duration));
      this.barFill = html("span", "lj-timebar__fill");
      bar.append(this.barFill);
      this.bar = bar;
      this.clock = html("span", "lj-clock");
      this.toggle = button("lj-button", "Pause");
      this.replay = button("lj-button", "Replay");
      this.toggle.addEventListener("click", () => this.togglePause());
      this.replay.addEventListener("click", () => this.restart());
      controls.append(bar, this.clock, this.toggle, this.replay);

      figure.append(
        stage,
        controls,
        caption(
          this,
          "Same clock, x at 2 Hz on both sides. Left: y at 3 Hz, the curve returns to its start at t = 1 s and retraces itself. Right: y at 2√2 ≈ 2.83 Hz, it never returns and keeps filling the square. The clock speeds up once the left curve has closed.",
        ),
      );
      this.replaceChildren(figure);
      this.setAttribute("role", "group");
      this.setAttribute("aria-label", "Rational and irrational Lissajous curves over time");
    }

    reset() {
      this.simulated = 0;

      for (const panel of this.panels) {
        panel.trace.replaceChildren();
        panel.points = [closurePoint(panel.curve, 0)];
        panel.chunkStart = 0;
        panel.path = null;
        panel.drawnTo = 0;
        panel.closed = false;
        panel.panel.classList.remove("is-closed");
      }

      this.update();
    }

    extend(panel, until) {
      const limit = Math.min(until, panel.curve.closesAt);

      while (panel.drawnTo + CLOSURE.step <= limit + 1e-9) {
        panel.drawnTo += CLOSURE.step;
        panel.points.push(closurePoint(panel.curve, Math.min(panel.drawnTo, panel.curve.closesAt)));

        if (panel.points.length - panel.chunkStart > CLOSURE.chunk) {
          this.flushChunk(panel);
          panel.chunkStart = panel.points.length - 1;
          panel.path = null;
        }
      }

      this.flushChunk(panel);
    }

    flushChunk(panel) {
      if (panel.points.length - panel.chunkStart < 2) {
        return;
      }

      if (!panel.path) {
        panel.path = svg("path", { class: "lj-curve" });
        panel.trace.append(panel.path);
      }

      panel.path.setAttribute("d", polylinePath(panel.points, panel.chunkStart));
    }

    seek(seconds) {
      const target = Math.min(seconds, CLOSURE.duration);

      if (target < this.elapsed) {
        this.reset();
      }

      this.elapsed = target;
      this.simulated = timelapseClock(target, CLOSURE);

      for (const panel of this.panels) {
        this.extend(panel, this.simulated);
      }

      this.update();
    }

    update() {
      const done = this.elapsed >= CLOSURE.duration;

      for (const panel of this.panels) {
        const [x, y] = toPlot(closurePoint(panel.curve, this.simulated)).split(" ");
        panel.pen.setAttribute("cx", x);
        panel.pen.setAttribute("cy", y);
        const closed = this.simulated >= panel.curve.closesAt;

        if (closed !== panel.closed) {
          panel.closed = closed;
          panel.panel.classList.toggle("is-closed", closed);
        }

        panel.status.textContent = closed
          ? "closed at t = 1 s"
          : panel.curve.closesAt === Infinity && this.simulated > 1
            ? "still open"
            : "";
      }

      this.clock.textContent = `t = ${this.simulated.toFixed(this.simulated < 10 ? 2 : 1)} s`;
      this.barFill.style.transform = `scaleX(${this.elapsed / CLOSURE.duration})`;
      this.bar.setAttribute("aria-valuenow", this.elapsed.toFixed(1));
      this.toggle.hidden = done || !this.started;
      this.toggle.textContent = this.userPaused ? "Play" : "Pause";
      this.classList.toggle("is-done", done);
    }

    togglePause() {
      this.userPaused = !this.userPaused;
      this.update();
      this.loop?.sync();
    }

    restart() {
      this.userPaused = false;
      this.started = true;
      this.elapsed = 0;
      this.reset();
      this.loop?.sync();
    }
  };

/* -------------------------------------------------------------------------- */
/* <pl-lissajous-gap>                                                         */
/* -------------------------------------------------------------------------- */

const GAP = Object.freeze({ hold: 2600, morph: 650, rays: 180 });
const DEFAULT_GAP_RATIOS = "5:3 7:5 9:7 11:9";

const parseRatios = (value) =>
  String(value || DEFAULT_GAP_RATIOS)
    .trim()
    .split(/[\s,]+/)
    .map((token) => token.split(":").map(Number))
    .filter(
      ([nx, ny]) =>
        Number.isInteger(nx) && Number.isInteger(ny) && nx > 0 && ny > 0 && nx <= 40 && ny <= 40,
    );

const cellPath = (center, radii) => {
  let d = "";

  for (let ray = 0; ray < radii.length; ray += 1) {
    const angle = (ray / radii.length) * TAU;
    const point = [center[0] + Math.cos(angle) * radii[ray], center[1] + Math.sin(angle) * radii[ray]];
    d += `${ray ? "L" : "M"}${toPlot(point)}`;
  }

  return `${d}Z`;
};

const easeInOut = (value) => (value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2);

const defineGap = () =>
  class LissajousGap extends HTMLElement {
    connectedCallback() {
      if (!this.built) {
        this.built = true;
        this.k = Number(this.getAttribute("k") ?? 2);
        this.ratios = parseRatios(this.getAttribute("ratios"));

        if (!this.ratios.length || !Number.isFinite(this.k)) {
          this.dataset.componentState = "error";
          return;
        }

        this.gaps = new Map();
        this.index = 0;
        this.userPaused = reducedMotion();
        this.render();
        this.show(0, { instant: true });
        this.dataset.componentState = "ready";
      }

      if (this.dataset.componentState !== "ready") {
        return;
      }

      this.wait = 0;
      this.loop = new FrameLoop(this, {
        isActive: () => this.morphing || !this.userPaused,
        onFrame: (dt) => this.frame(dt),
      });
    }

    disconnectedCallback() {
      this.loop?.destroy();
      this.loop = null;
    }

    gapFor(index) {
      if (!this.gaps.has(index)) {
        const [nx, ny] = this.ratios[index];
        this.gaps.set(index, centralGap(nx, ny, this.k, { rays: GAP.rays }));
      }

      return this.gaps.get(index);
    }

    render() {
      const figure = html("figure", "lj-figure lj-gap");
      const stage = html("div", "lj-stage lj-gap__stage");
      this.plot = plotSvg("Lissajous curve with its largest gap shaded");
      this.cell = svg("path", { class: "lj-cell" });
      this.curves = [svg("path", { class: "lj-curve lj-curve--swap" }), svg("path", { class: "lj-curve lj-curve--swap" })];
      this.disc = svg("circle", { class: "lj-disc" });
      this.plot.append(this.cell, ...this.curves, this.disc);
      stage.append(this.plot);

      const controls = html("div", "lj-controls");
      const picker = html("div", "lj-chips");
      picker.setAttribute("role", "group");
      picker.setAttribute("aria-label", "Frequency ratio");
      this.chips = this.ratios.map(([nx, ny], index) => {
        const chip = button("lj-chip", `${nx}:${ny}`, `Ratio ${nx} to ${ny}`);
        chip.addEventListener("click", () => {
          this.userPaused = true;
          this.show(index);
        });
        picker.append(chip);
        return chip;
      });
      this.readout = html("span", "lj-clock");
      this.toggle = button("lj-button", "");
      this.toggle.addEventListener("click", () => {
        this.userPaused = !this.userPaused;
        this.wait = 0;
        this.syncControls();
        this.loop?.sync();
      });
      controls.append(picker, this.readout, this.toggle);

      figure.append(
        stage,
        controls,
        caption(
          this,
          `Curves with k = ${this.k}. Shaded: the empty cell at the centre, traced from each curve. Dashed: the largest circle that fits between the lines, which is the curve's biggest gap. Its diameter matches the parallelogram height Wang et al. use as the fill factor.`,
        ),
      );
      this.replaceChildren(figure);
      this.setAttribute("role", "group");
      this.setAttribute("aria-label", "Central gap of Lissajous curves");
      this.front = 0;
    }

    syncControls() {
      this.toggle.textContent = this.userPaused ? "Play" : "Pause";
      this.chips.forEach((chip, index) => chip.setAttribute("aria-pressed", String(index === this.index)));
    }

    show(index, { instant = false } = {}) {
      const previous = this.current;
      const gap = this.gapFor(index);
      const [nx, ny] = this.ratios[index];
      this.index = index;
      this.current = gap;
      this.front = 1 - this.front;
      const front = this.curves[this.front];
      const back = this.curves[1 - this.front];
      front.setAttribute("d", `${polylinePath(gap.points)}Z`);
      front.classList.add("is-visible");
      back.classList.remove("is-visible");
      const percent = Math.round(gap.radius * 100);
      this.readout.textContent = `${nx}:${ny} · widest gap ${percent}% of the width`;
      this.plot.setAttribute(
        "aria-label",
        `Lissajous curve ${nx} to ${ny}, k = ${this.k}. Its largest gap, a near-parallelogram cell at the centre, is ${percent} percent of the scan width across.`,
      );
      this.syncControls();
      this.wait = 0;

      if (instant || !previous || reducedMotion()) {
        this.morphing = null;
        this.drawCell(gap.center, gap.radii, gap.radius);
      } else {
        this.morphing = { from: this.shown, progress: 0, to: gap };
      }

      this.loop?.sync();
    }

    drawCell(center, radii, radius) {
      this.shown = { center, radii, radius };
      this.cell.setAttribute("d", cellPath(center, radii));
      const [cx, cy] = toPlot(center).split(" ");
      this.disc.setAttribute("cx", cx);
      this.disc.setAttribute("cy", cy);
      this.disc.setAttribute("r", (radius * PLOT_SCALE).toFixed(2));
    }

    frame(dt) {
      if (this.morphing) {
        const morph = this.morphing;
        morph.progress = Math.min(1, morph.progress + (dt * 1000) / GAP.morph);
        const e = easeInOut(morph.progress);
        const mix = (a, b) => a + (b - a) * e;
        const radii = morph.to.radii.map((value, ray) => mix(morph.from.radii[ray], value));
        this.drawCell(
          [mix(morph.from.center[0], morph.to.center[0]), mix(morph.from.center[1], morph.to.center[1])],
          radii,
          mix(morph.from.radius, morph.to.radius),
        );

        if (morph.progress >= 1) {
          this.morphing = null;
          this.drawCell(morph.to.center, morph.to.radii, morph.to.radius);
        }

        return;
      }

      if (this.userPaused) {
        return;
      }

      // Compute the next cell during the still hold, not during the morph.
      if (this.wait === 0) {
        this.gapFor((this.index + 1) % this.ratios.length);
      }

      this.wait += dt * 1000;

      if (this.wait >= GAP.hold) {
        this.show((this.index + 1) % this.ratios.length);
      }
    }
  };

/* -------------------------------------------------------------------------- */
/* <pl-lissajous-intervals>                                                   */
/* -------------------------------------------------------------------------- */

const INTERVAL_VIEW = Object.freeze({
  maxCycles: 16, // longest window, in root periods (oscilloscope persistence)
  phase: Math.PI / 4,
  samplesPerCycle: 160,
  slowdown: 40,
});

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

/** A short piano-like tone: harmonic partials with fast attack, faster decay up high, and a hammer tick. */
const playPianoNote = (context, destination, frequency, when, velocity = 0.5) => {
  const length = 2.6;
  const voice = context.createGain();
  voice.gain.value = velocity;
  const tone = context.createBiquadFilter();
  tone.type = "lowpass";
  tone.Q.value = 0.4;
  tone.frequency.setValueAtTime(Math.min(9000, frequency * 14), when);
  tone.frequency.setTargetAtTime(Math.min(3000, frequency * 5), when + 0.01, 0.35);
  tone.connect(voice).connect(destination);

  for (let n = 1; n <= SYNTH_PARTIALS; n += 1) {
    const partialFrequency = frequency * n;

    if (partialFrequency > context.sampleRate / 2.2) {
      break;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const amplitude = (n === 1 ? 0.55 : 0.5 / n ** 1.15) * Math.abs(Math.sin((Math.PI * n) / 7.5) + 0.25);
    oscillator.frequency.value = partialFrequency;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(amplitude, when + 0.004);
    gain.gain.setTargetAtTime(0, when + 0.004, 0.9 / (1 + 0.45 * n));
    oscillator.connect(gain).connect(tone);
    oscillator.start(when);
    oscillator.stop(when + length);
  }

  const tick = context.createBufferSource();
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.03), context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < data.length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / data.length) ** 3;
  }

  const tickFilter = context.createBiquadFilter();
  tickFilter.type = "bandpass";
  tickFilter.frequency.value = Math.min(4000, frequency * 8);
  const tickGain = context.createGain();
  tickGain.gain.value = 0.08;
  tick.buffer = buffer;
  tick.connect(tickFilter).connect(tickGain).connect(destination);
  tick.start(when);
};

const formatCents = (cents) => {
  const value = Math.abs(cents);

  if (value < 0.05) {
    return "identical";
  }

  return `${value.toFixed(value < 10 ? 1 : 0)} cents ${cents > 0 ? "wider" : "narrower"}`;
};

const defineIntervals = () =>
  class LissajousIntervals extends HTMLElement {
    connectedCallback() {
      if (!this.built) {
        this.built = true;
        this.semitones = Math.min(12, Math.max(0, Number(this.getAttribute("interval") ?? 7) | 0));
        this.tuning = this.getAttribute("tuning") === "equal" ? "equal" : "just";
        this.drift = 0;
        this.render();
        this.select(this.semitones);
        this.dataset.componentState = "ready";
      }

      this.loop = new FrameLoop(this, {
        isActive: () => this.tuning === "equal" && !reducedMotion() && this.info.semitones % 12 !== 0,
        onFrame: (dt) => {
          this.drift += dt / INTERVAL_VIEW.slowdown;
          this.draw();
        },
      });
    }

    disconnectedCallback() {
      this.loop?.destroy();
      this.loop = null;

      if (this.audio) {
        this.audio.close().catch(() => {});
        this.audio = null;
        this.voice = null;
      }
    }

    render() {
      const figure = html("figure", "lj-figure lj-intervals");
      const stage = html("div", "lj-stage lj-intervals__stage");
      this.plot = plotSvg("Lissajous figure of the selected interval");
      this.curve = svg("path", { class: "lj-curve lj-curve--dense" });
      this.plot.append(this.curve);

      const panel = html("div", "lj-intervals__panel");
      this.name = html("div", "lj-intervals__name");
      this.facts = html("dl", "lj-facts");
      this.status = html("div", "lj-intervals__status");
      this.status.setAttribute("aria-live", "polite");
      panel.append(this.name, this.facts, this.status);
      stage.append(this.plot, panel);

      const keyboard = html("div", "lj-keys");
      keyboard.setAttribute("role", "radiogroup");
      keyboard.setAttribute("aria-label", "Second note, above C4");
      let white = 0;
      this.keys = INTERVALS.map((interval, semitones) => {
        const black = BLACK_KEYS.has(semitones);
        const key = button(`lj-key ${black ? "lj-key--black" : "lj-key--white"}`);
        const note = intervalInfo(semitones).noteName + (semitones === 12 ? "5" : "4");
        key.setAttribute("role", "radio");
        key.setAttribute("aria-label", `${note}, ${interval.name.toLowerCase()}`);
        key.style.setProperty("--key-index", black ? white - 0.32 : white);

        if (!black) {
          key.append(html("span", "lj-key__label", note));
          white += 1;
        }

        if (semitones === 0) {
          key.classList.add("is-root");
        }

        key.addEventListener("click", () => {
          this.select(semitones);
          this.play();
        });
        key.addEventListener("keydown", (event) => this.onKey(event, semitones));
        keyboard.append(key);
        return key;
      });
      keyboard.style.setProperty("--white-keys", white);

      figure.append(
        stage,
        keyboard,
        caption(
          this,
          this.tuning === "just"
            ? "C4 stays fixed; press another key to hear both notes and see their curve. Exact frequency ratios make the figures close. Sound is a piano-like tone synthesised in your browser."
            : `C4 against a second note in equal temperament. Press a key to hear both notes. The figure drifts ${INTERVAL_VIEW.slowdown}× slower than the beating you hear. Sound is a piano-like tone synthesised in your browser.`,
        ),
      );
      this.replaceChildren(figure);
      this.setAttribute("role", "group");
      this.setAttribute("aria-label", "Musical intervals as Lissajous figures");
    }

    onKey(event, semitones) {
      const moves = { ArrowDown: -1, ArrowLeft: -1, ArrowRight: 1, ArrowUp: 1, End: 12, Home: -12 };

      if (!(event.key in moves)) {
        return;
      }

      event.preventDefault();
      const next = Math.min(12, Math.max(0, semitones + moves[event.key]));
      this.select(next);
      this.keys[next].focus();
    }

    select(semitones) {
      this.semitones = semitones;
      this.keys.forEach((key, index) => {
        const selected = index === semitones;
        key.setAttribute("aria-checked", String(selected));
        key.tabIndex = selected ? 0 : -1;
      });
      this.update();
      this.loop?.sync();
    }

    update() {
      const info = intervalInfo(this.semitones, this.tuning);
      this.info = info;
      const [p, q] = info.ratio;
      const exact = Math.abs(info.cents) < 0.05;
      this.name.textContent = `${info.name} · C4–${info.noteName}${this.semitones === 12 ? "5" : "4"}`;

      const rows = [
        ["Simple ratio", `${p} : ${q} (${info.complexityLabel})`],
        ...(this.tuning === "equal" ? [[
          "Piano tuning",
          exact
            ? `exactly ${p} : ${q}`
            : `${info.equalRatio.toFixed(4)}, ${formatCents(info.cents)} than ${p} : ${q}`,
        ]] : []),
        ["Western theory", info.practice],
      ];
      this.facts.replaceChildren(
        ...rows.flatMap(([term, value]) => [html("dt", "", term), html("dd", "", value)]),
      );

      let status;

      if (this.tuning === "just" || exact) {
        status =
          q > INTERVAL_VIEW.maxCycles
            ? `Exact ${p} : ${q}: it closes, but only after ${q} cycles, so the figure stays busy.`
            : `Exact ${p} : ${q}: the figure closes on itself.`;
      } else {
        status =
          info.beatAudible && info.beat >= 0.05
            ? `Close to ${p} : ${q}, not equal: the figure drifts. Its overtones beat about ${info.beat.toFixed(info.beat < 10 ? 1 : 0)} times a second.`
            : `Close to ${p} : ${q}, not equal: the figure drifts.`;
      }

      this.status.textContent = status;
      this.draw();
    }

    draw() {
      const ratio = this.info.ratioValue;
      // One period of the nearest simple ratio: exact ratios close on
      // themselves, tempered ones miss slightly and drift.
      const total = Math.min(this.info.ratio[1], INTERVAL_VIEW.maxCycles) * INTERVAL_VIEW.samplesPerCycle;
      // Real frequencies in cycles of the root: the window start advances in
      // slowed real time, so only the tempered mismatch changes the figure.
      const start = this.tuning === "equal" && !reducedMotion() ? this.drift * ROOT_FREQUENCY : 0;
      let d = "";

      for (let index = 0; index <= total; index += 1) {
        const cycles = start + index / INTERVAL_VIEW.samplesPerCycle;
        const point = [
          Math.sin(TAU * (cycles % 1)),
          Math.sin(TAU * ((cycles * ratio) % 1) + INTERVAL_VIEW.phase),
        ];
        d += `${index ? "L" : "M"}${toPlot(point)}`;
      }

      this.curve.setAttribute("d", d);
    }

    async play() {
      try {
        const Context = globalThis.AudioContext || globalThis.webkitAudioContext;

        if (!Context) {
          return;
        }

        if (!this.audio) {
          this.audio = new Context();
          const master = this.audio.createGain();
          master.gain.value = 0.5;
          const limiter = this.audio.createDynamicsCompressor();
          limiter.threshold.value = -10;
          limiter.ratio.value = 6;
          master.connect(limiter).connect(this.audio.destination);
          this.master = master;
        }

        if (this.audio.state === "suspended") {
          await this.audio.resume();
        }

        const now = this.audio.currentTime + 0.02;
        // Damp the previous pair so repeated presses do not pile up.
        if (this.voice) {
          this.voice.gain.cancelScheduledValues(now);
          this.voice.gain.setTargetAtTime(0, now, 0.02);
          const old = this.voice;
          setTimeout(() => old.disconnect(), 400);
        }

        const voice = this.audio.createGain();
        voice.connect(this.master);
        this.voice = voice;
        playPianoNote(this.audio, voice, ROOT_FREQUENCY, now);
        playPianoNote(this.audio, voice, this.info.upperFrequency, now);
      } catch {
        // Audio is an enhancement; the figure still works without it.
      }
    }
  };

/* -------------------------------------------------------------------------- */
/* Registration                                                               */
/* -------------------------------------------------------------------------- */

if (typeof customElements !== "undefined" && typeof HTMLElement !== "undefined") {
  for (const [tag, factory] of [
    ["pl-lissajous-closure", defineClosure],
    ["pl-lissajous-gap", defineGap],
    ["pl-lissajous-intervals", defineIntervals],
  ]) {
    if (!customElements.get(tag)) {
      customElements.define(tag, factory());
    }
  }
}
