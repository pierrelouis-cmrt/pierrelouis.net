import assert from "node:assert/strict";
import test from "node:test";

import {
  INTERVALS,
  ROOT_FREQUENCY,
  centralGap,
  distanceToPolyline,
  intervalInfo,
  sampleLissajous,
  timelapseClock,
} from "../posts/components/lissajous-figures.js";

const close = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);

test("time-lapse closes the rational curve early and ends within 10 s", () => {
  assert.equal(timelapseClock(0), 0);
  close(timelapseClock(2.5), 1, 1e-12, "closes at 2.5 s");
  close(timelapseClock(10), 14, 1e-9, "ends at simulated 14 s");
  assert.equal(timelapseClock(42), timelapseClock(10));

  // Monotonic and continuous in slope at the hand-off.
  let previous = -1;
  for (let s = 0; s <= 10; s += 0.01) {
    const value = timelapseClock(s);
    assert.ok(value > previous);
    previous = value;
  }
  const h = 1e-6;
  close(
    (timelapseClock(2.5 + h) - timelapseClock(2.5)) / h,
    (timelapseClock(2.5) - timelapseClock(2.5 - h)) / h,
    1e-4,
    "C1 at closure",
  );
});

test("2:3 returns to its start after one period; 1:√2 does not", () => {
  const phase = Math.PI / 4;
  const point = (fx, fy, t) => [Math.cos(2 * Math.PI * fx * t), Math.cos(2 * Math.PI * fy * t + phase)];
  const [x0, y0] = point(2, 3, 0);
  const [x1, y1] = point(2, 3, 1);
  close(Math.hypot(x1 - x0, y1 - y0), 0, 1e-12, "rational closes");

  // Over the simulated 14 s the irrational state (both phases) never repeats.
  let nearest = Infinity;
  for (let t = 0.05; t <= 14; t += 1e-4) {
    const ax = (2 * t) % 1;
    const ay = (2 * Math.SQRT2 * t) % 1;
    const distance = Math.hypot(Math.min(ax, 1 - ax), Math.min(ay, 1 - ay));
    nearest = Math.min(nearest, distance);
  }
  assert.ok(nearest > 1e-3, `irrational came within ${nearest} of its start state`);
});

test("default gap figures: largest gap sits at the origin inside a rhombus", () => {
  const expected = { "5:3": 0.2674, "7:5": 0.182, "9:7": 0.1375, "11:9": 0.1104 };

  for (const [key, radius] of Object.entries(expected)) {
    const [nx, ny] = key.split(":").map(Number);
    const gap = centralGap(nx, ny, 2);
    assert.deepEqual(gap.center, [0, 0], `${key} centre`);
    close(gap.radius, radius, 5e-4, `${key} radius`);

    // Independent brute-force check: no point in the square is farther from
    // the curve than the reported gap.
    const points = sampleLissajous(nx, ny, 2);
    let farthest = 0;
    for (let i = 0; i <= 60; i += 1) {
      for (let j = 0; j <= 60; j += 1) {
        farthest = Math.max(farthest, distanceToPolyline([-1 + i / 30, -1 + j / 30], points));
      }
    }
    assert.ok(farthest <= gap.radius + 1e-6, `${key}: found gap ${farthest} > ${gap.radius}`);

    // The traced cell is a rhombus: symmetric about both axes, vertices on the
    // axes, and its sides touch the largest circle (height = 2r).
    const rays = gap.radii.length;
    const quarter = rays / 4;
    for (let ray = 0; ray < quarter; ray += 1) {
      close(gap.radii[ray], gap.radii[rays / 2 - ray] ?? gap.radii[0], 1e-6, `${key} mirror y`);
      close(gap.radii[ray], gap.radii[(rays - ray) % rays], 1e-6, `${key} mirror x`);
    }
    const minimum = Math.min(...gap.radii);
    assert.ok(minimum >= gap.radius - 1e-3, `${key}: cell narrower than its circle`);
    close(minimum, gap.radius, 0.01, `${key}: circle touches the sides`);
    assert.ok(gap.radii[0] > gap.radius * 1.3, `${key}: x vertex is a corner`);
    assert.ok(gap.radii[quarter] > gap.radius * 1.1, `${key}: y vertex is a corner`);
  }
});

test("gap shrinks as the ratio grows", () => {
  const radii = ["5:3", "7:5", "9:7", "11:9"].map((key) => centralGap(...key.split(":").map(Number), 2).radius);
  for (let index = 1; index < radii.length; index += 1) {
    assert.ok(radii[index] < radii[index - 1]);
  }
});

test("interval table: equal temperament against just ratios in cents", () => {
  close(ROOT_FREQUENCY, 261.6256, 1e-3, "C4");
  assert.equal(INTERVALS.length, 13);

  const fifth = intervalInfo(7);
  close(fifth.equalRatio, 1.498307, 1e-6, "ET fifth");
  close(fifth.cents, -1.955, 1e-3, "fifth is ~1.96 ¢ narrow");
  close(intervalInfo(4).cents, 13.686, 1e-3, "major third ~13.7 ¢ wide");
  close(intervalInfo(3).cents, -15.641, 1e-3, "minor third ~15.6 ¢ narrow");
  close(intervalInfo(5).cents, 1.955, 1e-3, "fourth ~1.96 ¢ wide");
  close(intervalInfo(12).cents, 0, 1e-12, "octave exact");
  close(intervalInfo(0).cents, 0, 1e-12, "unison exact");

  // Only unison and octave are rational in equal temperament.
  for (let semitones = 1; semitones < 12; semitones += 1) {
    assert.ok(Math.abs(intervalInfo(semitones).cents) > 1, `${semitones} differs from just`);
  }

  // Beat between coinciding overtones: |q f2 - p f1|.
  close(fifth.beat, Math.abs(2 * ROOT_FREQUENCY * fifth.equalRatio - 3 * ROOT_FREQUENCY), 1e-9, "fifth beat");
  close(intervalInfo(4).beat, 10.38, 0.01, "major third beats ~10 Hz");
  assert.equal(intervalInfo(7, "just").beat, 0);
  close(intervalInfo(7, "just").upperFrequency, ROOT_FREQUENCY * 1.5, 1e-9, "just fifth frequency");
  assert.equal(intervalInfo(6).beatAudible, false);
  assert.equal(intervalInfo(7).complexityLabel, "very simple");
  assert.equal(intervalInfo(6).complexityLabel, "complex");
});
