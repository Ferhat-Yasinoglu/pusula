import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_FRAME_DT,
  MAX_LIVE_CANVASES,
  MAX_SIM_CATCH_UP,
  QUALITY_RELAX_HOLD_MS,
  QUALITY_WINDOW,
  SIM_STEP_MS,
  createHeartbeat,
  type HeartbeatHost,
} from "../../src/app/landing/runtime/heartbeat.ts";
import {
  STATIONS,
  STATION_IDS,
  buildHeadingKnots,
  headingAt,
  pickActiveStation,
  reanchorTarget,
  readingAnchor,
  type StationId,
} from "../../src/app/landing/runtime/stations.ts";
import {
  pinApplies,
  pinProgress,
  traverseProgress,
} from "../../src/app/landing/runtime/scrollProgress.ts";
import {
  COARSE_HEIGHT_JITTER_PX,
  isIgnorableResize,
  stageDpr,
} from "../../src/app/landing/runtime/useCanvasStage.ts";
import { GLOW_RGB, glowAlphaAt } from "../../src/app/landing/runtime/glowSprites.ts";

/* ------------------------------------------------------------------------ */
/* Heartbeat                                                                */
/* ------------------------------------------------------------------------ */

type FakeHost = HeartbeatHost & {
  hidden: boolean;
  reduced: boolean;
  stored: boolean;
  errors: string[];
};

function fakeBrowser(initiallyPaused = false) {
  const frames = new Map<number, (now: number) => void>();
  let nextHandle = 1;
  const host: FakeHost = {
    hidden: false,
    reduced: false,
    stored: initiallyPaused,
    errors: [],
    requestFrame(callback) {
      const handle = nextHandle++;
      frames.set(handle, callback);
      return handle;
    },
    cancelFrame(handle) {
      frames.delete(handle);
    },
    isHidden: () => host.hidden,
    isReducedMotion: () => host.reduced,
    readPaused: () => host.stored,
    writePaused(paused) {
      host.stored = paused;
    },
    syncPaused() {},
    reportError(id) {
      host.errors.push(id);
    },
  };
  /** Fire every pending frame at `now`. */
  const frame = (now: number) => {
    const due = [...frames.values()];
    frames.clear();
    for (const callback of due) callback(now);
  };
  /** Fire frames every `interval` ms from `from` (exclusive of `to`). */
  const run = (from: number, to: number, interval: number) => {
    for (let now = from; now < to; now += interval) frame(now);
  };
  return { host, frame, run, pending: () => frames.size };
}

test("heartbeat: the loop runs only while something is registered", () => {
  const { host, frame, pending } = fakeBrowser();
  const heartbeat = createHeartbeat(host);
  assert.equal(heartbeat.isRunning(), false);
  assert.equal(pending(), 0);

  let ticks = 0;
  const unregister = heartbeat.register({ id: "dom", lane: "dom", tick: () => ticks++ });
  assert.equal(heartbeat.isRunning(), true);
  frame(0);
  frame(16);
  assert.equal(ticks, 2);

  unregister();
  unregister(); // idempotent
  assert.equal(heartbeat.isRunning(), false);
  assert.equal(pending(), 0);
});

test("heartbeat: the sim lane steps exactly 100 ms of real time at a time", () => {
  const { host, run } = fakeBrowser();
  const heartbeat = createHeartbeat(host);
  const dts: number[] = [];
  heartbeat.register({ id: "sim", lane: "sim", tick: (dt) => dts.push(dt) });
  run(0, 1001, 20); // 50 fps for exactly one second
  assert.equal(dts.length, 10);
  assert.ok(dts.every((dt) => dt === SIM_STEP_MS / 1000));
});

test("heartbeat: a stalled frame catches up at most 5 sim steps and drops the rest", () => {
  const { host, frame } = fakeBrowser();
  const heartbeat = createHeartbeat(host);
  let steps = 0;
  heartbeat.register({ id: "sim", lane: "sim", tick: () => steps++ });
  frame(0);
  frame(3000); // a 3 s stall
  assert.equal(steps, MAX_SIM_CATCH_UP);
  frame(3016);
  assert.equal(steps, MAX_SIM_CATCH_UP, "the backlog beyond the catch-up cap is dropped");
});

