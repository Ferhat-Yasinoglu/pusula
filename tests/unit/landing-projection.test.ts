import test from "node:test";
import assert from "node:assert/strict";
import {
  BORDER_POINTS,
  CITIES,
  MAP_HEIGHT,
  MAP_WIDTH,
  arcControl,
  project,
  quadraticPoint,
  springStep,
} from "../../src/app/landing/landingGeometry.ts";
import {
  PROJECTED_STRIDE,
  arcPoint3,
  fibonacciSphere,
  liftArc,
  makeCamera,
  project3,
  ringPolyline,
  rotX,
  rotY,
  rotZ,
  updateCamera,
  vec3,
} from "../../src/app/landing/sim/landingProjection.ts";
import { bolt } from "../../src/app/landing/sim/lightning.ts";
import { hash32, mulberry32, shuffle, weightedIndex } from "../../src/app/landing/sim/prng.ts";
import {
  CAMERA,
  INTRO_NEEDLE,
  NEEDLE,
  RECALL,
  SPRINGS,
  TAPE,
  UI,
  isSettled,
  springAt,
  stepSpring,
} from "../../src/app/landing/runtime/springs.ts";

const EPS = 1e-3;

/** The map camera, flat and centred: the reference image's view. */
function flatMapCamera() {
  return makeCamera({
    yaw: 0,
    pitch: 0,
    F: 1.6 * 825,
    cx: MAP_WIDTH / 2,
    cy: MAP_HEIGHT / 2,
    scale: 1,
  });
}

test("projection: pitch 0 / yaw 0 reproduces project() from landingGeometry.ts", () => {
  // The map opens on the exact reference look: before the camera tilts, every
  // dot, city and border vertex must sit where the old flat SVG put it.
  const cam = flatMapCamera();
  const out = new Float32Array(PROJECTED_STRIDE);
  const lonLat = [
    ...CITIES.map((city) => [city.lon, city.lat] as const),
    [60.53, 33.68],
    [75.16, 37.13],
    [65.05, 29.47],
  ];
  for (const [lon, lat] of lonLat) {
    const p = project(lon, lat);
    const s = project3(cam, p.x - MAP_WIDTH / 2, p.y - MAP_HEIGHT / 2, 0, out, 0);
    assert.equal(s, 1, "a ground point at pitch 0 has no perspective");
    assert.ok(Math.abs(out[0] - p.x) < EPS, `x drift at ${lon},${lat}`);
    assert.ok(Math.abs(out[1] - p.y) < EPS, `y drift at ${lon},${lat}`);
    assert.ok(Math.abs(out[3]) < EPS, "ground points sit on the screen plane");
  }
  for (const p of BORDER_POINTS) {
    project3(cam, p.x - MAP_WIDTH / 2, p.y - MAP_HEIGHT / 2, 0, out, 0);
    assert.ok(Math.abs(out[0] - p.x) < EPS && Math.abs(out[1] - p.y) < EPS);
  }
});

test("projection: project3 writes only its own four slots and allocates into the caller's array", () => {
  const cam = flatMapCamera();
  const out = new Float32Array(12).fill(-7);
  project3(cam, 10, 20, 0, out, 4);
  assert.deepEqual([...out.slice(0, 4)], [-7, -7, -7, -7]);
  assert.deepEqual([...out.slice(8)], [-7, -7, -7, -7]);
  assert.ok(Math.abs(out[4] - (MAP_WIDTH / 2 + 10)) < EPS);
  assert.ok(Math.abs(out[5] - (MAP_HEIGHT / 2 + 20)) < EPS);
});

test("projection: tilting the map pushes the north edge away and raises pillars", () => {
  const cam = makeCamera({ yaw: 0, pitch: (52 * Math.PI) / 180, F: 1320, cx: 0, cy: 0, scale: 1 });
  const out = new Float32Array(PROJECTED_STRIDE * 3);
  project3(cam, 0, -200, 0, out, 0); // north of centre
  project3(cam, 0, 200, 0, out, 4); // south of centre
  project3(cam, 0, 0, 26, out, 8); // a pillar top on the centre
  assert.ok(out[3] > 0, "the north edge recedes");
  assert.ok(out[7] < 0, "the south edge comes closer");
  assert.ok(out[2] < 1 && out[6] > 1, "perspective shrinks the far side, grows the near");
  assert.ok(Math.abs(out[1]) < Math.abs(out[5]), "the far half is foreshortened more");
  assert.ok(out[9] < 0, "pillars rise up the screen");

  // Edge-on, the ground collapses onto the horizon line.
  updateCamera(cam, { yaw: 0, pitch: Math.PI / 2, F: Infinity, cx: 0, cy: 50, scale: 1 });
  project3(cam, 120, -300, 0, out, 0);
  assert.ok(Math.abs(out[1] - 50) < EPS);
});

