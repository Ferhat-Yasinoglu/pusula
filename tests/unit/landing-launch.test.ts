import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import en from "../../src/i18n/messages/en.json" with { type: "json" };
import {
  BEAD_MS,
  BEAD_RUN_MS,
  DEFAULT_AIM,
  FACTS,
  FUSE_SAMPLES,
  FUSE_STRIDE,
  HOTSPOTS,
  LIT_MS,
  NUMERALS,
  PACE_COMPACT,
  PACE_WIDE,
  PANEL_VIEW_MARGIN,
  POWER_MS,
  ROW_MS,
  SCAN_BAND,
  SCAN_EVERY_MS,
  SCAN_FIRST_MS,
  SCAN_RUN_MS,
  SPIN_MS,
  TILT_SETTLE_P,
  aimPoint,
  beadOpacity,
  beadProgress,
  bearingBetween,
  bootDoneMs,
  buildFuse,
  compassBearing,
  cpsFor,
  defaultAim,
  dialTicks,
  easeInOutCubic,
  fuseWaypoints,
  glintAt,
  hotspotOf,
  inScanBand,
  legProgress,
  nextLit,
  nodeThresholds,
  rowDoneMs,
  rowStartMs,
  scanClock,
  sparkIndex,
  spinOffset,
  stepScan,
  tiltMoving,
} from "../../src/app/landing/components/launch/launchModel.ts";

test("launch facts: four rows, real i18n keys, three hotspots on the first three", () => {
  const landing = (en as { landing: Record<string, string> }).landing;
  assert.equal(FACTS.length, 4);
  for (const fact of FACTS) {
    assert.ok(landing[fact.title], `missing ${fact.title}`);
    assert.ok(landing[fact.desc], `missing ${fact.desc}`);
  }
  assert.deepEqual(
    HOTSPOTS.map((h) => h.fact),
    ["encrypted", "local", "port"]
  );
  assert.equal(NUMERALS.length, HOTSPOTS.length);
  assert.deepEqual(
    FACTS.map((_, i) => hotspotOf(i)),
    [0, 1, 2, -1],
    "no-account has no hotspot: nothing on screen shows it"
  );
  assert.equal(hotspotOf(99), -1);
});

test("launch hotspots: percent coordinates of the real 1280×720 screenshot", () => {
  const px = HOTSPOTS.map((h) => [Math.round((h.x / 100) * 1280), Math.round((h.y / 100) * 720)]);
  // Warning icon of the zero-config banner, the ~/.pusula/server.env chip, the base URL.
  assert.deepEqual(px, [
    [287, 192],
    [945, 209],
    [534, 517],
  ]);
  for (const h of HOTSPOTS) {
    assert.ok(h.x > 0 && h.x < 100 && h.y > 0 && h.y < 100);
    assert.ok(h.w >= 0 && h.x - h.w / 2 > 0 && h.x + h.w / 2 < 100);
  }
  // I rings an icon; II and III are pills that enclose their text, so it stays readable.
  const spans = HOTSPOTS.map((h) => [
    Math.round(((h.x - h.w / 2) / 100) * 1280),
    Math.round(((h.x + h.w / 2) / 100) * 1280),
  ]);
  assert.equal(HOTSPOTS[0].w, 0);
  assert.ok(spans[1][0] <= 869 && spans[1][1] >= 1021, `chip 869–1021 px: ${spans[1]}`);
  assert.ok(spans[2][0] <= 456 && spans[2][1] >= 612, `URL 456–612 px: ${spans[2]}`);
  // …but never far past it (the pill's own padding is added in CSS).
  assert.ok(spans[1][1] - spans[1][0] < 170 && spans[2][1] - spans[2][0] < 170);
  // Chips open clear of what each hotspot points at.
  assert.deepEqual(
    HOTSPOTS.map((h) => h.side),
    ["above", "above", "below"]
  );
});

test("launch boot: power-on, then one row every 300ms", () => {
  assert.equal(POWER_MS, 420);
  assert.equal(ROW_MS, 300);
  assert.equal(rowStartMs(0), 420);
  assert.equal(rowStartMs(3), 1320);
  for (let i = 0; i < 4; i++) {
    assert.ok(rowDoneMs(i) > rowStartMs(i));
    assert.ok(rowDoneMs(i) < rowStartMs(i + 1), "a row ticks before the next starts");
  }
  assert.equal(bootDoneMs(4), 1620);
  assert.equal(LIT_MS, 1600);
});