test("heartbeat: canvas and dom dt is clamped, and the first frame after a start is 0", () => {
  const { host, frame } = fakeBrowser();
  const heartbeat = createHeartbeat(host);
  const dts: number[] = [];
  heartbeat.register({ id: "dom", lane: "dom", tick: (dt) => dts.push(dt) });
  frame(1000);
  frame(1016);
  frame(1500);
  assert.equal(dts[0], 0);
  assert.ok(Math.abs(dts[1] - 0.016) < 1e-9);
  assert.equal(dts[2], MAX_FRAME_DT);
});

test("heartbeat: only the two most visible × prioritised canvases tick", () => {
  const { host, frame } = fakeBrowser();
  const heartbeat = createHeartbeat(host);
  const ticked: string[] = [];
  const canvas = (id: string, visibility: number, priority?: number) =>
    heartbeat.register({
      id,
      lane: "canvas",
      tick: () => ticked.push(id),
      visibility: () => visibility,
      priority,
    });
  canvas("map", 0.6);
  canvas("hero", 0.4, 1); // 0.8
  canvas("storm", 0.7); // 0.7
  canvas("offscreen", 0, 5); // never
  frame(0);
  assert.equal(MAX_LIVE_CANVASES, 2);
  assert.deepEqual(ticked, ["hero", "storm"]);
});

test("heartbeat: equal canvases keep registration order, so they never flicker", () => {
  const { host, frame } = fakeBrowser();
  const heartbeat = createHeartbeat(host);
  const ticked: string[] = [];
  for (const id of ["a", "b", "c"]) {
    heartbeat.register({ id, lane: "canvas", tick: () => ticked.push(id), visibility: () => 1 });
  }
  frame(0);
  frame(16);
  assert.deepEqual(ticked, ["a", "b", "a", "b"]);
});

test("heartbeat: lanes run sim → canvas → dom within a frame", () => {
  const { host, frame } = fakeBrowser();
  const heartbeat = createHeartbeat(host);
  const order: string[] = [];
  heartbeat.register({ id: "d", lane: "dom", tick: () => order.push("dom") });
  heartbeat.register({ id: "c", lane: "canvas", tick: () => order.push("canvas") });
  heartbeat.register({ id: "s", lane: "sim", tick: () => order.push("sim") });
  frame(0);
  frame(120);
  assert.deepEqual(order, ["canvas", "dom", "sim", "canvas", "dom"]);
});

test("heartbeat: Pause stops everything, persists, notifies, and resumes without a jump", () => {
  const { host, frame, pending } = fakeBrowser();
  const heartbeat = createHeartbeat(host);
  let notified = 0;
  heartbeat.subscribe(() => notified++);
  const dts: number[] = [];
  heartbeat.register({ id: "dom", lane: "dom", tick: (dt) => dts.push(dt) });
  frame(0);

  heartbeat.setPaused(true);
  assert.equal(heartbeat.isPaused(), true);
  assert.equal(host.stored, true);
  assert.equal(heartbeat.isRunning(), false);
  assert.equal(pending(), 0);
  assert.equal(notified, 1);

  heartbeat.setPaused(true); // no-op
  assert.equal(notified, 1);

  heartbeat.setPaused(false);
  frame(60_000);
  assert.equal(dts.at(-1), 0, "the first frame after a resume has dt 0");
  assert.equal(notified, 2);
});

test("heartbeat: a stored Pause is honoured from the start", () => {
  const { host } = fakeBrowser(true);
  const heartbeat = createHeartbeat(host);
  heartbeat.register({ id: "dom", lane: "dom", tick: () => {} });
  assert.equal(heartbeat.isPaused(), true);
  assert.equal(heartbeat.isRunning(), false);
});