test("projection: yaw spins the ground about its up axis", () => {
  const cam = makeCamera({ yaw: Math.PI / 2, pitch: 0, F: Infinity, cx: 0, cy: 0, scale: 2 });
  const out = new Float32Array(PROJECTED_STRIDE);
  project3(cam, 10, 0, 0, out, 0);
  assert.ok(Math.abs(out[0]) < EPS && Math.abs(out[1] - 20) < EPS);
});

test("projection: globe camera — front hemisphere is nearer, north pole tips towards the viewer", () => {
  const cam = makeCamera({ yaw: 0, pitch: 0.4, F: 3.2, cx: 100, cy: 100, scale: 50, up: "y" });
  const out = new Float32Array(PROJECTED_STRIDE * 3);
  project3(cam, 0, 0, 1, out, 0); // front
  project3(cam, 0, 0, -1, out, 4); // back
  project3(cam, 0, 1, 0, out, 8); // north pole
  assert.ok(out[3] < 0 && out[7] > 0);
  assert.ok(out[2] > out[6], "the front star is drawn larger");
  assert.ok(out[9] < 100, "the pole is above the centre (globe y grows up the screen)");
  assert.ok(out[11] < 0, "the pole leans towards the viewer");

  // Yaw about the vertical keeps every star on its latitude's screen height (orthographic).
  updateCamera(cam, { yaw: 1.1, pitch: 0, F: Infinity, cx: 0, cy: 0, scale: 1, up: "y" });
  project3(cam, 0.6, 0.8, 0, out, 0);
  assert.ok(Math.abs(out[1] + 0.8) < EPS);
});

test("projection: rotations preserve length and allow aliasing", () => {
  const v = vec3(1, 2, 3);
  const len = Math.hypot(1, 2, 3);
  for (const rotate of [rotX, rotY, rotZ]) {
    rotate(v, v, 0.7);
    assert.ok(Math.abs(Math.hypot(v[0], v[1], v[2]) - len) < 1e-9);
  }
  const p = rotZ(vec3(), vec3(1, 0, 0), Math.PI / 2);
  assert.ok(Math.abs(p[0]) < 1e-9 && Math.abs(p[1] - 1) < 1e-9);
  const q = rotX(vec3(), vec3(0, 1, 0), Math.PI / 2);
  assert.ok(Math.abs(q[1]) < 1e-9 && Math.abs(q[2] - 1) < 1e-9);
  const r = rotY(vec3(), vec3(0, 0, 1), Math.PI / 2);
  assert.ok(Math.abs(r[0] - 1) < 1e-9 && Math.abs(r[2]) < 1e-9);
});

test("projection: fibonacciSphere gives n unit vectors from pole to pole, evenly spread", () => {
  const n = 358;
  const pts = fibonacciSphere(n);
  assert.equal(pts.length, n * 3);
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (let i = 0; i < n; i++) {
    const [x, y, z] = [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]];
    assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 1e-5, `point ${i} is not on the unit sphere`);
    assert.ok(Math.abs(y - (1 - (2 * (i + 0.5)) / n)) < 1e-6);
    if (i > 0) assert.ok(y < pts[(i - 1) * 3 + 1], "y descends");
    sx += x;
    sy += y;
    sz += z;
  }
  // Even coverage: the centroid sits at the origin.
  assert.ok(Math.abs(sx / n) < 0.01 && Math.abs(sy / n) < 1e-6 && Math.abs(sz / n) < 0.01);
  assert.equal(fibonacciSphere(0).length, 0);
});

test("projection: ringPolyline closes the loop and keeps the horizon ring on its ellipse", () => {
  const segments = 48;
  const out = new Float32Array((segments + 1) * PROJECTED_STRIDE);
  const pitch = (23.4 * Math.PI) / 180;
  const cam = makeCamera({ yaw: 0.9, pitch, F: Infinity, cx: 0, cy: 0, scale: 1, up: "y" });
  assert.equal(ringPolyline(cam, 10, 0, segments, out), out.length);
  assert.ok(
    Math.abs(out[0] - out[segments * 4]) < EPS && Math.abs(out[1] - out[segments * 4 + 1]) < EPS
  );
  for (let i = 0; i <= segments; i++) {
    // Orthographic horizon ring: x² / R² + y² / (R·sin pitch)² = 1, whatever the yaw.
    const x = out[i * 4];
    const y = out[i * 4 + 1];
    const e = (x * x) / 100 + (y * y) / (10 * Math.sin(pitch)) ** 2;
    assert.ok(Math.abs(e - 1) < 1e-3, `vertex ${i} is off the ellipse (${e})`);
  }
  // On the flat map a ring around a city is a circle around that city.
  const mapCam = flatMapCamera();
  ringPolyline(mapCam, 140, 0, segments, out, 50, -20, 0);
  for (let i = 0; i < segments; i++) {
    const dx = out[i * 4] - (MAP_WIDTH / 2 + 50);
    const dy = out[i * 4 + 1] - (MAP_HEIGHT / 2 - 20);
    assert.ok(Math.abs(Math.hypot(dx, dy) - 140) < 1e-2);
  }
  assert.throws(() => ringPolyline(cam, 10, 0, segments, new Float32Array(8)), RangeError);
});