test("launch boot pace: wide follows the CRT; stacked lands every row within ~600ms", () => {
  assert.deepEqual(PACE_WIDE, { lead: POWER_MS, row: ROW_MS, tick: 260, type: 230 });
  for (const pace of [PACE_WIDE, PACE_COMPACT]) {
    assert.equal(rowStartMs(0, pace), pace.lead);
    for (let i = 0; i < 4; i++) {
      assert.ok(pace.type < pace.tick, "a title has finished typing before its tick");
      assert.ok(rowDoneMs(i, pace) > rowStartMs(i, pace));
      assert.ok(rowDoneMs(i, pace) < rowStartMs(i + 1, pace), "a row ticks before the next starts");
    }
  }
  // Released by the list's own view (power long over): last tick, from release.
  const fromView = rowDoneMs(3, PACE_COMPACT) - PACE_COMPACT.lead;
  assert.ok(fromView <= 500, `stacked rows land ${fromView}ms after the list shows`);
  // Worst case, the list and the monitor arrive together: lead plus every row.
  assert.ok(rowDoneMs(3, PACE_COMPACT) <= 650, `stacked boot ${rowDoneMs(3, PACE_COMPACT)}ms`);
  assert.ok(bootDoneMs(4, PACE_COMPACT) < bootDoneMs(4, PACE_WIDE));
  // The list counts as in view once its top crosses 85% of the viewport.
  assert.equal(PANEL_VIEW_MARGIN, "0px 0px -15% 0px");
  // A stacked title still types (not a blink): ≤ 25 chars at a sane rate.
  assert.ok(cpsFor(25, PACE_COMPACT.type) <= 400);
});

test("launch scan: one 3.3s sweep per 6s cycle, started only near the middle", () => {
  assert.equal(SCAN_EVERY_MS, 6000);
  assert.equal(SCAN_RUN_MS, 3300);
  assert.ok(SCAN_RUN_MS < SCAN_EVERY_MS);
  const clock = scanClock();
  assert.equal(clock.on, false);
  // Off-centre: the first sweep waits, however long.
  assert.equal(stepScan(clock, SCAN_FIRST_MS + 5000, false), false);
  // Centred: it starts at once, runs its full length, then rests.
  assert.equal(stepScan(clock, 16, true), true);
  assert.equal(stepScan(clock, SCAN_RUN_MS - 32, false), true, "a started sweep runs to its end");
  assert.equal(stepScan(clock, 40, true), false);
  assert.equal(stepScan(clock, SCAN_EVERY_MS - SCAN_RUN_MS - 100, true), false, "resting");
  assert.equal(stepScan(clock, 120, true), true, "the next cycle");
  // The first sweep after the loop starts comes SCAN_FIRST_MS in.
  const fresh = scanClock();
  assert.equal(stepScan(fresh, SCAN_FIRST_MS - 1, true), false);
  assert.equal(stepScan(fresh, 1, true), true);
  // Garbage steps never run the clock backwards.
  const odd = scanClock();
  stepScan(odd, Number.NaN, true);
  stepScan(odd, -500, true);
  assert.equal(odd.t, SCAN_EVERY_MS - SCAN_FIRST_MS);
  // The band and the tilt hint.
  assert.deepEqual(SCAN_BAND, [0.3, 0.7]);
  assert.equal(inScanBand(0.5), true);
  assert.equal(inScanBand(0.2), false);
  assert.equal(inScanBand(0.85), false);
  assert.ok(Math.abs(TILT_SETTLE_P * 2.2 - 1) < 1e-12, "matches the CSS --tilt: min(1, p × 2.2)");
  assert.equal(tiltMoving(0), true);
  assert.equal(tiltMoving(0.3), true);
  assert.equal(tiltMoving(0.46), false);
  assert.equal(tiltMoving(1), false);
});