test("heartbeat: hidden tabs and reduced motion never run the loop", () => {
  const { host } = fakeBrowser();
  const heartbeat = createHeartbeat(host);
  host.reduced = true;
  heartbeat.register({ id: "dom", lane: "dom", tick: () => {} });
  assert.equal(heartbeat.isRunning(), false);

  host.reduced = false;
  heartbeat.refresh();
  assert.equal(heartbeat.isRunning(), true);

  host.hidden = true;
  heartbeat.refresh();
  assert.equal(heartbeat.isRunning(), false);
});

test("heartbeat: quality tier rises on slow frames and relaxes after 5 s of fast ones", () => {
  const { host, run } = fakeBrowser();
  const heartbeat = createHeartbeat(host);
  heartbeat.register({ id: "dom", lane: "dom", tick: () => {} });

  let now = 0;
  const frames = (count: number, interval: number) => {
    run(now, now + count * interval, interval);
    now += count * interval;
  };

  frames(QUALITY_WINDOW + 1, 25);
  assert.equal(heartbeat.getQualityTier(), 1);
  frames(QUALITY_WINDOW, 25);
  assert.equal(heartbeat.getQualityTier(), 2);
  frames(QUALITY_WINDOW * 3, 25);
  assert.equal(heartbeat.getQualityTier(), 2, "the tier is capped at 2");

  // 16.7 ms frames (a healthy 60 Hz display) are neither slow nor fast enough to relax.
  frames(600, 1000 / 60);
  assert.equal(heartbeat.getQualityTier(), 2);

  frames(Math.ceil((QUALITY_WINDOW * 8 + QUALITY_RELAX_HOLD_MS) / 8), 8);
  assert.equal(heartbeat.getQualityTier(), 1);
  frames(Math.ceil(QUALITY_RELAX_HOLD_MS / 8) + 1, 8);
  assert.equal(heartbeat.getQualityTier(), 0);
});

test("heartbeat: stalls longer than 250 ms are not counted as load", () => {
  const { host, run } = fakeBrowser();
  const heartbeat = createHeartbeat(host);
  heartbeat.register({ id: "dom", lane: "dom", tick: () => {} });
  run(0, QUALITY_WINDOW * 2 * 400, 400);
  assert.equal(heartbeat.getQualityTier(), 0);
});

test("heartbeat: a throwing tick is dropped and reported; the rest keep running", () => {
  const { host, frame } = fakeBrowser();
  const heartbeat = createHeartbeat(host);
  let healthy = 0;
  heartbeat.register({
    id: "broken",
    lane: "dom",
    tick: () => {
      throw new Error("boom");
    },
  });
  heartbeat.register({ id: "healthy", lane: "dom", tick: () => healthy++ });
  frame(0);
  frame(16);
  assert.deepEqual(host.errors, ["broken"]);
  assert.equal(healthy, 2);
});

/* ------------------------------------------------------------------------ */
/* Stations and heading                                                     */
/* ------------------------------------------------------------------------ */

test("stations: eight stations on the eight principal winds, in page order (§4)", () => {
  assert.deepEqual(STATION_IDS, [
    "bridge",
    "network",
    "catalog",
    "routing",
    "resilience",
    "tools",
    "engine",
    "launch",
  ]);
  assert.deepEqual(
    STATIONS.map((station) => station.bearing),
    [0, 45, 90, 135, 180, 225, 270, 315]
  );
  assert.deepEqual(
    STATIONS.map((station) => station.point),
    ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
  );
  assert.deepEqual(
    STATIONS.map((station) => station.navKey),
    [
      "brandName",
      "navMap",
      "navCatalog",
      "navRouting",
      "navResilience",
      "navTools",
      "navUnderTheHood",
      "navDashboard",
    ]
  );
  STATIONS.forEach((station, index) => assert.equal(station.index, index));
});