test("projection: liftArc keeps the flat arc's ground track and rises to apexRatio × chord", () => {
  const from = { x: 120, y: 300 };
  const to = { x: 520, y: 210 };
  const arc = liftArc(from, to, 0.35);
  const chord = Math.hypot(to.x - from.x, to.y - from.y);
  const control = arcControl(from, to);
  const p = vec3();
  for (const t of [0, 0.2, 0.5, 0.8, 1]) {
    arcPoint3(arc, t, p);
    const flat = quadraticPoint(from, control, to, t);
    assert.ok(Math.abs(p[0] - flat.x) < 1e-9 && Math.abs(p[1] - flat.y) < 1e-9);
  }
  assert.equal(arcPoint3(arc, 0, p)[2], 0);
  assert.equal(arcPoint3(arc, 1, p)[2], 0);
  assert.ok(Math.abs(arcPoint3(arc, 0.5, p)[2] - 0.35 * chord) < 1e-9);
});

test("lightning: a bolt is seeded, spans its endpoints and forks off the middle", () => {
  const a = bolt(0, 0, 0, 300, mulberry32(7));
  const b = bolt(0, 0, 0, 300, mulberry32(7));
  assert.deepEqual([...a.main], [...b.main], "same seed, same bolt");
  assert.equal(a.main.length, ((1 << 6) + 1) * 2);
  assert.deepEqual([a.main[0], a.main[1]], [0, 0]);
  assert.deepEqual([a.main[a.main.length - 2], a.main[a.main.length - 1]], [0, 300]);
  assert.ok(a.branches.length >= 1 && a.branches.length <= 3);
  for (let i = 0; i < a.main.length; i += 2) {
    assert.ok(Math.abs(a.main[i]) < 300 * 0.5, "the channel never wanders off its chord");
  }
  for (const fork of a.branches) {
    assert.ok(fork[1] > 0 && fork[1] < 300, "forks leave from inside the channel");
  }
  const c = bolt(0, 0, 0, 300, mulberry32(8));
  assert.notDeepEqual([...a.main], [...c.main]);
});

test("prng: mulberry32 and hash32 are deterministic; helpers stay in range", () => {
  const r1 = mulberry32(42);
  const r2 = mulberry32(42);
  for (let i = 0; i < 100; i++) {
    const v = r1();
    assert.equal(v, r2());
    assert.ok(v >= 0 && v < 1);
  }
  assert.equal(hash32("star", 3), hash32("star", 3));
  assert.notEqual(hash32("ab", "c"), hash32("a", "bc"));
  const deck = shuffle(mulberry32(1), [1, 2, 3, 4, 5]);
  assert.deepEqual([...deck].sort(), [1, 2, 3, 4, 5]);
  assert.equal(weightedIndex(mulberry32(1), [0, 0, 0]), -1);
  assert.equal(weightedIndex(mulberry32(1), [0, Number.NaN, 2]), 2);
});

test("runtime springs: the §2 table, integrated with landingGeometry's springStep", () => {
  assert.deepEqual(NEEDLE, { stiffness: 70, damping: 0.42 });
  assert.deepEqual(INTRO_NEEDLE, { stiffness: 55, damping: 0.32 });
  assert.deepEqual(TAPE, { stiffness: 120, damping: 0.9 });
  assert.deepEqual(RECALL, { stiffness: 180, damping: 0.8 });
  assert.deepEqual(CAMERA, { stiffness: 40, damping: 1 });
  assert.deepEqual(UI, { stiffness: 180, damping: 0.7 });
  assert.deepEqual(Object.keys(SPRINGS).sort(), [
    "CAMERA",
    "INTRO_NEEDLE",
    "NEEDLE",
    "RECALL",
    "TAPE",
    "UI",
  ]);

  // A short frame is exactly one springStep with the preset's constants.
  const state = springAt(0);
  const expected = springStep({ angle: 0, velocity: 0 }, 90, 1 / 120, 70, 0.42);
  stepSpring(state, 90, 1 / 120, NEEDLE);
  assert.ok(Math.abs(state.angle - expected.angle) < 1e-12);

  // Every preset settles on its target; the under-damped needle overshoots first.
  for (const config of Object.values(SPRINGS)) {
    const s = springAt(0);
    let peak = 0;
    for (let i = 0; i < 60 * 8; i++) {
      stepSpring(s, 90, 1 / 60, config);
      peak = Math.max(peak, s.angle);
    }
    assert.ok(isSettled(s, 90), `a spring did not settle: ${JSON.stringify(config)}`);
    if (config === NEEDLE) assert.ok(peak > 90, "the needle overshoots");
    if (config === CAMERA) assert.ok(peak <= 90 + 1e-6, "the camera never overshoots");
  }
  // A resumed tab cannot launch a needle: a huge dt is clamped.
  const resumed = springAt(0);
  stepSpring(resumed, 90, 30, NEEDLE);
  assert.ok(resumed.angle < 90);
});