test("launch css: the stacked column shrinks, so a long window-bar tag cannot widen it", () => {
  const css = readFileSync(
    new URL("../../src/app/landing/components/launch/launch.css", import.meta.url),
    "utf8"
  );
  // The top-level (unindented) rule, not a media-query override.
  const rule = (selector: string): string => {
    const at = css.indexOf(`\n${selector} {`);
    assert.ok(at >= 0, `missing ${selector}`);
    return css.slice(at, css.indexOf("}", at));
  };
  // tr "ekran görüntüsü" once pushed the monitor and the list to 377px at 390.
  assert.match(rule(".pusula-landing .lx-a"), /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(rule(".pusula-landing .lx-mon"), /min-width:\s*0/);
  assert.match(rule(".pusula-landing .lx-test"), /min-width:\s*0/);
  const url = rule(".pusula-landing .lx-mon-url");
  assert.match(url, /min-width:\s*0/);
  assert.match(url, /text-overflow:\s*ellipsis/);
  assert.match(rule(".pusula-landing .lx-mon-bar"), /overflow:\s*hidden/);
  // The scan is a one-shot per sweep, never an infinite loop over the tilted screen.
  assert.doesNotMatch(css, /launch-scan[^;]*infinite/);
  assert.match(
    rule(".pusula-landing .lx-mon[data-scan] .lx-mon-scan::before"),
    /launch-scan 3\.3s/
  );
  // The layer hint is conditional.
  assert.doesNotMatch(rule(".pusula-landing .lx-mon-tilt"), /will-change/);
  // No endless loop at rest inside the tilted frame: a hotspot pulses once as it
  // lights (endlessly only while held), and the power LED is steady.
  assert.doesNotMatch(rule(".pusula-landing .lx-hot-pulse"), /animation/);
  assert.match(rule(".pusula-landing .lx-hot[data-lit] .lx-hot-pulse"), /launch-pulse 1\.4s/);
  assert.doesNotMatch(rule(".pusula-landing .lx-hot[data-lit] .lx-hot-pulse"), /infinite/);
  assert.doesNotMatch(rule(".pusula-landing .lx-mon-led"), /animation|--breathe/);
  // One-shots fill backwards only: a finished animation left filling under the
  // 3D frame kept the compositor redrawing it every frame.
  const oneShots = css.match(/animation:\s*launch-[\w-]+[^;]*;/g) ?? [];
  assert.ok(oneShots.length >= 8, `found ${oneShots.length} launch animations`);
  for (const decl of oneShots) {
    assert.doesNotMatch(decl, /\b(both|forwards)\b/, decl);
  }
});

test("launch cpsFor: text finishes inside its slot", () => {
  for (const chars of [1, 8, 17, 25, 48]) {
    for (const ms of [230, 250, 300]) {
      const cps = cpsFor(chars, ms);
      assert.ok(cps >= 1);
      assert.ok((chars / cps) * 1000 <= ms + 1e-9, `${chars} chars at ${cps}cps > ${ms}ms`);
    }
  }
  assert.equal(cpsFor(0, 300), 1);
  assert.equal(cpsFor(10, 0), 1);
});

test("launch idle sequence cycles the hotspots", () => {
  assert.equal(nextLit(-1, 3), 0);
  assert.equal(nextLit(0, 3), 1);
  assert.equal(nextLit(2, 3), 0);
  assert.equal(nextLit(0, 0), -1);
});

test("launch compass bearings: north 0, clockwise, screen y down", () => {
  assert.equal(compassBearing(0, -10), 0);
  assert.equal(compassBearing(10, 0), 90);
  assert.equal(compassBearing(0, 10), 180);
  assert.equal(compassBearing(-10, 0), 270);
  assert.equal(compassBearing(10, 10), 135);
  assert.equal(compassBearing(-10, 10), 225);
  assert.equal(compassBearing(0, 0), 0);
  const compass = { left: 0, top: 0, width: 120, height: 120 };
  const cta = { left: 160, top: 100, width: 200, height: 52 };
  const b = bearingBetween(compass, cta);
  assert.ok(b > 90 && b < 135, `cta below-right → ${b}`);
  // Mirrored layout (RTL): the CTA sits below-left.
  const mirrored = bearingBetween(
    { left: 500, top: 0, width: 120, height: 120 },
    { left: 260, top: 100, width: 200, height: 52 }
  );
  assert.equal(Math.round(mirrored + b), 360);
});

test("launch spin: one full turn, eased, then holds", () => {
  assert.equal(spinOffset(0), 0);
  assert.equal(spinOffset(SPIN_MS), 360);
  assert.equal(spinOffset(SPIN_MS * 2), 360);
  assert.equal(spinOffset(SPIN_MS / 2), 180);
  let prev = -1;
  for (let ms = 0; ms <= SPIN_MS; ms += 50) {
    const v = spinOffset(ms);
    assert.ok(v >= prev, "monotonic");
    assert.ok(v - prev < 180 || prev < 0, "small enough steps for the needle's short-way rule");
    prev = v;
  }
  assert.equal(easeInOutCubic(-1), 0);
  assert.equal(easeInOutCubic(2), 1);
});

test("launch dial ticks are deterministic", () => {
  const a = dialTicks();
  const b = dialTicks();
  assert.equal(a.major, b.major);
  assert.equal(a.minor, b.minor);
  assert.equal((a.major.match(/M/g) ?? []).length, 8);
  assert.equal((a.minor.match(/M/g) ?? []).length, 64);
  assert.ok(a.major.startsWith("M60 6L60 15"), a.major.slice(0, 20));
});

test("launch fuse (row): along the nodes, round corner, down into the terminal", () => {
  const start = { x: 18, y: 18 };
  const layout = { mode: "row" as const, start, dropX: 1300, endY: 400 };
  const points = fuseWaypoints(layout);
  assert.deepEqual(points, [start, { x: 1300, y: 18 }, { x: 1300, y: 400 }]);
  const fuse = buildFuse(points, 18);
  assert.equal(fuse.samples, FUSE_SAMPLES);
  assert.equal(fuse.lut.length, FUSE_SAMPLES * FUSE_STRIDE);
  assert.ok(fuse.d.startsWith("M18 18L1282 18Q1300 18 1300 36L1300 400"), fuse.d);
  // Rounded length is a little shorter than the polyline.
  const polyline = 1282 + 382;
  assert.ok(fuse.length < polyline && fuse.length > polyline - 10, String(fuse.length));
  // The LUT starts at the start, ends at the end, and is evenly spaced.
  assert.equal(fuse.lut[0], 18);
  assert.equal(fuse.lut[1], 18);
  assert.equal(fuse.lut[(FUSE_SAMPLES - 1) * 2], 1300);
  assert.equal(fuse.lut[(FUSE_SAMPLES - 1) * 2 + 1], 400);
  const step = fuse.length / (FUSE_SAMPLES - 1);
  for (let i = 1; i < FUSE_SAMPLES; i++) {
    const d = Math.hypot(
      fuse.lut[i * 2] - fuse.lut[i * 2 - 2],
      fuse.lut[i * 2 + 1] - fuse.lut[i * 2 - 1]
    );
    assert.ok(Math.abs(d - step) < 1.5, `sample ${i}: ${d} vs ${step}`);
  }
  // Two legs: east, then south.
  assert.deepEqual(
    fuse.legs.map((leg) => leg.angle),
    [0, 90]
  );
  assert.equal(fuse.legs[0].from, 0);
  assert.equal(fuse.legs[1].to, 1);
  // Nodes tick in order along the first leg.
  const nodes = [start, { x: 470, y: 18 }, { x: 922, y: 18 }];
  const thresholds = nodeThresholds(start, nodes, fuse);
  assert.equal(thresholds[0], 0);
  assert.ok(thresholds[1] < thresholds[2] && thresholds[2] < fuse.legs[0].to);
});

test("launch fuse (column, RTL row): straight down; mirrored rows run westward", () => {
  const down = buildFuse(fuseWaypoints({ mode: "column", start: { x: 18, y: 18 }, endY: 600 }), 18);
  assert.equal(down.d, "M18 18L18 600");
  assert.equal(down.legs.length, 1);
  assert.equal(down.legs[0].angle, 90);
  const west = buildFuse(
    fuseWaypoints({ mode: "row", start: { x: 1340, y: 18 }, dropX: 40, endY: 300 }),
    18
  );
  assert.deepEqual(
    west.legs.map((leg) => leg.angle),
    [180, 90]
  );
  assert.ok(west.lut[2] < west.lut[0], "the spark moves towards the inline end (left)");
});

test("launch fuse: degenerate inputs never throw", () => {
  assert.equal(buildFuse([], 18).d, "");
  const single = buildFuse([{ x: 5, y: 6 }], 18);
  assert.equal(single.length, 0);
  assert.equal(single.lut[0], 5);
  const dup = buildFuse(
    [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    18
  );
  assert.equal(dup.d, "M0 0L10 0");
  // A corner tighter than its legs clamps its radius.
  const tight = buildFuse(
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ],
    18
  );
  assert.ok(tight.d.includes("Q10 0 10 5"), tight.d);
  assert.equal(buildFuse([{ x: Number.NaN, y: 0 }], 18).d, "");
});

test("launch spark and burn progress", () => {
  assert.equal(sparkIndex(0, 160), 0);
  assert.equal(sparkIndex(1, 160), 159);
  assert.equal(sparkIndex(2, 160), 159);
  assert.equal(sparkIndex(-1, 160), 0);
  assert.equal(sparkIndex(0.5, 1), 0);
  const fuse = buildFuse(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
    10
  );
  const [first, second] = fuse.legs;
  assert.equal(legProgress(first, 0), 0);
  assert.equal(legProgress(first, 0.25), 0.5);
  assert.equal(legProgress(first, 0.5), 1);
  assert.equal(legProgress(second, 0.5), 0);
  assert.equal(legProgress(second, 0.75), 0.5);
  assert.equal(legProgress(second, 1), 1);
});

test("launch idle bead: runs the fuse once per cycle, eased, then rests", () => {
  assert.equal(BEAD_MS, 6000);
  assert.ok(BEAD_RUN_MS < BEAD_MS / 2, "rests longer than it runs");
  assert.equal(beadProgress(0), 0);
  assert.ok(Math.abs(beadProgress(BEAD_RUN_MS / 2) - 0.5) < 1e-9);
  assert.equal(beadProgress(BEAD_RUN_MS), -1);
  assert.equal(beadProgress(BEAD_MS - 1), -1);
  assert.equal(beadProgress(BEAD_MS), 0, "the next cycle starts over");
  assert.equal(beadProgress(-5), -1);
  assert.equal(beadProgress(Number.NaN), -1);
  let prev = -1;
  for (let ms = 0; ms < BEAD_RUN_MS; ms += 40) {
    const p = beadProgress(ms);
    assert.ok(p >= prev && p <= 1, `monotonic at ${ms}`);
    prev = p;
  }
  // Fades in off the pilot and out into the terminal.
  assert.equal(beadOpacity(-1), 0);
  assert.equal(beadOpacity(0), 0);
  assert.equal(beadOpacity(0.5), 1);
  assert.equal(beadOpacity(1), 0);
  assert.ok(beadOpacity(0.03) > 0 && beadOpacity(0.03) < 1);
});

test("launch node glint: brightest as the bead crosses a node, zero away from it", () => {
  assert.equal(glintAt(0.4, 0.4), 1);
  assert.equal(glintAt(-1, 0.4), 0, "resting bead");
  assert.equal(glintAt(0.4 + 0.2, 0.4), 0);
  assert.equal(glintAt(0.4 - 0.2, 0.4), 0);
  const near = glintAt(0.42, 0.4);
  const far = glintAt(0.45, 0.4);
  assert.ok(near > far && far > 0, `${near} > ${far} > 0`);
  assert.equal(glintAt(0.43, 0.4), glintAt(0.37, 0.4), "symmetric");
  assert.equal(glintAt(0.4, 0.4, 0), 0);
});

test("launch final compass: aims at a stacked button's near side, so it visibly swings", () => {
  const compass = { left: 0, top: 0, width: 120, height: 120 };
  const cta = { left: 164, top: 2, width: 212, height: 52 };
  const docs = { left: 164, top: 66, width: 212, height: 52 };
  const centre = (box: typeof cta) => bearingBetween(compass, box);
  const near = (box: typeof cta) => bearingBetween(compass, aimPoint(compass, box));
  // Still on the button…
  const point = aimPoint(compass, cta);
  assert.ok(point.left > cta.left && point.left < cta.left + cta.width);
  assert.equal(point.top, cta.top + cta.height / 2);
  // …and a wider swing between the two than their centres give.
  assert.ok(near(docs) - near(cta) > centre(docs) - centre(cta) + 4);
  assert.ok(near(cta) < 90 && near(docs) > 90, `${near(cta)} / ${near(docs)}`);
  // Mirrored (RTL): buttons on the inline-start side.
  const rtlCta = { left: -256, top: 2, width: 212, height: 52 };
  const rtlPoint = aimPoint(compass, rtlCta);
  assert.ok(rtlPoint.left < rtlCta.left + rtlCta.width && rtlPoint.left > rtlCta.left);
  assert.equal(Math.round(near(cta) + bearingBetween(compass, rtlPoint)), 360);
  // Straight below: the centre itself.
  const below = { left: 10, top: 140, width: 100, height: 48 };
  assert.equal(aimPoint(compass, below).left, 60);
  // Server render: the desktop band's aim, mirrored in RTL.
  assert.equal(defaultAim(false), DEFAULT_AIM.ltr);
  assert.equal(defaultAim(true), DEFAULT_AIM.rtl);
  assert.equal(DEFAULT_AIM.ltr + DEFAULT_AIM.rtl, 360);
});
