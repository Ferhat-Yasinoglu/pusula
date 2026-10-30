import test from "node:test";
import assert from "node:assert/strict";
import {
  BORDER_POINTS,
  CITIES,
  CITY_POINTS,
  DIAL_CX,
  DIAL_CY,
  DIAL_HEIGHT,
  DIAL_WIDTH,
  DOT_LEVELS,
  MAP_HEIGHT,
  MAP_WIDTH,
  arcControl,
  buildDotGrid,
  nearestEquivalentAngle,
  needleTransform,
  pointInPolygon,
  polar,
  quadraticPoint,
  springStep,
  type SpringState,
} from "../../src/app/landing/landingGeometry.ts";

test("astrolabe: the needle pivots on the dial centre", () => {
  // Regression: the old instrument rotated around a fixed CSS origin (160,160)
  // while the dial was centred at (176,176), so the needle swung off-axis and
  // pointed away from the provider it had chosen.
  assert.equal(DIAL_CX, DIAL_WIDTH / 2);
  assert.equal(DIAL_CY, DIAL_HEIGHT / 2);
  for (const angle of [0, 42, 108, 212.5, -30, 400]) {
    const match = /^rotate\((-?[\d.]+) (-?[\d.]+) (-?[\d.]+)\)$/.exec(needleTransform(angle));
    assert.ok(match, `unexpected transform for ${angle}`);
    assert.equal(Number(match[2]), DIAL_CX);
    assert.equal(Number(match[3]), DIAL_CY);
  }
});

test("astrolabe: a bearing points where the needle's rotation points", () => {
  // The needle is drawn pointing north; rotate(b) must land its tip on polar(b).
  for (const bearing of [0, 42, 90, 108, 180, 288]) {
    const tip = polar(DIAL_CX, DIAL_CY, bearing, 100);
    const rad = (bearing * Math.PI) / 180;
    const rotated = {
      x: DIAL_CX + Math.sin(rad) * 100,
      y: DIAL_CY - Math.cos(rad) * 100,
    };
    assert.ok(Math.abs(tip.x - rotated.x) < 0.01, `x drift at ${bearing}`);
    assert.ok(Math.abs(tip.y - rotated.y) < 0.01, `y drift at ${bearing}`);
  }
});

test("astrolabe: the needle always takes the short way round", () => {
  assert.equal(nearestEquivalentAngle(350, 10), 370);
  assert.equal(nearestEquivalentAngle(10, 350), -10);
  assert.equal(nearestEquivalentAngle(720 + 42, 108), 720 + 108);
  assert.equal(nearestEquivalentAngle(-400, 0), -360);
  for (const [current, target] of [
    [0, 179],
    [0, 181],
    [1000, 3],
    [-77, 300],
  ]) {
    const result = nearestEquivalentAngle(current, target);
    assert.ok(Math.abs(result - current) <= 180, `${current}→${target} gave ${result}`);
    assert.equal((((result - target) % 360) + 360) % 360, 0);
  }
});

test("astrolabe: the spring settles on its target with a small overshoot", () => {
  let state: SpringState = { angle: 0, velocity: 0 };
  let peak = 0;
  for (let i = 0; i < 240; i += 1) {
    state = springStep(state, 100, 1 / 60);
    peak = Math.max(peak, state.angle);
  }
  assert.ok(Math.abs(state.angle - 100) < 0.5, `did not settle: ${state.angle}`);
  assert.ok(peak > 100, "a compass card should overshoot a little");
  assert.ok(peak < 125, `overshoot too large: ${peak}`);
});

test("astrolabe: a long frame gap cannot launch the needle", () => {
  const state = springStep({ angle: 0, velocity: 0 }, 180, 5);
  assert.ok(Math.abs(state.angle) < 180, `jumped to ${state.angle}`);
  assert.deepEqual(springStep({ angle: 3, velocity: 0 }, 3, -1), { angle: 3, velocity: 0 });
});

test("route map: every city sits inside the border and inside the drawing", () => {
  for (const city of CITIES) {
    const point = CITY_POINTS[city.id];
    assert.ok(pointInPolygon(point, BORDER_POINTS), `${city.id} is outside the border`);
    assert.ok(point.x > 0 && point.x < MAP_WIDTH && point.y > 0 && point.y < MAP_HEIGHT);
  }
  assert.equal(CITIES.filter((city) => city.hub).length, 1);
  assert.ok(!pointInPolygon({ x: 1, y: 1 }, BORDER_POINTS));
});

test("route map: the dot matrix stays inside the border and uses every band", () => {
  const dots = buildDotGrid(10);
  assert.ok(dots.length > 1000, `only ${dots.length} dots`);
  const levels = new Set<number>();
  for (const dot of dots) {
    assert.ok(pointInPolygon(dot, BORDER_POINTS));
    assert.ok(Number.isInteger(dot.level) && dot.level >= 0 && dot.level < DOT_LEVELS);
    levels.add(dot.level);
  }
  assert.equal(levels.size, DOT_LEVELS);
  // Deterministic: the server and the client must draw the same map.
  assert.deepEqual(buildDotGrid(10), dots);
});

test("route map: flight arcs bow upwards and start and end on their cities", () => {
  const pairs = [
    [CITY_POINTS.herat, CITY_POINTS.kabul],
    [CITY_POINTS.kabul, CITY_POINTS.herat],
    [CITY_POINTS.kunduz, CITY_POINTS.kandahar],
  ];
  for (const [from, to] of pairs) {
    const control = arcControl(from, to, 0.3);
    assert.ok(control.y < (from.y + to.y) / 2, "arc should bow up the screen");
    const start = quadraticPoint(from, control, to, 0);
    const end = quadraticPoint(from, control, to, 1);
    assert.deepEqual({ x: start.x, y: start.y }, { x: from.x, y: from.y });
    assert.ok(Math.abs(end.x - to.x) < 1e-9 && Math.abs(end.y - to.y) < 1e-9);
  }
});