test("heading: north at the top, each bearing at its station, north again at the bottom", () => {
  const bearings = STATIONS.map((station) => station.bearing);
  const tops = [0, 1000, 2600, 3600, 5800, 6800, 7800, 9200];
  const viewport = 900;
  const maxScroll = 10_500;
  const knots = buildHeadingKnots(tops, bearings, viewport, maxScroll);

  assert.equal(headingAt(knots, 0), 0);
  assert.equal(headingAt(knots, -50), 0, "overscroll clamps");
  for (let i = 1; i < tops.length; i++) {
    assert.equal(headingAt(knots, tops[i] - viewport / 2), bearings[i]);
  }
  assert.equal(headingAt(knots, maxScroll), 360);
  assert.equal(headingAt(knots, maxScroll + 400), 360);

  // Halfway between the catalog and routing anchors.
  const mid = (tops[2] + tops[3]) / 2 - viewport / 2;
  assert.equal(headingAt(knots, mid), 112.5);

  let previous = -1;
  for (let y = 0; y <= maxScroll; y += 37) {
    const heading = headingAt(knots, y);
    assert.ok(heading >= previous, `heading went backwards at ${y}`);
    previous = heading;
  }
});

test("heading: degenerate layouts still give a monotonic curve", () => {
  // Stations crammed above the anchor line, and a page that barely scrolls.
  const knots = buildHeadingKnots([0, 10, 20, 30], [0, 45, 90, 135], 900, 0);
  for (let i = 2; i < knots.length; i += 2) assert.ok(knots[i] > knots[i - 2]);
  assert.equal(headingAt(buildHeadingKnots([], [], 900, 1000), 500), 0);
});

test("active station: the deepest station in the band wins, none keeps the last", () => {
  const set = (...ids: StationId[]) => new Set<StationId>(ids);
  assert.equal(pickActiveStation(set("catalog", "network"), "bridge"), "catalog");
  assert.equal(pickActiveStation(set(), "launch"), "launch");
  assert.equal(pickActiveStation(set("bridge"), "network"), "bridge");
});

test("re-anchor: a width change puts the station being read back under the nav", () => {
  // Portrait: routing at 2400, 1830 tall; the visitor has its top just under a 52px nav.
  const tops = [0, 977, 1739, 2916, 4746];
  const heights = [977, 762, 1177, 1830, 1009];
  const anchor = readingAnchor(tops, heights, 2916 - 52, 52, 9000);
  assert.deepEqual(anchor, { kind: "station", index: 3, fraction: 0 });
  // Landscape: everything above reflowed; the same station top lands under the nav again.
  const wideTops = [0, 390, 1600, 4200, 6600];
  const wideHeights = [390, 1210, 2600, 2400, 1500];
  assert.equal(reanchorTarget(anchor!, wideTops, wideHeights, 52, 20000), 4200 - 52);
  // Halfway through a station stays halfway through it.
  const half = readingAnchor(tops, heights, 2916 + 915 - 52, 52, 9000);
  assert.ok(half && half.kind === "station" && Math.abs(half.fraction - 0.5) < 1e-9);
  assert.equal(reanchorTarget(half!, wideTops, wideHeights, 56, 20000), 4200 + 1200 - 56);
});

test("re-anchor: below the last station keeps the distance from the bottom, targets clamp", () => {
  const anchor = readingAnchor([0, 1000], [1000, 1000], 2400, 52, 2600);
  assert.deepEqual(anchor, { kind: "bottom", fromBottom: 200 });
  assert.equal(reanchorTarget(anchor!, [0, 800], [800, 800], 52, 1900), 1700);
  assert.equal(readingAnchor([], [], 0, 52, 0), null);
  // A station index the new layout lacks gives no target; out-of-range targets clamp.
  assert.equal(reanchorTarget({ kind: "station", index: 4, fraction: 0 }, [0], [10], 0, 100), null);
  assert.equal(
    reanchorTarget({ kind: "station", index: 1, fraction: 1 }, [0, 90], [90, 90], 0, 100),
    100
  );
  assert.equal(reanchorTarget({ kind: "station", index: 0, fraction: 0 }, [0], [90], 52, 100), 0);
});

/* ------------------------------------------------------------------------ */
/* Scroll progress                                                          */
/* ------------------------------------------------------------------------ */

test("scroll progress: pin = (scrollY − top) / (height − innerHeight), clamped", () => {
  // A 160vh track at 900px viewport starting at 1000.
  assert.equal(pinProgress(1000, 1000, 1440, 900), 0);
  assert.equal(pinProgress(1270, 1000, 1440, 900), 0.5);
  assert.equal(pinProgress(1540, 1000, 1440, 900), 1);
  assert.equal(pinProgress(500, 1000, 1440, 900), 0);
  assert.equal(pinProgress(5000, 1000, 1440, 900), 1);
  // A track no taller than the viewport has no travel: a step.
  assert.equal(pinProgress(999, 1000, 900, 900), 0);
  assert.equal(pinProgress(1000, 1000, 900, 900), 1);
});

test("scroll progress: traverse = (innerHeight − rect.top) / (innerHeight + height)", () => {
  // Element 600 tall at document top 2000, viewport 900.
  assert.equal(traverseProgress(1100, 2000, 600, 900), 0, "top edge entering at the bottom");
  assert.equal(traverseProgress(2600, 2000, 600, 900), 1, "bottom edge leaving at the top");
  assert.equal(traverseProgress(1850, 2000, 600, 900), 0.5);
  assert.equal(traverseProgress(0, 2000, 600, 900), 0);
});

test("scroll progress: pin mode only applies at or above minWidth", () => {
  assert.equal(pinApplies("pin", 1024, 1024), true);
  assert.equal(pinApplies("pin", 1023, 1024), false);
  assert.equal(pinApplies("pin", 390), true);
  assert.equal(pinApplies("traverse", 2000, 0), false);
});

/* ------------------------------------------------------------------------ */
/* Canvas stage                                                             */
/* ------------------------------------------------------------------------ */

test("canvas stage: DPR is min(devicePixelRatio, innerWidth < 480 ? 1.5 : 2)", () => {
  assert.equal(stageDpr(3, 390), 1.5);
  assert.equal(stageDpr(3, 479), 1.5);
  assert.equal(stageDpr(3, 480), 2);
  assert.equal(stageDpr(2.625, 1440), 2);
  assert.equal(stageDpr(1, 390), 1);
  assert.equal(stageDpr(1.25, 1440), 1.25);
  assert.equal(stageDpr(0, 1440), 1, "a missing devicePixelRatio counts as 1");
});

test("canvas stage: coarse pointers ignore height-only changes under 120px", () => {
  const size = { w: 390, h: 664, dpr: 1.5 };
  assert.equal(isIgnorableResize(size, 390, 664, 1.5, false), true, "unchanged");
  assert.equal(isIgnorableResize(size, 390, 744, 1.5, true), true, "URL bar slid away");
  assert.equal(isIgnorableResize(size, 390, 744, 1.5, false), false, "fine pointer resizes");
  assert.equal(
    isIgnorableResize(size, 390, 664 + COARSE_HEIGHT_JITTER_PX, 1.5, true),
    false,
    "120px or more is a real resize"
  );
  assert.equal(isIgnorableResize(size, 844, 390, 1.5, true), false, "rotation");
  assert.equal(isIgnorableResize(size, 390, 664, 2, true), false, "DPR changed");
  assert.equal(isIgnorableResize(null, 390, 664, 1.5, true), false, "first measure");
  assert.equal(isIgnorableResize(null, 0, 664, 1.5, false), true, "collapsed wrapper");
});

/* ------------------------------------------------------------------------ */
/* Glow sprites                                                             */
/* ------------------------------------------------------------------------ */

test("glow sprites: falloff is 1 at the centre, 0 at the edge, strictly decreasing", () => {
  assert.equal(glowAlphaAt(0), 1);
  assert.equal(glowAlphaAt(1), 0);
  let previous = 1;
  for (let r = 0.05; r < 1; r += 0.05) {
    const alpha = glowAlphaAt(r);
    assert.ok(alpha < previous && alpha > 0, `falloff not decreasing at ${r}`);
    previous = alpha;
  }
});

test("glow sprites: colours are the page tokens", () => {
  const hex = (rgb: readonly number[]) =>
    `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  assert.equal(hex(GLOW_RGB.gold), "#d4a840");
  assert.equal(hex(GLOW_RGB.goldHi), "#ffd36e");
  assert.equal(hex(GLOW_RGB.phosphor), "#fff1c9");
  assert.equal(hex(GLOW_RGB.ember), "#ff7a45");
});
